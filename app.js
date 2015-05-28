var port = (process.env.VCAP_APP_PORT || 3000);
var express = require("express");
var mongoClient = require("mongodb").MongoClient;
var os = require("os-utils");
var moment = require('moment');


// defensiveness against errors parsing request bodies...
process.on('uncaughtException', function (err) {
	console.log('Caught exception: ' + err.stack);
});

// Configure the app web container
var app = express();
app.configure(function() {
	app.use(express.bodyParser());
	app.use(express.static(__dirname + '/public'));
});


// Thresholds
var averageUpperBound =  1.3;
var averageLowerBound = -1.3;
var scoreUpperBound   =  1.0;
var scoreLowerBound   =  0.0;


// Database Connection
var mongo = {};
var dbResultsCollection			= "results";
var dbServerUsageCollection		= "serverusage";
var dbKeywordsCollection		= "keywords";

if (process.env.VCAP_SERVICES) {
    var env = JSON.parse(process.env.VCAP_SERVICES);

    if (env['mongodb-2.4']) {
        mongo['url'] = env['mongodb-2.4'][0]['credentials']['url'];
    }

    console.log("Mongo URL:" + mongo.url);
} else {
   console.log("No VCAP Services!");
}


var myDb;
var mongoConnection = mongoClient.connect(mongo.url, function(err, db) {
  if(!err) {
    console.log("Connection to mongoDB established");
    myDb = db;
  } else {
  	console.log("Failed to connect to database!");
  }
});



// REST API
app.get('/sentiment', function (req, res) {
	/*
		Delivers all phrases with score of last day
	*/
	var result = [];

	var keywordsCollection = myDb.collection(dbKeywordsCollection);

	// var currentTime = new Date();

	// var startDate  = currentTime.toISOString();
	// var endDate  = new Date(new Date().setDate(new Date().getDate()-5))

	var startDate = moment().startOf('day');
	var endDate = moment().startOf('day').subtract(1, 'days');

	console.log(startDate + " --- " + endDate);

	keywordsCollection.find().toArray(function(err, docs) {
		for (var i = 0; i < docs.length; i++) {
			var sentiment = getSentimentForPhrase(docs.phrase, startDate, endDate);
			result.push(sentiment);
		}

        res.json(result);
      });

});

app.get('/sentiment/:phrase/:startDate/:endDate', function (req, res) {
	/*
		Delivers JSON with results for specific dates
	*/

	var phrase = req.params.phrase;
	var startDate = req.params.startDate;
	var endDate = req.params.endDate;

	var sentiment = getSentimentForPhrase(phrase, startDate, endDate);
	res.json(sentiment);
});

app.get('/usage', function (req, res) {
	/*
		Called by AngularJS application
		Delivers JSON with current CPU/memory etc. usage
	*/

	os.cpuUsage(function(v){
	    res.json({
			memUsed: (os.totalmem() - os.freemem()),
			memTotal: os.totalmem(),
			cpuLoad: v
		});
	});

});

app.post('/sentiment', function (req, res) {
	/*
		Adds new phrase for monitoring.
	*/
	try {
		if (req.body.phrase) {

			var phrase = req.body.phrase;
			
			var collection = myDb.collection(dbKeywordsCollection);
			collection.find({phrase: phrase}).toArray(function(err, docs) {
				if (docs.length > 0) {
		        	console.log("Error: Phrase " + phrase + " already exists.");
			    } else {
			    	collection.insert({phrase: phrase});
			    	console.log("Added phrase " + phrase + ".");
			    }
		        res.send(200);
		      });

		} else {
			res.status(400).send('Invalid request: send {"phrase": "ibm"}');		
		}
	} catch (exception) {
		res.status(400).send('Invalid request: send {"phrase": "ibm"}');
	}
});

app.delete('/sentiment/:phrase', function (req, res) {
	/*
		Deletes phrase from monitoring.
	*/
	var phrase = req.params.phrase;
	
	var keywordsCollection = myDb.collection(dbKeywordsCollection);
	keywordsCollection.find({phrase: phrase}).toArray(function(err, docs) {
		if (docs.length > 0) {
			keywordsCollection.remove({phrase: phrase});
	    	console.log("Removed phrase " + phrase + ".");
	    } else {
	    	console.log("Error: Phrase " + phrase + " not found.");
	    }
        res.send(200);			
      });
});


app.listen(port);
console.log("Server listening on port " + port);



//Functions
function getSentimentForPhrase(phrase, startDate, endDate) {

	var resultsCollection = myDb.collection(dbResultsCollection);
	resultsCollection.find({phrase: phrase, date: {'$gte': startDate,'$lt': endDate}}).sort({date: -1}).toArray(function(err, docs) {

		var tweets = 0;
		var totalsentiment = 0;
		var history = [];

		for (var i = 0; i<docs.length; i++) {
			var entry = docs[i];

			tweets++;
			totalsentiment += entry.sentiment;

			if(i < 5) {
				var tweet = {
					text: entry.text,
					sentiment: entry.sentiment
				};
				history.push(tweet);
			}
		}

		var average = totalsentiment / tweets;

		// Limit average to bounds
		if (average > averageUpperBound) average = averageUpperBound;
		if (average < averageLowerBound) average = averageLowerBound;
		
		// Map average to score between 0 and 1
		var score = ((average - averageLowerBound) / (averageUpperBound - averageLowerBound)) * (scoreUpperBound - scoreLowerBound) + scoreLowerBound;

		return {
				phrase: phrase,
				tweets: tweets,
				totalsentiment: totalsentiment,
				average: average,
				score: score,
				history: history
			};
	});
}
