const FB = require('fbgraph')
const axios = require('axios')
const param = require('jquery-param')
const firebaseInit = require('./firebase-settings.js')

const functions = firebaseInit.functions
const admin = firebaseInit.admin
const env = firebaseInit.env
const db = admin.database()

const messengerAPI = require('./API/messengerProfile.js')
const userManagementAPI = require('./API/userManagement.js')
const testFunction = require('./placeHolder.js')
const cors = require('cors')({
	origin: ['http://localhost:3000', 'https://codelab-a8367.firebaseapp.com', 'https://chatchingchoke.club']
})

FB.setAccessToken(env.messenger.page_token)


module.exports = function (util, messengerFunctions) {
	
	let module = {}

	// ------------------------ TIMER  -------------------------

	// this approach has problem with rapidly fire quiz
	// so, don't do it
	module.answerGap = function (event) {

		let canAnswer = event.data.val()
		console.log(`canAnswer was changed to : ${canAnswer} `)
	
		if (canAnswer) {

			db.ref('answerWindow').once('value')
			.then(awSnap => {
				let gap = awSnap.val()
				console.log(`cuz canAnswer is [${canAnswer}] -> set [${gap}] seconds timer `)
	
				setTimeout(() => {
					return db.ref('canAnswer').set(false)
				}, gap * 1000)
			})
			.then(() => {
				console.log('_______________________')
				console.log("NOW YOU CAN'T ANSWER ME")
			})
			.catch(error => {
				console.log(`get answer gap error in answerGap trigerr: ${error} `)
			})

		}

	}

	module.voting = function (event) {

		let currentQuiz = event.data.val()
		
		if (currentQuiz >= 0) {
		
			db.ref(`quiz/${currentQuiz}`).once('value')
			.then(qSnap => {
				let quizInfo = qSnap.val()
				if (quizInfo.type == 'VOTE') {
					
					db.ref('voting').set(true)
					.then(() => {
						console.log(`running ${quizInfo.type} question, set 'voting' to TRUE`)
					})
				
				} else {
				
					db.ref('voting').set(false)
					.then(() => {
						console.log(`running ${quizInfo.type} question, set 'voting' to FALSE`)
					})
				}

			})
			.catch(error => {
				console.error(`found error is voting onWrite: ${error}`)
			})
				
		} 

	}

	// ------------
	return module
}
