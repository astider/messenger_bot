const firebaseInit = require('./firebase-settings.js')
const messengerAPI = require('./API/messengerProfile.js')
const userManagementAPI = require('./API/userManagement.js')
const param = require('jquery-param')
const axios = require('axios')
const messengerTemplates = require('./FBMessageTemplate/templates.js')
const db = firebaseInit.admin.database()
let GMTOffset = 7 * 60 * 60 * 1000
const FB = require('fbgraph')
const env = firebaseInit.env
FB.setAccessToken(env.messenger.page_token)

function _getTesters() {
	return db.ref('tester').once('value')
}

function sendBatchMessageWithDelay2(reqPack, delay) {
	//
	// FB API call by page is tied to page rating...
	//
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
	let maxIncre = Math.ceil(reqPack.length / batchLimit)

	for (let i = 0; i < maxIncre; i++) {
		;(function(i) {
			setTimeout(function() {
				console.log(`sending batch ${i + 1}/${maxIncre}`)
				console.log(`slicing is ${i * 50}/${i * 50 + batchLimit} from all of ${reqPack.length}`)
				FB.batch(reqPack.slice(i * 50, i * 50 + batchLimit), (error, res) => {
					if (error) {
						// console.log(`\n batch [${i}] error : ${JSON.stringify(error)} \n`)
						console.log(`\n batch [${i}] error`)
					} else {
						console.log(`batch [${i}] / no error : `)
						let time = new Date()
						let date = time.getFullYear() + '-' + (time.getMonth() + 1) + '-' + time.getDate()
						let epochTime = time.getTime()

						res.forEach(response => {
							db
								.ref(`batchLogs/${date}/${epochTime}`)
								.push()
								.set(response['body'])
							console.log(response['body'])
						})
					}
				})
			}, delay * (i + 1))
		})(i)
	}
}

function sendQuickReplies(recipientId, quickReplies) {
	let messageData = {
		recipient: {
			id: recipientId
		},
		message: quickReplies
	}
	callSendAPI(messageData)
}

function sendTextMessage(recipientId, messageText) {
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

function callSendAPI(messageData) {
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

function scheduleBroadcast() {
	// set interval to be 15 mins

	setInterval(() => {
		let wholeObj = {}
		let scheduledTime 
		let currentTime = Date.now()
		console.log('10-minutes interval scheduled broadcast check ')
		db
			.ref(`scheduledBroadcast`)
			.orderByChild('active')
			.equalTo(true)
			.once('value')
			.then(snapshot => {
				if (!snapshot) {
					console.log('snapshot not found')
					return
				} else {
					// console.log(snapshot.val())
					// console.log(snapshot.key)

					// scheduledTime = parseInt(snapshot.key)
					let wholeObj = snapshot.val()
				

					scheduledTime = parseInt(Object.keys(wholeObj)[0]);
					let wholeObj = wholeObj[scheduleTime]
					console.log(`currentTime: ${currentTime}, scheduledTime: ${scheduledTime}`)

					console.log('getTesters to broadcast')
					return db.ref('tester').once('value')
				}
			})
			.then(testerSnap => {
				console.log('Test users got')
				let sendMessageBatch = []
				let message = wholeObj.message
				let users = testerSnap.val()
				console.log(users)
				if (currentTime < scheduledTime) {
					return null
				}
				Object.keys(users).forEach(firebaseKey => {
					let messageBodyData = {
						recipient: {
							id: firebaseKey
						},
						message: message
					}
					console.log(messageBodyData)

					sendMessageBatch.push({
						method: 'POST',
						relative_url: 'me/messages?include_headers=false',
						body: param(messageBodyData)
					})
				})
				sendBatchMessageWithDelay2(sendMessageBatch, 100)
				db.ref(`scheduledBroadcast/${scheduledTime}`).set({ active: false })
			})
			.catch(error => {
				console.log(error)
			})
	}, 60000)
}

/*
 scheduledBroadcast collection will have 2 attr, with its epoch time as its key
 */
module.exports = function(util, messengerFunctions) {
	let module = {}
	module.setScheduledBroadcast = function(req, res) {
		// we will use epoch time stored in database

		let date = Date.parse(req.body.date)
		if (isNaN(date)) {
			return res.status(500).send('error')
		}
		let message = req.body.message
		// assume that date string will be in ISO format e.g 2017-09-13T11:27:54.088Z

		db.ref(`scheduledBroadcast/${date}`).set({ message: message, active: true })
		return res.json({})
	}
	module.invokeBroadcastScheduler = function(req, res) {
		// we will use epoch time stored in database
		scheduleBroadcast()
		return res.json({})
	}
	return module
}
