const os = require('os');
const express = require('express');
const morgan = require('morgan');
const path = require('path');
const needle = require('needle');
const bodyParser = require('body-parser');
const hash = require('string-hash');

const app = express();

console.log("Starting server to support lobster log viewer.\nOptions:\n  --cache   Cache files after download in the provided directory. Note! All directory content will be deleted on the server start up! [optional]");

var myCache;
const cache = require('yargs').argv.cache;
if (cache) {  
    myCache = require('./local_cache')(cache);
}
else {
    myCache = require('./dummy_cache')();
}

// Setup logger
app.use(morgan(':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] :response-time ms'));

app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

// Serve static assets
app.use(express.static(path.resolve(__dirname, '..', 'build')));

app.use(function (err, req, res, next) {
  if (res.headersSent) {
    return next(err)
  }
  res.status(500)
  res.render('error', { error: err })
})
    
// Always return the main index.html, so react-router render the route in the client
app.get('*', (req, res) => {
   res.sendFile(path.resolve(__dirname, '..', 'build', 'index.html'));
});

app.post('/api/log', function(req, res, next) {
    let log_url = req.body.url;
    let filter = req.body.filter;

    if(log_url === undefined) {
        console.log("url is undefined" );
        res.status(500).send("url cannot be undefined");
    }
    console.log("url = " + log_url);
    if (filter) {
        console.log("filter = " + filter);
    }
    else {
        console.log("filter is not set");
    }

    let fileName = hash(log_url).toString(); 

    myCache.get(fileName)
        .then(data => {
            console.log("got from cache: " + fileName);
            res.send(data);
        })
        .catch(err => {
            console.log(fileName + " is not in the cache")

            let stream = needle.get(log_url);
            let result = '';

            stream.on('readable', function() {
                while (data = this.read()) {
                    result += data;
                }
            });

            stream.on('done', function (err) {
                if (!err) {
                    console.log("done");
                    myCache.put(fileName, result)
                        .then( data => res.send(data) )
                }
                else {
                    console.log("Error: " + err);
                }
            });
        });
});

module.exports = app;
