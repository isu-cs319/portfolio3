/**
 * Created by schott on 02.12.16.
 */
$(document).ready(function () {
    $('#tabs a').click(function (e) {
        e.preventDefault()
        $(this).tab('show')
    })
    $('.results').hide();
    console.log("ready!");
});
// Globals
google.charts.load('current', { 'packages': ['corechart', 'bar'] });
var user;
var tweetEmotions;
var keyWords;


function checkRequest(userName, tweetLimit, hashTags, resolve, reject) {
    if (userName.length < 1) {
        displayAlert('Username invalid');
        return false;
    }
    else if (tweetLimit.length <= 1 || tweetLimit > 100) {
        displayAlert('Tweet Limit must be in the range 10 < x < 100.');
        return false;
    }
    var prms = $.get('/user', { user: userName })
        .done(function (data) {
            data = JSON.parse(data);
	    console.log("data! ", data);
            if (data.hasOwnProperty('errors')) {
                reject("Code: " + data.errors[0].code + " " + data.errors[0].message);
            }
            else {
                user = data;
                resolve(data);
            }
        })
        .fail(function (xhr) {
            console.log("Error fetching user", xhr);
            displayAlert("Connection error");
            reject("Connection error");
            return false;
        })
}

function displayAlert(msg) {
    $('#error-alert').html('<strong>' + msg + '</strong>');
    $('#error-alert').show();
    $('.loading').hide();
}
function hideAlert() {
    $('#error-alert').hide();
}

function dispatchRequests(userName, tweetLimit, hashTags) {
    $('.loading').show();
    $('.results').hide();
    var p1 = new Promise(
        function (resolve, reject) {
            checkRequest(userName, tweetLimit, hashTags, resolve, reject);
        }
    )
    p1.then(function (userData) {
        // User exists
        hideAlert();
        insertUserInfo();
        var tweetEmotionsPromise = new Promise((resolve, reject) => {
            fetchTweetsEmotions(userName, tweetLimit, hashTags, resolve, reject);
        });
	console.log("emotions promise! ", tweetEmotionsPromise);
        var tweetKeywordsPromise = new Promise((resolve, reject) => {
            fetchTweetsKeywords(userName, tweetLimit, hashTags, resolve, reject);
        });
	console.log("keywords! ", tweetKeywordsPromise);
        Promise.all([tweetEmotionsPromise,tweetKeywordsPromise]).then(values => {
            console.log(values);
            insertTweets(tweetEmotions.tweets);
            visualizeEmotions(values[0]);
            visualizeKeywords(values[1]);
            // Display results
            $('.results').show();
            $('.loading').hide();
        }).catch(
        function (reason) {
            console.log(reason);
            displayAlert(reason);
        });

    })
        .catch(
        // Log the rejection reason (user doesn't exist')
        function (reason) {
            console.log(reason);
            displayAlert(reason);
        });
}

function fetchTweetsKeywords(userName, tweetLimit, hashTags,resolve,reject) {
    console.log("Fetching interesting keywords from " + userName + " tweets.");
    $.get('/keywords', { user: userName, limit: tweetLimit, tags: hashTags })
        .done(function (data) {
            data = JSON.parse(data);
            if (!data.hasOwnProperty('error')) {
                keyWords = data.keywords
                resolve(keyWords);
                //visualizeKeywords(keyWords);
            }
            else{
                displayAlert("Could not fetch keywords from " + userName);
            }
        })
        .fail(function (xhr) {
            reject("Error fetching keywords from " + userName);
            console.log(xhr);
        });
}

function visualizeKeywords(keywordsResponse) {
    console.log("Visualizing keywords: ", keywordsResponse)
    var dataArray = [["Keyword", "Sentiment Score", { role: "style" }]];

    // Populate dataArray
    keywordsResponse.map(function (keyObj) {
        // Take care of neutrals
        if (keyObj.sentiment.type == "neutral") {
            keyObj.sentiment.score = "0.0"
        }
        // TODO: Take care of mixed?
        var score = parseFloat(keyObj.sentiment.score);
        // Add colors/opacities depending on score
        if (score < 0.0) {
            keyObj.sentiment.color = 'red'//rgbToHex(parseInt(255.0 + 255.0 * score),0,0);
            keyObj.sentiment.opacity = keyObj.relevance;
        }
        else {
            keyObj.sentiment.color = 'blue'//rgbToHex(50,50,parseInt(255.0 * score));
            keyObj.sentiment.opacity = keyObj.relevance;
        }
        // Populate dataArray
        dataArray.push([keyObj.text,
        parseFloat(keyObj.sentiment.score),
        'color: ' + keyObj.sentiment.color + '; ' +
        'opacity: ' + keyObj.sentiment.opacity + ';'
        ])
    })

    var data = google.visualization.arrayToDataTable(dataArray);
    var view = new google.visualization.DataView(data);
    view.setColumns([0, 1,
        {
            calc: "stringify",
            sourceColumn: 1,
            type: "string",
            role: "annotation"
        },
        2]);
    var options = {
        title: user.screen_name + "'s top 10 keywords sentiments",
        height: 600,
        width: 900,
        bar: { groupWidth: "95%" },
        legend: { position: "none" },
	hAxis: {slantedText: true}
    };
    var chart = new google.visualization.ColumnChart(document.getElementById("keyword-chart"));
    chart.draw(view, options);
}

function fetchTweetsEmotions(userName, tweetLimit, hashTags,resolve,reject) {
    console.log("Analyzing " + tweetLimit + " emotional tweets from " + userName);
    $.get('/emotion', { user: userName, limit: tweetLimit, tags: hashTags })
        .done(function (data) {
            tweetEmotions = JSON.parse(data);
	    //console.log("emotions!", tweetEmotions);
            if (!tweetEmotions.hasOwnProperty('error')) {
                //visualizeEmotions(tweetEmotions);
                //insertTweets(tweetEmotions.tweets);
                resolve(tweetEmotions);
            }
            else{
                displayAlert("Could not fetch emotions from " + userName);
            }
        })
        .fail(function (xhr) {
            reject("Error fetching emotions from " + userName);
            console.log(xhr);
        });
}

function visualizeEmotions(emotionsResponse) {
    console.log("Visualizing", emotionsResponse);
    var data = google.visualization.arrayToDataTable([
        ['Emotion', 'Score'],
        ['Anger', parseFloat(emotionsResponse.anger)],
        ['Disgust', parseFloat(emotionsResponse.disgust)],
        ['Fear', parseFloat(emotionsResponse.fear)],
        ['Joy', parseFloat(emotionsResponse.joy)],
        ['Sadness', parseFloat(emotionsResponse.sadness)]
    ]);

    var options = {
        'title':'Emotion Analysis of ' + emotionsResponse.userName + ' tweets',
	'width':900,
	'height':600,
    };

    var chart = new google.visualization.PieChart(document.getElementById('emotion-chart'));

    chart.draw(data, options);
}

function insertUserInfo() {
    document.getElementById("user-profile-pic").src = user.profile_image_url;
    document.getElementById("user-name").innerHTML = user.name;
    document.getElementById("user-screen-name").innerHTML = "@" + user.screen_name;
    document.getElementById("user-description").innerHTML = user.description;
    document.getElementById("user-total-tweets").innerHTML = user.statuses_count;
    document.getElementById("user-followers-count").innerHTML = user.followers_count;
    document.getElementById("user-friends-count").innerHTML = user.friends_count;
    document.getElementById("user-favourites-count").innerHTML = user.favourites_count;
}

function insertTweets() {
    tweets = tweetEmotions.tweets;
    var text = "";
    for (var i = 0; i < tweets.length; i++) {
        text += tweets[i] + "<br><br>";
    }
    document.getElementById("tweets-heading").innerHTML = user.name + "'s tweets:";
    document.getElementById("tweets").innerHTML = text;
}


// Color Ops:
function componentToHex(c) {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}

function rgbToHex(r, g, b) {
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

var texts = ["Loading.", "Loading..", "Loading..."];
var count = 0;
function changeText() {
    $("#loading-dots").text(texts[count]);
    count < 3 ? count++ : count = 0;
}
setInterval(changeText, 500);
