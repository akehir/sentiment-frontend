var port = (process.env.VCAP_APP_PORT || 3000);
var express = require("express");
var mongoClient = require("mongodb").MongoClient;
var os = require("os-utils");


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


// Database Connection
var mongo = {};
var dbAnalyzedCollection	= "currentlyAnalyzing";
var dbKeywordsCollection	= "keywords";

if (process.env.VCAP_SERVICES) {
    var env = JSON.parse(process.env.VCAP_SERVICES);
    console.log(env);

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
		Called by AngularJS application
		Delivers JSON with current sentiment analysis results
	*/
	var collection = myDb.collection(dbAnalyzedCollection);
	collection.find().toArray(function(err, docs) {
        res.json(docs);
      });

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
		Called by AngularJS application
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
		Called by AngularJS application
		Deletes phrase from monitoring.
	*/
	var phrase = req.params.phrase;
	
	var collection = myDb.collection(dbKeywordsCollection);
	collection.find({phrase: phrase}).toArray(function(err, docs) {
		if (docs.length > 0) {
			collection.remove({phrase: phrase});
	    	console.log("Removed phrase " + phrase + ".");
	    } else {
	    	console.log("Error: Phrase " + phrase + " not found.");
	    }
        res.send(200);			
      });
});


app.listen(port);
console.log("Server listening on port " + port);
