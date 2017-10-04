const firebaseInit = require('../firebase-settings.js')
const messengerAPI = require('../API/messengerProfile.js')
const userManagementAPI = require('../API/userManagement.js')
const param = require('jquery-param')
const axios = require('axios')
const db = firebaseInit.admin.database()

/*
	LIST
	
		sendRequest
		addQuiz
		sendResult
		restart


*/

module.exports = function (util, messengerFunctions) {

	let module = {}

	// -----------------------------------------------
	// send invite to join upcoming game
	// -----------------------------------------------
	module.sendRequest = function (req, res) {
		db.ref('canEnter').set(true)

		userManagementAPI
			.getAllSubscribedID()
			.then(allID => {
				let sendRequestBatch = []

				allID.forEach(id => {
					let inviteMessage = {
						recipient: { id: id },
						message: {
							text: 'แชทชิงโชค กำลังจะเริ่มในไม่ช้า ต้องการเข้าร่วมเล่นด้วยหรือไม่?',
							quick_replies: [
								{
									content_type: 'text',
									title: 'เข้าร่วม',
									payload: 'เข้าร่วม'
								},
								{
									content_type: 'text',
									title: 'ไม่เข้าร่วม',
									payload: 'ไม่เข้าร่วม'
								}
							]
						}
					}

					sendRequestBatch.push({
						method: 'POST',
						relative_url: 'me/messages?include_headers=false',
						body: param(inviteMessage)
					})

					// sendQuickReplies(id, inviteMessage)
				})

				messengerFunctions.sendBatchMessage(sendRequestBatch)
				// messengerFunctions.sendBatchMessageWithDelay2(sendRequestBatch, 200)

				res.json({
					error: null,
					text: 'everything is fine... I guess ?'
				})
			})
			.catch(error => {
				res.json({
					error: error,
					text: 'shit happens'
				})
			})
	}

	// -----------------------------------------------
	// add new quiz
	// -----------------------------------------------
	module.addQuiz = function (req, res) {

		if (req.method == 'POST') {
			db.ref('quiz').set(req.body.quiz)
		}

		res.json({
			error: null
		})

	}

	// -----------------------------------------------
	// send score result
	// -----------------------------------------------
	module.sendResult = function (req, res) {

		db.ref('canAnswer').set(false)
		db.ref('canEnter').set(false)
		db.ref('playing').set(false)

		let participants = null

		util
			.getParticipants()
			.then(participantsSnapshot => {
				participants = participantsSnapshot.val()

				let sendResultRequests = []
				Object.keys(participants).forEach(id => {
					let bodyData = {
						recipient: {
							id: id
						},
						message: {
							text: `กิจกรรมจบแล้ว ยินดีด้วย คุณได้คะแนนรวม ${participants[id].point} คะแนน สำหรับคูปองนั้นทางเราจะคำนวณและแจกให้ผู้เข้าร่วมกิจกรรมที่ทำตามเงื่อนไขนะ`
						}
					}

					sendResultRequests.push({
						method: 'POST',
						relative_url: 'me/messages?include_headers=false',
						body: param(bodyData)
					})
				})

				messengerFunctions.sendBatchMessage(sendResultRequests)

				res.json({
					error: null
				})
			})
			.catch(error => {
				console.log(`there's an error in sendResult: ${error}`)
				res.end()
			})
	}

	// -----------------------------------------------
	// restart game
	// -----------------------------------------------
	module.restart = function (req, res) {
		db.ref('currentQuiz').set(-1)
		db.ref('canEnter').set(false)
		db.ref('canAnswer').set(false)
		db.ref('playing').set(false)
		db.ref('participants').set(null)
		db.ref('fireQuizAt').set(null)

		res.json({
			error: null
		})
	}

	// --------- END HERE

	return module
}
