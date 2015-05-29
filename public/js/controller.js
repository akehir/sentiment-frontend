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
        $scope.selectedPhrase = sentiment;
    };

    $scope.removePressed = function(sentiment) {
        $http.delete('/sentiment/' + sentiment.phrase).success(function (data, status) {
            console.log("Deleted phrase "+ sentiment.phrase);    
        });
    };

    var refresh = function() {
    	$http.get('/sentiment').success(function(data) {
    		var sentiments = [];
            var totalTweets = 0;

            for (var i = 0; i < data.length; i++) {

                var phrase          = data[i].phrase;
                var tweets          = data[i].tweets;
                var totalsentiment  = data[i].totalsentiment;
                var score           = data[i].score;
                score = (score !== null ? score.toFixed(2) : score);
                var emoji           = getEmojiForScore(score);
                var history         = data[i].history;

                for (var j = 0; j < history.length; j++) {
                    var entry = history[j];
                    entry.emoji = getEmojiForScore(entry.score);
                }

                var sentiment = {
                    phrase:         phrase,
                    tweets:         tweets,
                    totalsentiment: totalsentiment,
                    score:          score,
                    emoji:          emoji,
                    history:        history 
                };

                totalTweets += data[i].tweets;
                sentiments.push(sentiment);

                if (sentiment.phrase == $scope.selectedPhrase.phrase) {
                    $scope.selectedPhrase = sentiment;
                }
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

    $scope.selectedPhrase = {phrase: null};

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