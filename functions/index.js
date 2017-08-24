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

let util = {
	getFireQuizAt: _getFireQuizAt,
	getParticipants: _getParticipants,
	getQuiz: _getQuiz,
	getStatus: _getStatus
}

let messengerFunctions = {
	sendTextMessage: sendTextMessage,
	sendCascadeMessage: sendCascadeMessage,
	sendQuickReplies: sendQuickReplies,
	sendBatchMessage: sendBatchMessage
}

const httpsFunctions = require('./httpsTriggered.js')(util, messengerFunctions)

console.log('STARTING SERVICE')

// ----------------------- Cloud Functions ------------------------

function _getParticipants () {
	return db.ref('participants').once('value')
}

function _getQuiz () {
	return db.ref('quiz').once('value')
}

function _getFireQuizAt () {
	return db.ref('fireQuizAt').once('value')
}

function _getAdmin () {
	return db.ref('admin').once('value')
}

function _getStatus () {
	
	return new Promise((resolve, reject) => {
		let canEnter = false
		let playing = false
		let canAnswer = false
		let currentQuiz = -1

		db.ref('canEnter').once('value').then(ce => {
			canEnter = ce.val()
			return db.ref('canAnswer').once('value')
		})
		.then(ca => {
			canAnswer = ca.val()
			return db.ref('playing').once('value')
		})
		.then(pl => {
			playing = pl.val()
			return db.ref('currentQuiz').once('value')
		})
		.then(cq => {
			currentQuiz = cq.val()
			let status = {
				canEnter: canEnter,
				canAnswer: canAnswer,
				playing: playing,
				currentQuiz: currentQuiz
			}

			return resolve(status)
		})
		.catch(error => {
			return reject(error)
		})
	})

}

/*
exports.addCoupon = functions.https.onRequest((req, res) => {

	db.ref('users').once('value')
	.then(us => {
		let users = us.val()

		for (let key in users) {
			users[key].coupon = 0
		}

		return db.ref('users').set(users)

	})
	.then(() => {
		res.send('success')
	})
	.catch(error => {
		console.log(`error testChecker: ${error}`)
		res.send('failed')
	})

})
*/

// ------------------------------

exports.testViewSharedPosts = functions.https.onRequest(function (req, res) {
	if (req.method != 'GET') {
		return res.status(403).json({})
	}
	if (!req.query.pageID || !req.query.postID) {
		return res.status(400).json({})
	}
	testFunction.getSharedPostsByApp(req.query.pageID, req.query.postID, req, res)
})


exports.hookerYOLOitsMeMessengerChatYO = functions.https.onRequest((req, res) => {
	if (req.method == 'GET') {
		// console.log('GET Requested')
		if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === env.messenger.verify_token) {
			// console.log("Validating webhook")
			res.status(200).send(req.query['hub.challenge'])
		} else {
			console.error('Failed validation. Make sure the validation tokens match.')
			res.sendStatus(403)
		}
	} else if (req.method == 'POST') {
		let data = req.body

		// Make sure this is a page subscription
		if (data.object === 'page') {
			// Iterate over each entry - there may be multiple if batched
			data.entry.forEach(function (entry) {
				let pageID = entry.id
				let timeOfEvent = entry.time
				console.log(`page id [${pageID}] , TOE ${timeOfEvent}`)

				// Iterate over each messaging event
				entry.messaging.forEach(function (event) {
					if (event.message) {
						receivedMessage(event)
						// } else if (event.delivery) {
						//	console.log(`Message delivered to ${event.sender.id}`)
					} else {
						if (event.postback && event.postback.payload == 'userPressedGetStartedButton') {

							console.log(`receive get started action from ${event.sender.id}`)
							addNewUser(event.sender.id)

							let welcomeText = `ยินดีต้อนรับเข้าสู่เกมแชทชิงโชค จันทร์นี้ 2 ทุ่ม เพียงตอบคำถามขั้นต่ำ 3 ข้อ ทาง youtube.com/droidsans ก็มีสิทธิ์ร่วมลุ้นรับเครื่อง galaxy Note 8 ฟรี! 
							กติกาอ่านเพิ่มเติมได้ที่ https://droidsans.com/chatchingchoke-august-note8/
							อย่าลืมเข้ามาร่วมสนุกกับพวกเรานะ`

							sendTextMessage(event.sender.id, welcomeText)

						}
						else if (event.postback && event.postback.payload == 'checkMyCoupon') {

							let id = event.sender.id

							db.ref('users').orderByChild('fbid').equalTo(id).once('value')
							.then(userInfo => {

								let userObject = userInfo.val()
								let user = null
								if (userObject && Object.keys(userObject).length > 0) {
									
									user = userObject[Object.keys(userObject)[0]]
									let couponCount = user.coupon

									let couponText = `ขณะนี้คุณมีคูปองสะสมรวม ${couponCount} คูปอง`

									sendTextMessage(id, couponText)

								}

							})
							.catch(error => {
								console.error(`error getting coupon info for user : ${error}`)
							})

						}
						else console.log(`Webhook Unknown Event: ${JSON.stringify(event)}`)
					}
				})
			})

			// Assume all went well.
			//
			// You must send back a 200, within 20 seconds, to let us know
			// you've successfully received the callback. Otherwise, the request
			// will time out and we will keep trying to resend.
			res.sendStatus(200)
		}
	}
})

// -------------------- WEB API

exports.addNewUserFromWeb = functions.https.onRequest((req, res) => {
	cors(req, res, () => {
		httpsFunctions.addNewUserFromWeb(req, res, env.messenger)
	})
})

exports.answerFromWeb = functions.https.onRequest((req, res) => {
	cors(req, res, () => {
		httpsFunctions.answerFromWeb(req, res)
	})
})

// ---------------------------------------------------------------

exports.getQuizStatus = functions.https.onRequest((req, res) => {
	cors(req, res, () => {
		httpsFunctions.getOverallStatus(req, res)
	})
})

exports.getParticipants = functions.https.onRequest((req, res) => {
	cors(req, res, () => {
		httpsFunctions.getParticipants(req, res)
	})
})

exports.showRandomCorrectUsers = functions.https.onRequest((req, res) => {
	cors(req, res, () => {
		httpsFunctions.showRandomCorrectUsers(req, res)
	})
})

exports.getTopUsers = functions.https.onRequest((req, res) => {
	cors(req, res, () => {
		httpsFunctions.getTopUsers(req, res)
	})
})

exports.sendRequest = functions.https.onRequest((req, res) => {
	cors(req, res, () => {
		httpsFunctions.sendRequest(req, res)
	})
})

exports.addQuiz = functions.https.onRequest((req, res) => {
	cors(req, res, () => {
		httpsFunctions.addQuiz(req, res)
	})
})

exports.sendResult = functions.https.onRequest((req, res) => {
	cors(req, res, () => {
		httpsFunctions.sendResult(req, res)
	})
})

exports.restart = functions.https.onRequest((req, res) => {
	cors(req, res, () => {
		httpsFunctions.restart(req, res)
	})
})

exports.readLog = functions.https.onRequest((req, res) => {
	cors(req, res, () => {
		httpsFunctions.readLog(req, res)
	})
})

exports.sendCoupon = functions.https.onRequest((req, res) => {
	cors(req, res, () => {
		httpsFunctions.sendCoupon(req, res)
	})
})

exports.sendCouponUpdate = functions.https.onRequest((req, res) => {
	cors(req, res, () => {
		httpsFunctions.updateCouponBalanceToUsers(req, res)
	})
})

exports.findMe = functions.https.onRequest((req, res) => {
	cors(req, res, () => {
		// 1432315113461939 nontapat
		// 1124390080993810 robert
		db.ref('users').orderByChild('fbid').equalTo('1124390080993810').once('value')
		.then(obj => {
			res.json(obj.val())
		})
		.catch(error => {
			console.log(`error: ${error}`)
			res.json({
				error: error
			})
		})

	})
})


exports.sendQuiz = functions.https.onRequest((req, res) => {
	cors(req, res, () => {
		let status = null
		let participants = null
		let quiz = null
		let fireQuizAt = null

		_getStatus()
			.then(fetchedStatus => {
				status = fetchedStatus
				return _getFireQuizAt()
			})
			.then(fqaSnapshot => {
				fireQuizAt = fqaSnapshot.val()
				return _getParticipants()
			})
			.then(participantsSnapshot => {
				participants = participantsSnapshot.val()
				return _getQuiz()
			})
			.then(quizSnapshot => {
				quiz = quizSnapshot.val()

				if (!status.playing) db.ref('playing').set(true)

				if (!quiz)
					res.json({
						error: 'quiz not ready, try again later',
						quiz: quizSnapshot.val()
					})
				else if (!participants) res.json({ error: 'no participants, try again later' })
				else {
					let oldc = status.currentQuiz
					if (req.query.next == 'true' && status.currentQuiz < quiz.length) {
						db.ref('currentQuiz').set(status.currentQuiz + 1)
						status.currentQuiz += 1
						console.log(`update currentQuiz to ${oldc + 1} // is it : ${status.currentQuiz}`)
					}

					if (status.currentQuiz > quiz.length - 1 || status.currentQuiz < 0)
						res.json({
							error: 'quiz no. out of bound',
							currentQuiz: status.currentQuiz,
							suggestion: "if this is the first question don't forget to use ?next=true param"
						})
					else {
						let quickReplyChoices = []
						let answerTime = req.query.timer ? parseInt(req.query.timer) + 10 : 70

						db.ref('answerWindow').set(answerTime)

						// check if this quiz has choices
						if (quiz[status.currentQuiz].choices) {
							quickReplyChoices = quiz[status.currentQuiz].choices.map(choice => {
								return {
									content_type: 'text',
									title: choice,
									payload: choice
								}
							})
						}

						// ---------- start preparing batch request

						let sendQuizBatch = []

						Object.keys(participants).forEach(id => {
							let quizBodyData = {
								recipient: {
									id: id
								},
								message: {
									text: quiz[status.currentQuiz].q
								}
							}

							// if chocies prepared, add choices to quick replies button
							if (quickReplyChoices.length > 0) {
								quizBodyData.message.quick_replies = quickReplyChoices
							}

							sendQuizBatch.push({
								method: 'POST',
								relative_url: 'me/messages?include_headers=false',
								body: param(quizBodyData)
							})
						})

						if (!fireQuizAt) fireQuizAt = Array(quiz.length).fill(0)

						if (fireQuizAt[status.currentQuiz] == 0) {
							fireQuizAt[status.currentQuiz] = new Date().getTime()

							db
								.ref('fireQuizAt')
								.set(fireQuizAt)
								.then(() => {
									return db.ref('canAnswer').set(true)
								})
								.then(() => {
									console.log('sync SENDING')
									sendBatchMessage(sendQuizBatch)

									res.json({
										error: null,
										qno: status.currentQuiz,
										q: quiz[status.currentQuiz].q,
										choices: quiz[status.currentQuiz].choices
									})
								})
						} else {
							db.ref('canAnswer').set(true).then(() => {
								console.log('sync SENDING / not set new FQA')
								sendBatchMessage(sendQuizBatch)

								res.json({
									error: null,
									qno: status.currentQuiz,
									q: quiz[status.currentQuiz].q,
									choices: quiz[status.currentQuiz].choices
								})
							})
						}
					}
				}
			})
			.catch(error => {
				console.log(`there's an error in sendQuiz: ${error}`)
				res.end()
			})
	})
})

// ------------------- Messenger Function

function sendBatchMessage (reqPack) {
	// REQUEST FORMAT (reqPack must be array of data like this)
	/*

		let bodyData = {
			recipient: {
				id: user.fbid
			},
			message: {
				text: `สวัสดี ${user.firstName} ทดสอบอีกที`
			}
		}

		requests.push({
			method: 'POST',
			relative_url: 'me/messages?include_headers=false',
			body: param(bodyData)
		})
	*/

	// batch allow 50 commands per request, read this : https://developers.facebook.com/docs/graph-api/making-multiple-requests/
	let batchLimit = 50
	for (let i = 0; i < reqPack.length; i += batchLimit) {
		FB.batch(reqPack.slice(i, i + batchLimit), (error, res) => {
			if (error) {
				console.log(`\n batch [${i}] error : ${JSON.stringify(error)} \n`)
			} else {
				console.log(`batch [${i}] / no error : `)
				let time = new Date()
				let date = time.getFullYear() + '-' + (time.getMonth() + 1) + '-' + time.getDate()
				let epochTime = time.getTime()

				res.forEach(response => {
					db.ref(`batchLogs/${date}/${epochTime}`).push().set(response['body'])
					console.log(response['body'])
				})
			}
		})
	}
}

function sendQuickReplies (recipientId, quickReplies) {
	let messageData = {
		recipient: {
			id: recipientId
		},
		message: quickReplies
	}
	callSendAPI(messageData)
}

function sendTextMessage (recipientId, messageText) {
	let messageData = {
		recipient: {
			id: recipientId
		},
		message: {
			text: messageText // ,
			// metadata: "DEVELOPER_DEFINED_METADATA"
		}
	}

	callSendAPI(messageData)
}

function callSendAPI (messageData) {
	// console.log(`message data : ${JSON.stringify(messageData)}`)
	axios({
		method: 'POST',
		url: 'https://graph.facebook.com/v2.6/me/messages',
		params: {
			access_token: env.messenger.page_token
		},
		data: messageData
	})
		.then(res => {
			if (res.status == 200) {
				let body = res.data
				let recipientId = body.recipient_id
				let messageId = body.message_id

				if (messageId) {
					console.log('Successfully sent message with id %s to recipient %s', messageId, recipientId)
				} else {
					console.log('Successfully called Send API for recipient %s', recipientId)
				}
			} else {
				console.log(`Failed calling Send API ${res.status} / ${res.statusText} / ${res.data.error}`)
			}
		})
		.catch(error => {
			console.log('send API : ')
			console.log(`${error}`)
		})
}

function sendCascadeMessage (id, textArray) {
	textArray
		.reduce((promiseOrder, message) => {
			return promiseOrder.then(() => {
				// console.log(message)
				sendTextMessage(id, message)
				return new Promise(res => {
					setTimeout(res, 1000)
				})
			})
		}, Promise.resolve())
		.then(
			() => console.log('send cascade message DONE!'),
			error => {
				console.log(`reduce error : ${error} `)
			}
		)
}

function addNewUser (newUserId) {
	console.log('enter addNewUser')
	let userProfile = null

	userManagementAPI.recordNewUserID(newUserId)
	messengerAPI.sendTypingOn(newUserId)
	console.log('added user /// sending message back')
	messengerAPI
		.callProfileAPI(newUserId)
		.then(profile => {
			userProfile = profile
			return _getStatus()
		})
		.then(status => {
			if (status.playing || status.canEnter) {
				let inviteMessage = {
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

				setTimeout(() => {
					sendQuickReplies(newUserId, inviteMessage)
				}, 1000)
			} else {
				let texts = [
					`สวัสดี คุณ ${userProfile.first_name} ${userProfile.last_name}`,
					// 'ขณะนี้ แชทชิงโชค ยังไม่เริ่ม ถ้าใกล้ถึงช่วงเวลาของกิจกรรมแล้วทางเราจะติดต่อกลับไปนะ'
					// 'สัปดาห์นี้แชทชิงโชคเปลี่ยนเวลา จะเริ่มวันอังคารที่ 15 เวลา 2 ทุ่มครับ'
					// 'แชทชิงโชคประจำสัปดาห์นี้จะเริ่ม วันนี้เวลา 2 ทุ่มนะ อย่าลืมมาร่วมสนุกกับพวกเราล่ะ ;)'
					'แชทชิงชิงครั้งหน้า วันจันทร์ที่ 28 สิงหาคม เวลา 2 ทุ่ม ครั้งสุดท้ายแล้วก่อนจับรางวัล Galaxy Note8 อย่าลืมมาร่วมเล่นกับพวกเรานะ ;)'
				]

				sendCascadeMessage(newUserId, texts)
			}
		})
		.catch(error => {
			console.log(`addnewuser error : ${error}`)
		})
}

function receivedMessage (event) {
	let senderID = event.sender.id
	let recipientID = event.recipient.id
	let timeOfMessage = event.timestamp
	let message = event.message

	console.log('Received message for user %d and page %d at %d with message:', senderID, recipientID, timeOfMessage)
	console.log(JSON.stringify(message))

	// let messageId = message.mid
	let messageText = message.text
	let messageQRPayload = message.quick_reply ? message.quick_reply.payload : 'noValue'
	// let getStartedPayload =
	let messageAttachments = message.attachments

	// ------- USER ANSWER
	let status = null
	let playerInfo = null
	// let allUsers = null
	let quiz = null
	let adminAvaiability = false
	let admins = null

	_getAdmin()
		.then(snapshot => {
			admins = snapshot.val()

			if (Object.keys(admins).length > 0) {
				if (admins[senderID]) adminAvaiability = true
			}

			// console.log(`admin : ${JSON.stringify(admins)}`)
			return _getStatus()
		})
		.then(fetchedStatus => {
			status = fetchedStatus
			return _getQuiz()
		})
		.then(quizSnapshot => {
			quiz = quizSnapshot.val()
			return db.ref(`participants/${senderID}`).once('value') // _getParticipants()
		})
		.then(playerSnapshot => {
			playerInfo = playerSnapshot.val()
			return db.ref('users').orderByChild('fbid').equalTo(senderID).once('value') // db.ref('users').once('value')
		})
		.then(fetchedUsers => {
			let userObject = fetchedUsers.val()
			let user = null
			if (userObject && Object.keys(userObject).length > 0) user = userObject[Object.keys(userObject)[0]]

			/*
			for (let key in users) {
				allUsers[users[key].fbid] = {
					fullName: users[key].firstName + ' ' + users[key].lastName,
					firstName: users[key].firstName,
					lastName: users[key].lastName,
					profilePic: users[key].profilePic
				}
			}
			*/
			console.log('________________________________')
			console.log(`_______ ${JSON.stringify(status)} ______`)
			console.log('________________________________')
			// ----------------------------------------------------------------------------------------

			// console.log(`USER PAYLOAD = ${messageQRPayload}`)

			if (messageQRPayload != 'เข้าร่วม' && messageQRPayload != 'ไม่เข้าร่วม' && status.playing && status.currentQuiz > -1 && status.currentQuiz < quiz.length && playerInfo) {
				console.log('in answer validation process')

				// idea is : if stringAnswer is true => use messageText else check payload
				// current quiz need to be answered with text
				if (quiz[status.currentQuiz].stringAnswer) {
					console.log('hello from inside string answer')

					if (!status.canAnswer) sendTextMessage(senderID, 'หมดเวลาตอบข้อนี้แล้วจ้า')
					else if (playerInfo.answerPack[status.currentQuiz].ans) sendTextMessage(senderID, 'คุณได้ตอบคำถามข้อนี้ไปแล้วนะ')
					else if (messageQRPayload == 'noValue') {
						let lowerCasedAnswer = messageText.toLowerCase()

						let confirmAns = {
							text: `ยืนยันคำตอบเป็น "${messageText}" ?\r\nหากต้องการเปลี่ยนคำตอบให้พิมพ์ใหม่ได้เลย`,
							quick_replies: [
								{
									content_type: 'text',
									title: 'ยืนยัน',
									payload: lowerCasedAnswer
								}
							]
						}

						sendQuickReplies(senderID, confirmAns)
					} else {
						sendTextMessage(senderID, 'ได้คำตอบแล้วจ้า~')

						playerInfo.answerPack[status.currentQuiz].ans = messageQRPayload
						playerInfo.answerPack[status.currentQuiz].at = new Date().getTime()

						if (quiz[status.currentQuiz].a.indexOf(messageQRPayload) > -1) {
							playerInfo.answerPack[status.currentQuiz].correct = true
							playerInfo.point++
						}

						db.ref(`participants/${senderID}`).set(playerInfo)
					}
				} else if (quiz[status.currentQuiz].choices.indexOf(messageQRPayload) > -1) {
					// current quiz use choices
					console.log('hello from inside CHOICE answer')

					if (!status.canAnswer) sendTextMessage(senderID, 'หมดเวลาตอบข้อนี้แล้วจ้า')
					else if (playerInfo.answerPack[status.currentQuiz].ans) sendTextMessage(senderID, 'คุณได้ตอบคำถามข้อนี้ไปแล้วนะ')
					else {
						sendTextMessage(senderID, 'ได้คำตอบแล้วจ้า~')

						playerInfo.answerPack[status.currentQuiz].ans = messageQRPayload
						playerInfo.answerPack[status.currentQuiz].at = new Date().getTime()

						if (messageQRPayload == quiz[status.currentQuiz].a) {
							playerInfo.answerPack[status.currentQuiz].correct = true
							playerInfo.point++
						}

						db.ref(`participants/${senderID}`).set(playerInfo)
					}
				} else if (playerInfo.answerPack[status.currentQuiz].ans) sendTextMessage(senderID, 'คุณได้ตอบคำถามข้อนี้ไปแล้วนะ')
				else if (!status.canAnswer) sendTextMessage(senderID, 'หมดเวลาตอบข้อนี้แล้วจ้า')
				else {
					sendTextMessage(senderID, 'พิมพ์ตอบจะไม่ได้คะแนนนะ กดตอบเอา')

					let quickReplyChoices = []

					quickReplyChoices = quiz[status.currentQuiz].choices.map(choice => {
						return {
							content_type: 'text',
							title: choice,
							payload: choice
						}
					})

					let quizMessage = {
						text: quiz[status.currentQuiz].q,
						quick_replies: quickReplyChoices
					}

					setTimeout(() => {
						sendQuickReplies(senderID, quizMessage)
					}, 1000)
				}
			} else if (messageQRPayload == 'เข้าร่วม' && !playerInfo && status.canEnter) {
				// ------- USER ENTER
				// console.log(`in the khaoruam // id : ${senderID}`)

				// console.log(`in the khaoruam // allID : ${JSON.stringify(allUsers)}`)

				// if(!participants[senderID]) {
				let answerTemplate = Array(quiz.length).fill({
					ans: '',
					correct: false,
					at: 0
				})

				let tempParticipant = {
					point: 0,
					answerPack: answerTemplate,
					firstName: user.firstName,
					lastName: user.lastName,
					profilePic: user.profilePic
				}

				console.log(`new parti: ${user.firstName}`)
				db.ref(`participants/${senderID}`).set(tempParticipant)

				if (status.playing && status.canAnswer) {
					let quizMessage = {
						text: quiz[status.currentQuiz].q,
						quick_replies: quiz[status.currentQuiz].choices.map(choice => {
							return {
								content_type: 'text',
								title: choice,
								payload: choice
							}
						})
					}

					sendQuickReplies(senderID, quizMessage)
				} else {
					// sendTextMessage(senderID, 'โอเค~ รออีกแป๊บนะ กิจกรรมใกล้จะเริ่มแล้ว')
					// 			let texts = [
					// 				'ยินดีต้อนรับเข้าสู่เกม "แชทชิงโชค" โปรดรอคำถามจาก facebook Live',
					// 				`กติกาการแข่งขัน ผู้ที่สะสมคะแนนได้สูงสุดใน 3 อันดับแรกของแต่ละวัน จะได้รับของรางวัลจากทางรายการ
					// แต้มจะไม่สามารถสะสมข้ามสัปดาห์ได้ และการตัดสินของกรรมการจะถือเป็นที่สิ้นสุด

					// ทีมงานและครอบครัวไม่สามารถร่วมเล่นเกมและรับของรางวัลได้`
					// 			]

					let texts = [
						'แชทชิงโชค วันนี้ใครจะได้รางวัลประจำสัปดาห์ 3 รางวัลไป และเดือนนี้ลุ้นรางวัลใหญ่ Galaxy Note 8\r\n',
						'กติกาเพิ่มเติมอ่านได้ที่ https://droidsans.com/chatchingchoke-august-note8/\r\n',
						'สามารถรับชม Live ได้ผ่านทาง https://youtu.be/yRHTbynL__4 \r\n\r\n',
						`ขณะนี้คุณมีคูปองอยู่ ${user.coupon} คูปอง เราขอให้คุณโชคดีกับแชทชิงโชค :)`
					]

					sendCascadeMessage(senderID, texts)
				}
				/*
      }
      else {
        console.log(`Already has this user in participants`)
      }
*/
			} else if (messageQRPayload == 'ไม่เข้าร่วม' && !playerInfo) {
				sendTextMessage(senderID, 'ถ้าเปลี่ยนใจก็ทักมาได้นะ')
			} else if (messageText) {
				// ------- USER MESSAGE NORMALLY
				// console.log('IN get message')
				// If we receive a text message, check to see if it matches a keyword
				// and send back the example. Otherwise, just echo the text we received.
				if (adminAvaiability) {
					console.log(`admin check return true : ${adminAvaiability} `)

					if (admins[senderID]) {
						// sendTextMessage(senderID, 'you are an admin')
						let splitted = messageText.split(':: ')

						if (splitted.length <= 1) {
							sendTextMessage(senderID, '## ERROR!! INVALID COMMAND SYNTAX')
						} else {
							console.log('to run command')

							let command = splitted[0]
							let text = splitted[1]

							if (command == 'ANN_ALL') {
								console.log(`running command [${command}]`)
								let batchRequests = []

								db.ref('users').once('value').then(userSnap => {
									let allUsers = userSnap.val()

									Object.keys(allUsers).forEach(key => {
										let bodyData = {
											recipient: {
												id: allUsers[key].fbid
											},
											message: {
												text: text
											}
										}

										batchRequests.push({
											method: 'POST',
											relative_url: 'me/messages?include_headers=false',
											body: param(bodyData)
										})
										// sendTextMessage(id, text)
									})

									sendBatchMessage(batchRequests)
									// tell admin that message was sent
									sendTextMessage(senderID, '## Message sent to ALL USERS')
								})
							} else if (command == 'ANN_PART') {
								console.log(`running command [${command}]`)
								let batchRequests = []

								db.ref('participants').once('value').then(partSnap => {
									let participants = partSnap.val()

									if (participants) {
										Object.keys(participants).forEach(id => {
											let bodyData = {
												recipient: {
													id: id
												},
												message: {
													text: text
												}
											}

											batchRequests.push({
												method: 'POST',
												relative_url: 'me/messages?include_headers=false',
												body: param(bodyData)
											})

											// sendTextMessage(id, text)
										})

										sendBatchMessage(batchRequests)
										// tell admin that message was sent
										sendTextMessage(senderID, '## Message sent to ALL PARTICIPANTS')
									} else {
										sendTextMessage(senderID, '## ERROR!! PARTICIPANTS not found.')
									}
								})
							} else {
								sendTextMessage(senderID, '## ERROR!! COMMAND NOT FOUND')
							}
						}
					}
				} else if (!user || !playerInfo) {
					console.log('user id not found in DB {OR} not in participants -> adding new user')
					setTimeout( addNewUser(senderID), 1500)
				} else if (!status.playing && !status.canEnter) {
					console.log('this user is in our sigth, but game is end or not started yet, tell the user!')
					sendTextMessage(senderID, 'ขณะนี้ แชทชิงโชค ยังไม่เริ่ม ถ้าใกล้ถึงช่วงเวลาของกิจกรรมแล้วทางเราจะติดต่อกลับไปนะ')
				} else {
					// else if(!participants)
					if (status.playing) {
						if (!status.canAnswer) {
							sendTextMessage(senderID, 'หมดเวลาตอบข้อนี้แล้วจ้า')
						} else if (playerInfo && playerInfo.answerPack[status.currentQuiz].ans) {
							sendTextMessage(senderID, 'คุณได้ตอบคำถามข้อนี้ไปแล้วนะ')
						} else {
							sendTextMessage(senderID, 'พิมพ์ตอบจะไม่ได้คะแนนนะ กดตอบเอา')

							let quickReplyChoices = []

							quickReplyChoices = quiz[status.currentQuiz].choices.map(choice => {
								return {
									content_type: 'text',
									title: choice,
									payload: choice
								}
							})

							let quizMessage = {
								text: quiz[status.currentQuiz].q,
								quick_replies: quickReplyChoices
							}

							setTimeout(() => {
								sendQuickReplies(senderID, quizMessage)
							}, 1000)
						}
					} else if (status.canEnter) sendTextMessage(senderID, 'รอสักครู่นะ กิจกรรมยังไม่เริ่ม')
				}
			} else if (messageAttachments) {
				console.log(JSON.stringify(message))
				console.log('Message with attachment received')

				if (!user || !playerInfo) {
					console.log('user id not found in DB {OR} not in participants -> adding new user')
					setTimeout( addNewUser(senderID), 1500)
				}
			}

			// ----------------------------------------------------------------------------------------
		})
		.catch(error => {
			console.error(`there's an error in receiving message: ${error}`)
		})
}

// ------------------------ TIMER  -------------------------

// this approach has problem with rapidly fire quiz
// so, don't do it
exports.answerGap = functions.database.ref('canAnswer').onWrite(event => {
	let canAnswer = event.data.val()
	console.log(`canAnswer was changed to : ${canAnswer} `)

	if (canAnswer) {
		db
			.ref('answerWindow')
			.once('value')
			.then(awSnap => {
				let gap = awSnap.val()
				console.log(`cuz canAnswer is [${canAnswer}] -> set [${gap}] seconds timer `)

				setTimeout(() => {
					db.ref('canAnswer').set(false)
					console.log('_______________________')
					console.log("NOW YOU CAN'T ANSWER ME")
				}, gap * 1000)
			})
			.catch(error => {
				console.log(`get answer gap error in answerGap trigerr: ${error} `)
			})
	}
})
