var MongoClient = require('mongodb').MongoClient;
var moment = require("moment-timezone");
var assert = require('assert');
var https = require('https');
var fs = require('fs');
var path = require("path");
var url = require("url");
var cheerio = require("cheerio");
var md5 = require("nodejs-md5");
var db = 'mongodb://localhost:27017/raadsinformatie';

MongoClient.connect(db, function(err, db) {
    var meeting_collection = db.collection('meetings');
    assert.equal(null, err);
    console.log("Connected correctly to server.");
    var ehv_1998 = require('./data/eindhoven-1998.json');
    ehv_1998.meetings.forEach(function(meeting) {
        meeting.timestamp = moment.tz(
            moment(meeting.date + " " + meeting.time, "DD-MM-YYYY HH:mm"),
            "Europe/Amsterdam").format();
        delete meeting.time;
        delete meeting.date;
        scrape("/vergadering/" + meeting.id, meeting.id, function() {
            console.log("Scraped: " + meeting.id);
        });
        meeting.documents.forEach(function(document) {
            download(document.url, "./data/documents/", document.file_type, meeting.id, document.title, null);
        });
        delete meeting.documents;
        meeting_collection.insert(meeting);
    });
    //db.close();
});

var scrape = function(link, meeting) {
    var req = https.request({
        host: "eindhoven.raadsinformatie.nl",
        port: 443,
        path: encodeURI(link),
        method: 'GET'
    }, function(res) {
        res.setEncoding("utf8");
        res.on('error', function(e) {
            console.log(e);
        });
        var response_text = "";
        res.on("data", function(chunk) {
            response_text += chunk;
        });
        res.on("end", function() {
            $ = cheerio.load(response_text);
            $(".new_window").each(function(index, element) {
                if (element.attribs.href.indexOf("https://eindhoven.raadsinformatie.nl/document") > -1) {
                    var clas = $(this).children().first()[0].attribs.class;
                    if (clas === "pdf") {
                        download(element.attribs.href, "./data/documents/", clas, meeting, null, null);
                    } else if (clas === "document_icon") {
                        var temp = $(this).children().first()[0];
                        var alt = $(temp).children().first()[0].attribs.alt;
                        if (alt === "pdf") {
                            download(element.attribs.href, "./data/documents/", alt, meeting, null, null);
                        }
                    }

                }
            });
        });
    });
    req.on('error', function(e) {
        console.log(e);
    });
    req.end();
};

var download = function(link, dest, file_type, meeting_id, title, cb) {
    if (link) {
        var parsed = url.parse(link);
        var document = {
            "meeting_id": meeting_id,
            "title": title,
            "description": path.basename(parsed.pathname),
            "confidential": 0,
            "url": link,
            "file_type": file_type
        };

        md5.string.quiet(document.title, function(err, md5) {
            if (err) {
                console.log(err);
            } else {
                var filename = md5.toString() + "." + file_type;
                document.file_name = filename;
                var file = fs.createWriteStream(dest + filename);
                var request = https.get(link, function(response) {
                    response.pipe(file);
                    file.on('finish', function() {
                        MongoClient.connect(db, function(err, db) {
                            assert.equal(null, err);
                            var document_collection = db.collection('documents');
                            document_collection.insert(document);
                            file.close(cb);
                        });

                    });
                });

            }
        });

    }
};
