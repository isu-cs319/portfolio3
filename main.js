// Globals
var http = require("http");
var express = require('express')
var app = express()
var bodyParser = require('body-parser')
var fs = require('fs')

// Twitter
var Twitter = require('twitter');
var credentials_twitter = JSON.parse(fs.readFileSync('twitter.auth', 'utf8'));  // Hide file from git
var client = new Twitter(credentials_twitter)

// IBM Alchemy Language
var watson = require('watson-developer-cloud');
var credentials_alchemy = JSON.parse(fs.readFileSync('bluemix.auth', 'utf8'));  // Hide file from git
var alchemy_language = watson.alchemy_language(credentials_alchemy)

// JSON parsing
app.use(bodyParser.json());       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}));

// Routing Config
app.use(express.static(__dirname + '/public'));
app.use('/bower_components', express.static(__dirname + '/bower_components'));

// respond with "<index.html>" when a GET request is made to the homepage
app.get('/', function (req, res) {
  var options = {
    //root: __dirname,
    dotfiles: 'deny',
    headers: {
      'x-timestamp': Date.now(),
      'x-sent': true
    }
  };
  var file = '/index.html'
  res.sendFile(file, options, function (err) {
    if (err) {
      console.log(err);
      res.status(err.status).end();
    }
    else {
      console.log('Sent:', file);
    }
  });
})

app.get('/emotion', function (req, res) {
  var user = req.query.user
  var limit = req.query.limit
  var tags = req.query.tags
  client.get('search/tweets', { q: 'from:' + user + " " + tags, count: limit }, function (error, tweets, response) {
    console.log(tweets);
    if (tweets == undefined || tweets.statuses.length > 0) {
      // Join tweets:
      var tweets_joined = tweets.statuses.filter(function (tweet) {
        return tweet.text.length > 10
      }).map(function (tweet) {
        return tweet.text
      }).join('\n');

      //console.log("Analyzing tweets:\n" + tweets_joined);
      var parameters = {
        text: tweets_joined
      };

      alchemy_language.emotion(parameters, function (err, response) {
        if (err) {
          console.log('error:', err)
          err.tweets = tweets_joined
          res.send(JSON.stringify(err, null, 2));
        }
        else {
          response.docEmotions.userName = user
          response.docEmotions.tweets = tweets_joined.split('\n')
          res.send(JSON.stringify(response.docEmotions, null, 2));
        }
      });
    }else{
        res.send(JSON.stringify({error:"No tweets found!"}));
    }
  });
});

app.get('/user', function (req, res) {
  var user = req.query.user
  client.get('users/show', { screen_name: user }, function (error, tweets, response) {
    res.send(JSON.stringify(tweets,null,2));
  })
})

app.get('/keywords', function (req, res) {
  var user = req.query.user
  var limit = req.query.limit
  var tags = req.query.tags
  client.get('search/tweets', { q: 'from:' + user+" " + tags, count: limit }, function (error, tweets, response) {
    console.log(tweets);
    if (tweets == undefined || tweets.statuses.length > 0) {
      // Join tweets:
      var tweets_joined = tweets.statuses.filter(function (tweet) {
        return tweet.text.length > 10
      }).map(function (tweet) {
        return tweet.text
      }).join('\n');

      //console.log("Analyzing tweets:\n" + tweets_joined);
      var parameters = {
        text: tweets_joined,
        sentiment: 1,
        maxRetrieve: 10
      };

      alchemy_language.keywords(parameters, function (err, response) {
        if (err) {
          console.log('error:', err)
          err.tweets = tweets_joined
          res.send(JSON.stringify(err, null, 2));
        }
        else {
          response.userName = user
          res.send(JSON.stringify(response, null, 2));
        }
      });
    }else{
        res.send(JSON.stringify({error:"No tweets found!"}));
    }
  });
});
var port = process.env.PORT || 8000
app.listen(port, function () {
  console.log('listening on port ' + port)
})
