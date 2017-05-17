//let express = require('express')
let ejs = require('ejs');
//let express =
let quizControl = require('../controllers/quizControl.controller.js')
let quizResult = require('../controllers/quizResult.controller.js')
let quizInput = require('../controllers/quizInput.controller.js')
let quizAPIsV2 = require('../controllers/quizAPIsV2.controller.js')
let quizAPIs = require('../controllers/quizAPIs.controller.js')
let index = require('../controllers/index.cotnroller.js')

let bodyParser = require("body-parser");
let urlencodedParser = bodyParser.urlencoded({
 extended: true
});
let jsonParser = bodyParser.json();

/*
let allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', "http://localhost:3000, https://dsmbot.herokuapp.com, https://messengerchatbot-f6775.firebaseapp.com");
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Origin, Content-Type');

    next();
}
*/

module.exports = function(app, express) {

  app.set('views', './app/views');
  app.set('view engine', 'ejs');

  let allowedHeader = ["http://localhost:3000", "https://dsmbot.herokuapp.com", "https://messengerchatbot-f6775.firebaseapp.com"]
  app.use(function(req, res, next) {

    var origin = req.get('origin');
    //console.log(req.session);
    if (origin) {
      console.log(`origin: ${origin}, ....... ${JSON.stringify(origin)}`);
     if (allowedHeader.indexOf(origin) > -1){
      res.header("Access-Control-Allow-Origin", "*")
     }
     else{
     return res.status(403).end();
     }
    }

    res.header('Access-Control-Allow-Methods', 'OPTIONS, GET, PUT, POST, DELETE');
    res.header("Access-Control-Allow-Headers", "Origin, Content-Type");

    console.log(`res.header = ${res.header}`);
    console.log(`req.method = ${req.method}`);
    if ('OPTIONS' == req.method) {
     return res.status(200).end();
    }

    next();

  })

  //app.use(allowCrossDomain)
  app.use(express.static('public'))



  app.get("/", quizControl.getControlInterface)
  app.get("/info", index.getIndexPage)
  app.get("/policy", index.getPolicyPage)
  app.get("/result/", quizResult.getResult)
  //app.get("/addquiz", quizInput.addQuiz)addQuizV2
  app.get("/addquiz", quizInput.addQuizV2)


  app.get("/getAllStatus", quizControl.getAllStatus)
  app.get("/justStartTheQuiz", quizControl.startQuiz)
  app.get("/activateQ", quizControl.activateQ)
  app.get("/closeAnswerTime", quizControl.endAnswerTime)
  app.get("/endQuizNow", quizControl.endQuizNow)
  app.get("/changeReadyToStart", quizControl.changeReadyToStart)
  app.get("/changeEnterStatus", quizControl.changeEnterStatus)
  app.get("/controlRoom", quizControl.getControlInterface)

  // API for front-end
  app.get("/getAllSingleUsers", quizAPIs.getAllSingleUsers)
  app.get("/getCorrectUsers", quizAPIs.getCorrectUsersInfo)
  app.get("/getAllUsersInfo", quizAPIs.getAllUsersInfo)
  app.get("/getAllParticipantsInfo", quizAPIs.getAllParticipantsInfo)
  app.get("/getAllQuestions", quizAPIs.getAllQuestions)
  app.get("/getParticipantsScoreObject", quizAPIs.getParticipantsScoreObject)
  app.get("/getParticipantsScore", quizAPIs.getParticipantsScore)

  app.get("/v2/getRecentVotes", quizAPIsV2.getRecentVotes)
  app.get("/v2/getVoteResult", quizAPIsV2.getVoteResult)
  app.get("/v2/getQuestion", quizAPIsV2.getQuestion)
  app.get("/v2/getAllUsersInfo", quizAPIsV2.getAllUsersInfo)

  //app.post("/processQuizForm", jsonParser, urlencodedParser, quizInput.processForm)
  app.post("/processQuizForm", jsonParser, urlencodedParser, quizInput.processFormV2)

  app.get("/*", (req, res) => { res.render("404") } )

}
