let firebase = require('../config/firebase.init.js')
let database = firebase.database()


exports.addQuiz = function(req, res) {
  res.render("addquiz")
}

exports.addQuizV2 = function(req, res) {
  res.render("addquiz2")
}

exports.processForm = function(req, res) {

  console.log('processform');

  let tempNum = 0
  let q = []
  let choices = []
  let length = req.body.numbers

  for(let i = 1; i <= length; i ++) {

    choices = []
    for(let j = 1; j <= 4; j++) {
      choices.push(req.body[`q${i}c${j}`])
    }

    q.push({
      'a': req.body[`q${i}ans`],
      'q': req.body[`q${i}`],
      'choices': choices
    })

  }

  database.ref("/participants").set([])
  database.ref("/quiz").set(q)
  res.send('บันทึกชุดคำถามเรียบร้อย')

}


exports.processFormV2 = function(req, res) {

  console.log('processform');

  let q = []
  let choices = []
  let length = req.body.numbers

  choices = []
  for(let j = 1; j <= 4; j++) {
    choices.push(req.body[`q1c${j}`])
  }

  q.push({
    'a': req.body[`q1ans`],
    'q': req.body[`q1`],
    'choices': choices
  })

  //database.ref("/participants").set([])
  database.ref("/quiz").set(q)
  res.send('บันทึกชุดคำถามเรียบร้อย')

}
