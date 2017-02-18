var MongoClient = require('mongodb').MongoClient;
var moment = require("moment-timezone");
var assert = require('assert');
var https = require('https');
var fs = require('node-fs');
var path = require("path");
var url = require("url");
var cheerio = require("cheerio");
var md5 = require("nodejs-md5");
var connectstr = 'mongodb://localhost:27017/raadsinformatie';
var db;
var startyear = 2010;
var endyear = 2010;
var city = 'amsterdam'; //'eindhoven';
//amsterdam, apeldoorn, dordrecht, maastricht, groningen, middelburg
//deventer, ommen, hulst, almere, huizen
/**
 * download function
 */
var download = function(document, callback) {
  var temp = {
    "meeting_id": document.meeting_id,
    "url": document.url,
    "timestamp": document.timestamp,
    "file_type": document.file_type
  };
  md5.string.quiet(temp.url, function(err, md5) {
    if (err) {
      throw err;
    } else {
      temp.file_name = md5.toString() + "." + temp.file_type;
      var dest = './data/' + city + '/' + moment(temp.timestamp).format('YYYY/MM') + "/";
      temp.location = dest + temp.file_name;
      fs.mkdir(dest, 0777, true, function(err) {
        if (err) {
          throw err;
        }
        var file = fs.createWriteStream(temp.location);
        var request = https.get(temp.url, function(response) {
          response.pipe(file);
          file.on('finish', function() {
            file.close(callback(temp));
          });
        });
      });
    }
  });
};

/**
 * scrape function
 */
var scrape = function(meeting, callback) {
  var link = "/vergadering/" + meeting.id;
  var scrape_documents = [];

  // @todo looks like this results in double entries, remove?
  for (var i = 0; i < meeting.documents.length; i++) {
    meeting.documents[i].meeting_id = meeting.id;
    meeting.documents[i].timestamp = meeting.timestamp;
  }
  scrape_documents = scrape_documents.concat(meeting.documents);
  var req = https.request({
    host: city + ".raadsinformatie.nl",
    port: 443,
    path: encodeURI(link),
    method: 'GET'
  }, function(res) {
    res.setEncoding("utf8");
    res.on('error', function(e) {
      throw e;
    });
    var response_text = "";
    res.on("data", function(chunk) {
      response_text += chunk;
    });
    res.on("end", function() {
      $ = cheerio.load(response_text);

      $(".new_window").each(function(index, element) {
        if (element.attribs.href) {
          if (element.attribs.href.indexOf("https://eindhoven.raadsinformatie.nl/document") > -1) {
            if ($(this).children().first().length > 0) {
              var clas = $(this).children().first()[0].attribs.class;
              var parsed = url.parse(element.attribs.href);
              var document = {
                "meeting_id": meeting.id,
                "description": path.basename(parsed.pathname),
                "url": element.attribs.href,
                "timestamp": meeting.timestamp
              };

              if (clas === "pdf") {
                document.file_type = clas;
                scrape_documents.push(document);
                //download(document, null);
              } else if (clas === "document_icon") {
                var temp = $(this).children().first()[0];
                var alt = $(temp).children().first()[0].attribs.alt;
                if (alt === "pdf") {
                  document.file_type = alt;
                  scrape_documents.push(document);
                  //download(document, null);
                }
              }
            }
          }
        }
      });
      callback(scrape_documents);
    });
  });
  req.on('error', function(e) {
    throw e;
  });
  req.end();
};

/**
 * read_year function
 */
var read_year = function(year, callback) {
  var api_url = encodeURI("/api/calendar/?start=" +
    moment(year.toString(), "YYYY").startOf('year').format("YYYY-M-D") +
    "&end=" +
    moment(year.toString(), "YYYY").endOf('year').format("YYYY-M-D") +
    "&_=" + moment().valueOf());
  var req = https.request({
    host: city + ".raadsinformatie.nl",
    port: 443,
    path: api_url,
    method: 'GET'
  }, function(res) {

    var response_text = "";
    res.on('error', function(e) {
      throw e;
    });
    res.on("data", function(chunk) {
      response_text += chunk;
    });
    res.on("end", function() {
      var result;
      try {
        result = JSON.parse(response_text);
        callback(null, result);
      } catch (err) {
        callback(err, null);
      }
    });
  });
  req.on('error', function(e) {
    throw (e);
  });
  req.end();
};

function get_meetings(callback) {
  var meetings = [];

  function loop_year(yIdx) {
    read_year(yIdx, function(err, res) {
      if (err) {
        console.log(err);
      } else {
        console.log("Year " + yIdx + " (" + res.meetings.length + " meetings)");
        for (var i = 0; i < res.meetings.length; i++) {
          res.meetings[i].timestamp = moment.tz(
            moment(res.meetings[i].date + " " + res.meetings[i].time, "DD-MM-YYYY HH:mm"),
            "Europe/Amsterdam").format();
        }
        meetings = meetings.concat(res.meetings);
        if (yIdx === moment().year() || yIdx === endyear) {
          callback(meetings);
        } else {
          loop_year(yIdx + 1);
        }
      }
    });
  }
  loop_year(startyear);
}


function get_downloads(documents, callback) {
  var downloads = [];

  function loop_documents(mIdx) {
    //console.log(meetings[mIdx]);
    download(documents[mIdx], function(document_download) {
      downloads.push(document_download);
      console.log(documents[mIdx].meeting_id + " downloaded");
      if (mIdx < documents.length - 1) {
        loop_documents(mIdx + 1);
      } else {
        callback(downloads);
      }
    });
  }
  loop_documents(0);
}

function get_documents(meetings, callback) {
  var documents = [];

  function loop_meetings(mIdx) {
    //console.log(meetings[mIdx]);
    scrape(meetings[mIdx], function(meeting_docs) {
      documents = documents.concat(meeting_docs);
      console.log("meeting " + meetings[mIdx].id + " (" + meeting_docs.length + " documents)");
      if (mIdx < meetings.length - 1) {
        loop_meetings(mIdx + 1);
      } else {
        callback(documents);
      }
    });
  }
  loop_meetings(0);
}

/**
 * __Main__
 */
MongoClient.connect(connectstr, function(err, connection) {
  db = connection;
  get_meetings(function(meetings) {
    if (meetings.length > 0) {
      get_documents(meetings, function(documents) {
        get_downloads(documents, function(downloads) {
          var meeting_collection = db.collection('meetings');
          var document_collection = db.collection('documents');
          var download_collection = db.collection('downloads');
          meeting_collection.insertMany(meetings, function(err, result) {
            document_collection.insertMany(documents, function(err, result) {
              download_collection.insertMany(downloads, function(err, result) {
                db.close();
              });
            });
          });
        });
      });
    } else {
      //nothing to do
      db.close();
    }
  });
});
