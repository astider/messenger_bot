let firebase = require('../config/firebase.init.js')
let database = firebase.database()

exports.getAllUsersInfo = function(req, res) {

  let usersInfo = []
  database.ref('/users').once('value')
  .then((snapshot) => {

    let users = snapshot.val()
    for(let key in users) {
      usersInfo.push({
        'id': key,
        'name': users[key].firstName + ' ' + users[key].lastName,
        'gender': users[key].gender,
        'profilePic': users[key].profilePic
      })
    }

    res.json({
      'error': null,
      'usersInfo': usersInfo
    })

  })
  .catch((error)=>{

    console.log(`there's an error [getAllUsersInfo] : ${error}`);
    res.json({
      'error': error,
      'usersInfo': usersInfo
    })

  })

}


exports.getQuestion = function(req, res) {

  let questions = []
  let quizLength = 0

  database.ref('/quiz').once('value')
  .then((snapshot) => {

    let quiz = (snapshot.val())[0]

    res.json({
      quiz: quiz
    })

  })
  .catch((error)=>{
    console.log(`there's an error [getAllQuestions] : ` + error);
    res.json({
      'error': error,
      'questions': questions
    })
  })

}


exports.getVoteResult = function(req, res) {

  let voteArray = votes
  let winner = []
  let maxVote = ''
  let maxCount = 0

  for(let key in voteArray) {

    if(voteArray[key].length > maxCount) {
      maxCount = voteArray[key].length
      maxVote = key
      winner = voteArray[key]
    }

  }

  database.ref('/users').once('value')
  .then((snapshot) => {

    let users = snapshot.val()
    let tempVoteResult = winner
    winner = []

    tempVoteResult.forEach((key)=> {
      winner.push({
        'id': key,
        'name': users[key].firstName + ' ' + users[key].lastName,
        'gender': users[key].gender,
        'profilePic': users[key].profilePic
      })
    })

    res.json({
      'error': null,
      'result': maxVote,
      'count': maxCount
      'winner': winner
    })

  })
  .catch((error)=>{

    console.log(`there's an error [getVoteResult] : ${error}`);
    res.json({
      'error': error
    })

  })

}
