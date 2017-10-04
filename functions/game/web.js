const firebaseInit = require('../firebase-settings.js')
const messengerAPI = require('../API/messengerProfile.js')
const userManagementAPI = require('../API/userManagement.js')
const param = require('jquery-param')
const axios = require('axios')
const db = firebaseInit.admin.database()

/*
	LIST
	
		addNewUserFromWeb
		answerFromWeb

*/

module.exports = function (util, messengerFunctions) {

	let module = {}

	// -----------------------------------------------
	// add new user when user access via Web
	// -----------------------------------------------
	module.addNewUserFromWeb = function (req, res, messenger_env) {
		let uid = req.body.userID // || req.query['xuid']
		let firebaseAuth = req.body.firebaseKey

		if (!uid || !firebaseAuth) res.json({ error: 'no userID or Firebase Auth key' })
		else {
			console.log(`in else ${uid}`)
			axios
				.get(`https://graph.facebook.com/v2.10/${uid}/ids_for_pages`, {
					params: {
						page: '1849513501943443', // DS page ID
						appsecret_proof: messenger_env.proof,
						access_token: messenger_env.access_token,
						include_headers: false
					}
				})
				.then(response => {
					if (response.status == 200) {
						if (response.data.data.length < 1) throw { error: 'This user need to chat on page first', error_code: 5555 }

						let data = response.data.data[0]
						console.log(`data.id : ${data.id}`)
						userManagementAPI.recordNewUserID_FBlogin(uid, data.id, firebaseAuth).then(userData => {
							res.json({
								error: null,
								PSID: userData.PSID,
								firstName: userData.firstName,
								lastName: userData.lastName,
								coupon: userData.coupon
							})
						})
					} else
						res.json({
							error: `response with status code ${response.status}`,
							error_code: `HTTP status code ${response.status}`
						})
				})
				.catch(err => {
					if (err.error_code == 5555) {
						res.json({
							error: err.error,
							error_code: err.error_code
						})
					} else
						res.json({
							error: err.response.data.error.message,
							error_code: err.response.data.error.code
						})
				})
		}
	}


	// -----------------------------------------------
	// check answer for players who play on web
	// -----------------------------------------------
	module.answerFromWeb = function (req, res) {
		let PSID = req.body.PSID
		let answer = req.body.answer
		let normalizedAnswer = answer.trim().toLowerCase() // for string answer

		if (!PSID || !answer) res.json({ error: 'no PSID, answer data found' })
		else {
			let participantInfo = null
			let status = null

			db
				.ref(`participants/${PSID}`)
				.once('value')
				.then(partSnap => {
					participantInfo = partSnap.val()

					if (participantInfo == null) throw `error getting info of participant id : ${PSID}`
					else return util.getStatus()
				})
				.then(fStatus => {
					status = fStatus

					if (!status.playing) throw { code: 1, message: 'quiz not started' }
					else if (!status.canAnswer) throw { code: 1, message: 'quiz timeout' }
					else if (participantInfo.answerPack[status.currentQuiz].ans.length > 0) throw { code: 2, message: 'already answered' }
					else return db.ref(`quiz/${status.currentQuiz}`).once('value') // status.playing && status.canAnswer
				})
				.then(quizSnap => {
					let quiz = quizSnap.val()
					let quizType = quiz.type
					let isCorrect = false

					if (!quiz.type == 'STRING' && !quiz.type == 'CHOICES' && !quiz.type == 'VOTE') throw { code: 2, message: 'what the f with this quiz, it has no choices and not support string answer' }
					else if (quiz.type == 'CHOICES') {
						// if (quiz.choices.indexOf(answer) == -1 ) throw { code: 2, message: 'answer not in choices scope ?!' }
						// else if (answer == quiz.a) isCorrect = true
						if (Array.isArray(quiz.a)) {
							if (quiz.a.indexOf(answer) >= 0) isCorrect = true
						} else {
							if (quiz.a == answer) isCorrect = true
						}
					} else if (quiz.type == 'STRING' && quiz.a.indexOf(normalizedAnswer) > -1) isCorrect = true

					if (isCorrect) {
						participantInfo.answerPack[status.currentQuiz].correct = true
						participantInfo.point++
					}

					participantInfo.answerPack[status.currentQuiz].at = new Date().getTime()
					participantInfo.answerPack[status.currentQuiz].ans = answer

					db
						.ref(`participants/${PSID}/`)
						.set(participantInfo)
						.then(() => {
							console.log(`update participant [${PSID}] answer for quiz no [${status.currentQuiz}] success`)

							res.json({
								error: null,
								message: 'update success'
							})
						})
				})
				.catch(error => {
					console.log(`Error found in [answerFromWeb]: ${error}`)

					if (error.code) {
						console.log(`Error found in [answerFromWeb]: ${JSON.stringify(error)}`)
						res.json({ error: error.code, message: error.message })
					} else res.json({ error: 3, message: error })
				})
		}
	}
	// --------- END HERE

	return module
}
