var port = (process.env.VCAP_APP_PORT || 3000);
var express = require("express");
var sentiment = require('sentiment');
var twitter = require('ntwitter');

var DEFAULT_TOPIC = "IBM";

// defensiveness against errors parsing request bodies...
process.on('uncaughtException', function (err) {
	console.log('Caught exception: ' + err.stack);
});

var app = express();
// Configure the app web container
app.configure(function() {
	app.use(express.bodyParser());
	app.use(express.static(__dirname + '/public'));
});

// Twitter keys registered for url: http://sentimentanalysis-demo-akehir.eu-gb.mybluemix.net/
// Created at: https://dev.twitter.com/apps
var tweeter = new twitter({
	consumer_key: 'Wr7nCnCWW6K9VTc8BZFkmfRp4',
	consumer_secret: 'z1yZAinkZwnGiAAICgmU8RRYdUaQ1L9JnL6SGG8oipMF9rEFzt',
	access_token_key: '72076928-DJyqqtOMpyFbpkLdBvIob3DfDarSeulSGZCdKvWU2',
	access_token_secret: 'xkfNyQvB9DqIMK6sqgaTo7t7Jd5xUf3WH67wdT5NzpmPj'
});

app.get('/twitterCheck', function (req, res) {
	tweeter.verifyCredentials(function (error, data) {
		res.send("Hello, " + data.name + ".  I am in your twitters.");
	});
});


var tweetCount = 0;
var tweetTotalSentiment = 0;
var monitoringPhrase;

var averageUpperBound =  1.3;
var averageLowerBound = -1.3;
var scoreUpperBound   =  1.0;
var scoreLowerBound   =  0.0;

app.get('/sentiment', function (req, res) {
	/*
		Called by AngularJS application
		Delivers JSON with current sentiment analysis results

		TODO: Deliver actual sentiment data,
		extend for multiple phrases
	*/

	if(monitoringPhrase !== undefined) {

		// Needs to be replaced with all monitored phrases.
		// Sentiments array maybe better globally?
		// Score calculation maybe better done during processing twitter stream?
		var sentiments = [
				{
					phrase: 		monitoringPhrase,
					tweets: 		tweetCount,
					totalsentiment:	tweetTotalSentiment
				},
				{
					phrase: 		'Mockphrase',
					tweets: 		47,
					totalsentiment: 42
				},
				{
					phrase: 		'Mockphrase2',
					tweets: 		357,
					totalsentiment: -285
				},
				{
					phrase: 		'Mockphrase3',
					tweets: 		123,
					totalsentiment: -155
				},
				{
					phrase: 		'Mockphrase4',
					tweets: 		552,
					totalsentiment: 568
				}
			];

		// Calculate mapped score from sentiment average
        for (var i = 0; i < sentiments.length; i++) {
        	var sentiment = sentiments[i];

			// Calculate average
			var average = sentiment.totalsentiment / sentiment.tweets;

			// Limit average to bounds
			if (average > averageUpperBound) average = averageUpperBound;
			if (average < averageLowerBound) average = averageLowerBound;
			
			// Map average to score between 0 and 1
			var score = ((average - averageLowerBound) / (averageUpperBound - averageLowerBound)) * (scoreUpperBound - scoreLowerBound) + scoreLowerBound;

			sentiment.score = score;
		}

		res.json(sentiments);

	} else {
		res.json([]);
	}

	// res.json({monitoring: (monitoringPhrase !== null), 
	// 	monitoringPhrase: monitoringPhrase,
	// 	tweetCount: tweetCount,
	// 	tweetTotalSentiment: tweetTotalSentiment,
	// 	sentimentImageURL: sentimentImage()});
});

app.get('/history', function (req, res) {
	/*
		Called by AngularJS application
		Delivers JSON with history sentiment analysis results from database

		TODO: Implement function
	*/

	var sentiments = [
			{
				phrase:  'Mockphrase',
				history: [
					{
						date: 			"2015-03-29T18:25:43.511Z", 
						tweets: 		47,
						totalsentiment: 42,
						score: 			0.95, 
					},
					{
						date: 			"2015-03-28T18:25:43.511Z", 
						tweets: 		345,
						totalsentiment: 200,
						score: 			0.725, 
					},
					{
						date: 			"2015-03-27T18:25:43.511Z", 
						tweets: 		704,
						totalsentiment: -100,
						score: 			0.154, 
					}
				] 
			}
		];

	res.json(sentiments);
});

app.get('/usage', function (req, res) {
	/*
		Called by AngularJS application
		Delivers JSON with current CPU/memory etc. usage

		TODO: Implement function
	*/

	res.json({});
});


app.post('/sentiment', function (req, res) {
	/*
		Called by AngularJS application
		Adds new phrase for monitoring.
	*/
	try {
		if (req.body.phrase) {
			beginMonitoring(req.body.phrase);
			res.send(200);			
		} else {
			res.status(400).send('Invalid request: send {"phrase": "ibm"}');		
		}
	} catch (exception) {
		res.status(400).send('Invalid request: send {"phrase": "ibm"}');
	}
});

app.delete('/sentiment/:phrase', function (req, res) {
	/*
		Called by AngularJS application
		Deletes phrase from monitoring.

		TODO:
		Implement whole functionality.
	*/

	console.log("Delete request of " + req.params.phrase);
	res.send(200);
});





function resetMonitoring() {
	monitoringPhrase = "";
}

function beginMonitoring(phrase) {
	/*
		TODO:
		This function should start monitoring of phrase
		and add data to database
	*/

	var stream;
	// cleanup if we're re-setting the monitoring
	if (monitoringPhrase) {
		resetMonitoring();
	}
	monitoringPhrase = phrase;
	tweetCount = 0;
	tweetTotalSentiment = 0;
	tweeter.verifyCredentials(function (error, data) {
		if (error) {
			return "Error connecting to Twitter: " + error;
		} else {
			stream = tweeter.stream('statuses/filter', {
				'track': monitoringPhrase
			}, function (stream) {
				console.log("Monitoring Twitter for " + monitoringPhrase);
				stream.on('data', function (data) {
					// only evaluate the sentiment of English-language tweets
					if (data.lang === 'en') {
						sentiment(data.text, function (err, result) {
							tweetCount++;
							tweetTotalSentiment += result.score;
						});
					}
				});
			});
			return stream;
		}
	});
}

function sentimentImage() {
	var avg = tweetTotalSentiment / tweetCount;
	if (avg > 0.5) { // happy
		return "/images/excited.png";
	}
	if (avg < -0.5) { // angry
		return "/images/angry.png";
	}
	// neutral
	return "/images/content.png";
}

app.get('/old', function (req, res) {
	/*
		Old plain HTML functionality.
	*/
	var welcomeResponse = "<HEAD>" +
		"<title>Twitter Sentiment Analysis</title>\n" +
		"</HEAD>\n" +
		"<BODY>\n" +
		"<P>\n" +
		"Welcome to the Twitter Sentiment Analysis app.<br>\n" + 
		"What would you like to monitor?\n" +
		"</P>\n" +
		"<FORM action=\"/monitor\" method=\"get\">\n" +
		"<P>\n" +
		"<INPUT type=\"text\" name=\"phrase\" value=\"" + DEFAULT_TOPIC + "\"><br><br>\n" +
		"<INPUT type=\"submit\" value=\"Go\">\n" +
		"</P>\n" + "</FORM>\n" + "</BODY>";
	if (!monitoringPhrase) {
		res.send(welcomeResponse);
	} else {
		var monitoringResponse = "<HEAD>" +
			"<META http-equiv=\"refresh\" content=\"5; URL=http://" +
			req.headers.host +
			"/old\">\n" +
			"<title>Twitter Sentiment Analysis</title>\n" +
			"</HEAD>\n" +
			"<BODY>\n" +
			"<P>\n" +
			"The Twittersphere is feeling<br>\n" +
			"<IMG align=\"middle\" src=\"" + sentimentImage() + "\"/><br>\n" +
			"about " + monitoringPhrase + ".<br><br>" +
			"Analyzed " + tweetCount + " tweets...<br>" +
			"</P>\n" +
			"<P>" +tweetTotalSentiment/tweetCount+ "</P>\n" +
			"<A href=\"/reset\">Monitor another phrase</A>\n" +
			"</BODY>";
		res.send(monitoringResponse);
	}
});

app.get('/testSentiment', function (req, res) {
	var response = "<HEAD>" +
		"<title>Twitter Sentiment Analysis</title>\n" +
		"</HEAD>\n" +
		"<BODY>\n" +
		"<P>\n" +
		"Welcome to the Twitter Sentiment Analysis app.  What phrase would you like to analyze?\n" +
		"</P>\n" +
		"<FORM action=\"/testSentiment\" method=\"get\">\n" +
		"<P>\n" +
		"Enter a phrase to evaluate: <INPUT type=\"text\" name=\"phrase\"><BR>\n" +
		"<INPUT type=\"submit\" value=\"Send\">\n" +
		"</P>\n" +
		"</FORM>\n" +
		"</BODY>";
	var phrase = req.query.phrase;
	if (!phrase) {
		res.send(response);
	} else {
		sentiment(phrase, function (err, result) {
			response = 'sentiment(' + phrase + ') === ' + result.score;
			res.send(response);
		});
	}
});

app.get('/monitor', function (req, res) {
	/*
		Old plain HTML implementation.
	*/
	beginMonitoring(req.query.phrase);
	res.redirect(302, '/');
});

app.get('/reset', function (req, res) {
	/*
		Old plain HTML implementation.
	*/
	resetMonitoring();
	res.redirect(302, '/');
});

app.get('/hello', function (req, res) {
	/*
		Not necessary ;-)
	*/
	res.send("Hello world.");
});

app.get('/watchTwitter', function (req, res) {
	var stream;
	var testTweetCount = 0;
	var phrase = 'ibm';
	// var phrase = 'ice cream';
	tweeter.verifyCredentials(function (error, data) {
		if (error) {
			res.send("Error connecting to Twitter: " + error);
		}
		stream = tweeter.stream('statuses/filter', {
			'track': phrase
		}, function (stream) {
			res.send("Monitoring Twitter for \'" + phrase + "\'...  Logging Twitter traffic.");
			stream.on('data', function (data) {
				testTweetCount++;
				// Update the console every 50 analyzed tweets
				if (testTweetCount % 50 === 0) {
					console.log("Tweet #" + testTweetCount + ":  " + data.text);
				}
			});
		});
	});
});

app.listen(port);
console.log("Server listening on port " + port);
