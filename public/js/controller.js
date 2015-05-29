var app = angular.module('sentiment', []);

app.controller('myCtrl', function($scope, $http, $timeout) {

    $scope.addPressed = function() {
    	$http.post('/sentiment', {phrase: $scope.addTerm}).
		  success(function(data, status, headers, config) {
		    refresh();
		  });

        $scope.addTerm = "";
    };

    $scope.infoPressed = function(sentiment) {

        $scope.infoModalStartDate = moment().subtract(1, 'days').format("DD-MM-YYYY");
        $scope.infoModalEndDate = moment().format("DD-MM-YYYY");

        $scope.startDate = $scope.infoModalStartDate;
        $scope.endDate = $scope.infoModalEndDate;

        reloadSentiment(sentiment.phrase, $scope.infoModalStartDate, $scope.infoModalEndDate);
    };

    $scope.infoModalRefresh = function() {
        console.log("Refresh Info Modal");

        $scope.infoModalStartDate = $scope.startDate;
        $scope.infoModalEndDate = $scope.endDate;
    };

    $scope.removePressed = function(sentiment) {
        $http.delete('/sentiment/' + sentiment.phrase).success(function (data, status) {
            console.log("Deleted phrase "+ sentiment.phrase);    
        });
    };

    var reloadSentiment = function(phrase, startDate, endDate) {

        $http.get('/sentiment/'+phrase+'/'+startDate+'/'+endDate).success(function(data) {

            var phrase          = data.phrase;
            var tweets          = data.tweets;
            var totalsentiment  = data.totalsentiment;
            var score           = data.score;
            score = (score !== null ? score.toFixed(2) : score);
            var emoji           = getEmojiForScore(score);
            var latestTweets    = data.latestTweets;
            var history         = data.history;

            for (var j = 0; j < latestTweets.length; j++) {
                var entry = latestTweets[j];
                entry.emoji = getEmojiForScore(entry.score);
            }

            var rows = [];

            for (var j = 0; j < history.length; j++) {
                var entry = history[j];
                entry.date  = moment(entry.date).format("DD-MM-YYYY");
                entry.score = (entry.score !== null ? entry.score.toFixed(2) : entry.score);
                entry.emoji = getEmojiForScore(entry.score);

                rows.push([j, entry.score]);
            }

            var sentiment = {
                phrase:         phrase,
                tweets:         tweets,
                totalsentiment: totalsentiment,
                score:          score,
                emoji:          emoji,
                latestTweets:   latestTweets,
                history:        history 
            };

            $scope.selectedPhrase = sentiment;
        });
    };

    var refresh = function() {

        console.log($scope.selectedPhrase.phrase);
        if ($scope.selectedPhrase.phrase != null) {
            reloadSentiment($scope.selectedPhrase.phrase, $scope.infoModalStartDate, $scope.infoModalEndDate);
        }

    	$http.get('/sentiment').success(function(data) {

    		var sentiments = [];
            var totalTweets = data.tweets;

            var rawSentiments = data.sentiments;

            for (var i = 0; i < rawSentiments.length; i++) {

                var phrase          = rawSentiments[i].phrase;
                var tweets          = rawSentiments[i].tweets;
                var totalsentiment  = rawSentiments[i].totalsentiment;
                var score           = rawSentiments[i].score;
                score = (score !== null ? score.toFixed(2) : score);
                var emoji           = getEmojiForScore(score);
                var latestTweets    = rawSentiments[i].latestTweets;

                for (var j = 0; j < latestTweets.length; j++) {
                    var entry = latestTweets[j];
                    entry.emoji = getEmojiForScore(entry.score);
                }

                var sentiment = {
                    phrase:         phrase,
                    tweets:         tweets,
                    totalsentiment: totalsentiment,
                    score:          score,
                    emoji:          emoji,
                    latestTweets:   latestTweets 
                };

                sentiments.push(sentiment);
            }

            $scope.sentiments = sentiments;
		    $scope.totalPhrases = sentiments.length;
            $scope.totalTweets = totalTweets;
		  });

        $http.get('/usage').success(function(data) {
            $scope.memUsed = Math.round(data.memUsed);
            $scope.memTotal = Math.round(data.memTotal);
            $scope.cpuLoad = Math.round(data.cpuLoad * 100);
        });
    };

    var poll = function() {
        $timeout(function() {
            refresh();
            poll();
        }, 1000);
    };


    $scope.totalTerms = 0;
    $scope.totalTweets = 0;
    $scope.sentiments = [];

    $scope.startDate = moment().subtract(1, 'days').format("DD-MM-YYYY");
    $scope.endDate = moment().format("DD-MM-YYYY");
    $scope.today = moment().format("dd, DD-MM-YYYY");

    $scope.selectedPhrase = {phrase: null};
    $scope.infoModalStartDate = null;
    $scope.infoModalEndDate = null;

    refresh();
   	poll();
});

function getEmojiForScore(score) {
    switch (true) {
        case (score === null):
            emoji = "❔";
            break;
        case (score <  0.15):
            emoji = "😡";
            break;
        case (score >= 0.15 && score < 0.30):
            emoji = "😠";
            break;
        case (score >= 0.30 && score < 0.45):
            emoji = "😕";
            break;
        case (score >= 0.45 && score < 0.55):
            emoji = "😶";
            break;
        case (score >= 0.55 && score < 0.70):
            emoji = "😄";
            break;
        case (score >= 0.70 && score < 0.85):
            emoji = "😘";
            break;
        case (score >= 0.85):
            emoji = "😍";
            break;                   
    }

    return emoji;
}