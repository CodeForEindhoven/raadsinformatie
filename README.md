# raadsinformatie

Small script to harvest pdf documents from the `<city>.raadsinformatie.nl` website

## Mongo
this script requires a running mongo instance. Make sure you set the connection in index.js

```javascript
var connectstr = 'mongodb://localhost:27017/raadsinformatie';
```

## Configure
Open index.js and change the variables.
```javascript
var startyear = 2010;
var endyear = 2010;
var city = 'amsterdam'; //'eindhoven';
//amsterdam, apeldoorn, dordrecht, maastricht, groningen, middelburg
//deventer, ommen, hulst, almere, huizen
```

## Run
```
npm install
node index.js
```

The script will first grab the meetings for the specific year(s), read the documents,
then scrape the `link` from the meeting for additional documents. Finally it will parse
the array of documents and download any pdf into the directory 

`./data/<city>/<year>/<month>/<day>/<md5hash>.pdf`

In the mongo database you will find three collections:
- Meetings
- Documents (with a meeting id)
- Downloads (with a meeting id and reference to the Document url plus the filename of the downloaded file)

## R

The file `process.R` contains a script that will create a TermDocumentMatrix that can be used to analyse the set of pdf's that
are generated from the script.

