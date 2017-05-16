require('dotenv').config();
const Botmaster = require('botmaster')
const express = require('express');
const https = require('https');
const http = require('http');
const fetch = require('node-fetch')
const port = process.env.PORT || 3002;
//const app = express();

let app = express()
//module.exports = app;

require('./app/config/express.js')(app, express)

let weatherAPI = require('./app/apis/weather.api.js')
let messengerProfileAPI = require('./app/apis/messenger_profile.api.js')
let userMgt = require('./app/controllers/userManagement.controller.js')
let firebase = require('./app/config/firebase.init.js')
let database = firebase.database()
//let firebase = require('firebase')

// quiz management variable
quiz = null
//enterTime = false
//openedAtLeastOneTime = false
isQuizOnline = false
readyToStart = false
isQuizEnd = false
canAnswer = false
isLastQuestion = false

//quizReady = null // will be assigned as ARRAY

//let correctUser = []

app.listen(port, () => {
  console.log('Express app started on port ' + port);
});

const messengerSettings = {
  credentials: {
    verifyToken: process.env.vToken,
    pageToken: process.env.pageToken,
    fbAppSecret: process.env.appSecret,
  },
  webhookEndpoint: process.env.hookPlace,
  // botmaster will mount this webhook on https://Your_Domain_Name/messenger/webhook1234
};
const botsSettings = [{
    messenger: messengerSettings
}];
const botmasterSettings = {
    botsSettings,
    app
};

const botmaster = new Botmaster(botmasterSettings);
const messengerBot = new Botmaster.botTypes.MessengerBot(messengerSettings);
botmaster.addBot(messengerBot)

let allIDs = []
let usersWhoVoted = []
votes = []

database.ref(`/users`).on('child_added', (childSnapshot, prevChildKey) => {

  let userID = childSnapshot.key
  console.log(userID + ' added');

  if(allIDs.indexOf(userID) < 0) {

    allIDs.push(userID)

    if(!isQuizOnline) {
      messengerBot.sendTextMessageTo(`สวัสดีจ้า มารอร่วมโหวตบูธที่อยากให้ทาง Droidsans ไปดูกันนะ`, userID)
    }

    if(isQuizOnline && canAnswer) {

      let buttons = []
      quiz.choices.forEach((choice) => {
        buttons.push({
          'content_type': 'text',
          'title': choice,
          'payload': choice
        })
        console.log('choice = ' + choice);
      })

      messengerBot.sendMessageTo({text: quiz[currentQuiz].q, quick_replies: buttons}, userID)
    }

  }
  else console.log('already have this id');

})

database.ref(`/quiz`).on('value', (snapshot)=>{

  if(isQuizOnline) {
    quiz = (snapshot.val())[0]
    usersWhoVoted = []
    votes = []
    shootTheQuestion(quiz, isLastQuestion)
  }
  else console.log('quiz added when system is not ready to be played')

})

// -------------------------------------------------------------------------

botmaster.on('update', (bot, update) => {

  if(update.message) {

    // if new user -> add to DB
    userMgt.checkDupID(update.sender.id)
    .then((isDup)=>{
      console.log('THEDUP: '+isDup);
      if(!isDup) {

        let id = update.sender.id
        userMgt.recordNewUserID(id)
        //allIDs.push(id)

      }
      else console.log('already have this id');

    })
    .catch((err)=>{
      console.log('serv check dup error : '+err);
    })

    if(isQuizOnline && update.message.quick_reply) {

      if(update.message.quick_reply.payload) {

        try {

          let ans = update.message.quick_reply.payload

          let replyText = ['ได้รับข้อมูลแล้วจ้า', 'รอลุ้นกันว่ามีคนคิดเหมือนกันเยอะมั้ย', 'มารอลุ้นกันนะ', 'คนอื่นจะเลือกเหมือนกันมั้ยน้า~', 'มาดูกันว่าพี่พัดน้องเก่งจะได้ไปดูที่ไหนต่อกัน']
          let dupReplyText = ['คุณโหวตมาแล้ว โหวตซ้ำไม่ได้นะ', 'ไม่เอา ไม่โหวตซ้ำสิ ได้ครั้งเดียวนะ', 'โหวตได้ครั้งเดียวนะ รอรอบต่อไปละกัน', 'โหวตมาแล้วเปลี่ยนใจไม่ได้นะ']

          if(usersWhoVoted.indexOf(update.sender.id) < 0) {

            console.log('user id ', update.sender.id, ans)
            usersWhoVoted.push(update.sender.id)

            if(canAnswer) {
              console.log(votes);
              votes[ans].push(update.sender.id)
              bot.sendTextMessageTo(replyText[Math.floor(Math.random() * 5)], update.sender.id)
            }
            else bot.sendTextMessageTo('มาช้าไปหน่อยนะ หมดเวลาโหวตข้อนี้แล้วจ้า', update.sender.id)

          }
          else bot.sendTextMessageTo(dupReplyText[Math.floor(Math.random() * 4)], update.sender.id)

        }
        catch(error) {
          console.log(`answer incoming error : ${error}`)
        }


      }

      //}
      //else bot.sendTextMessageTo('wronggg!', update.sender.id);

    } else if(update.message.quick_reply) {

      let ans = update.message.quick_reply.payload
      console.log('got payload from quick reply : \n');
      console.log(ans);

    } else if(update.message.attachments) {

      if(update.message.attachments.length > 0)
        if(update.message.attachments[0].payload.sticker_id == "369239263222822")
          bot.sendTextMessageTo('(y)', update.sender.id)

    }

  }
  else if(update.postback){

    console.log('___enter postback');
    console.log(JSON.stringify(update));

    if(update.postback.payload == "userPressedGetStarted") {

      // if new user -> add to DB
      userMgt.checkDupID(update.sender.id)
      .then((isDup)=>{
        console.log('THEDUP: '+isDup);
        if(!isDup) {

          let id = update.sender.id
          userMgt.recordNewUserID(id)
          allIDs.push(id)

        }
        else console.log('already have this id');

      })
      .catch((err)=>{
        console.log('serv check dup error : '+err);
      })

    }

  }

});


console.log('started');


function shootTheQuestion(quiz, isLastQuestion) {
  //bot.sendTextMessageTo(quiz[currentQuiz].q, update.sender.id);
  canAnswer = true

  let buttons = []
  quiz.choices.forEach((choice) => {

    buttons.push({
      'content_type': 'text',
      'title': choice,
      'payload': choice
    })

    votes.push({
      choice: []
    })
    console.log('choice = ' + choice);
  })

  let msg = {
    text: quiz.q,
    quick_replies: buttons
  }

  allIDs.map((id)=>{
    //messengerBot.sendAttachmentTo(buttonTemplate, id)
    messengerBot.sendMessageTo(msg, id)
    //messengerBot.sendDefaultButtonMessageTo(buttons, id, quiz[currentQuiz].q)
  })

  if(isLastQuestion) {

    let checkEnding = setInterval(()=>{
      //setTimeout( function() {
      console.log(`waiting for ending command : ${isQuizEnd}`);
      if(isQuizEnd) {
        clearInterval(checkEnding)
        allIDs.map((id)=>{
          messengerBot.sendTextMessageTo('กิจกรรมจบแล้ว ขอบคุณทุกท่านที่มาร่วมเล่นกับเรา :D', id)
        })
      }

    }, 5000)

  }

}

//console.log(quiz.length);
//-----------------------------------------------------------------------------

let quizRequested = false
let checkStart = null

database.ref(`/participants`).set([])
database.ref('quiz').once('value')
.then((snapshot)=>{
  quiz = snapshot.val()
  console.log(`quiz: ${quiz}, ${quiz[0]}`);
  quizRequested = true
})

checkStart = setInterval(()=>{
  console.log('readyToStart : ' + readyToStart);
  if(readyToStart && quizRequested) startQuiz()
}, 7000)


function startQuiz() {

  clearInterval(checkStart)
  shootTheQuestion(quiz[0], isLastQuestion)
  isQuizOnline = true

}

//-----------

let nodeSchedule = require('node-schedule');
let rerunner = nodeSchedule.scheduleJob('*/10 * * * *', function(){
  console.log('running');
});
