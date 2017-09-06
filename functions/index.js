const FB = require('fbgraph')
const axios = require('axios')
const param = require('jquery-param')
const firebaseInit = require('./firebase-settings.js')

const functions = firebaseInit.functions
const admin = firebaseInit.admin
const env = firebaseInit.env
const db = admin.database()

const storage = require('@google-cloud/storage')
const serviceAccount = require('./credential/tuangnee-credential.json')

const gcs = storage({
    projectId: 'tuangnee',
    keyFilename: './credential/tuangnee-credential.json'
  });

// Reference an existing bucket.
const bucket = gcs.bucket('tuangnee' + '.appspot.com')


const messengerAPI = require('./API/messengerProfile.js')
const userManagementAPI = require('./API/userManagement.js')
const cors = require('cors')({
	origin: ['http://localhost:3000']
})

const qrcode = require('qrcode')
const promptPayload = require('promptpay-qr')
const qrimg = require('node-qr-image')

FB.setAccessToken(env.messenger.page_token)

console.log('STARTING SERVICE')

// ----------------------- Cloud Functions ------------------------

exports.taungNeeHooker = functions.https.onRequest((req, res) => {

	if (req.method == 'GET') {
		// console.log('GET Requested')
		if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === env.messenger.verify_token) {
			// console.log("Validating webhook")
			res.status(200).send(req.query['hub.challenge'])
		} else {
			console.error('Failed validation. Make sure the validation tokens match.')
			console.log(`vtoken = ${env.messenger.verify_token}`)
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

						// get started button
						if (event.postback && event.postback.payload == 'userPressedGetStartedButton') {

						}

						// persistent menu

						else if (event.postback && event.postback.payload == 'checkMyCoupon') {

						}
						else if (event.postback && event.postback.payload == 'checkMyCouponNumber') {

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

// exports.addNewUserFromWeb = functions.https.onRequest((req, res) => {
// 	cors(req, res, () => {
// 		httpsFunctions.addNewUserFromWeb(req, res, env.messenger)
// 	})
// })




// ------------------- Messenger Function

function sendBatchMessage (reqPack) {
	sendBatchMessageWithDelay(reqPack, 0)
}

function sendBatchMessageWithDelay (reqPack, delay) {

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

		setTimeout( function () {

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

		}, delay )

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
	console.log(`page token : ${env.messenger.page_token}`)
	axios({
		method: 'POST',
		url: 'https://graph.facebook.com/v2.6/me/messages',
		params: {
			access_token: env.messenger.page_token
		},
		data: messageData,
		responseType: 'json'
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
		console.log('call Send API failed: ')
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
					setTimeout(res, 1100)
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


	if (messageText) {

		console.log('messageText: ' + messageText)

		let textSplitted = messageText.split(' ')

		if (textSplitted.length == 2) {

			console.log('textsplitted: ' + textSplitted)

			let firstTerm = textSplitted[0]
			let secondTerm = textSplitted[1]

			console.log('[' + firstTerm + ', ' + secondTerm + ']')

			if (firstTerm.length == 10) { 

				let mobile = firstTerm // firstTerm.substring(0, 3) + '-' + firstTerm.substring(3, 6) + '-' + firstTerm.substring(6, firstTerm.length)
				let amount = parseFloat(secondTerm)

				let payload = promptPayload(mobile, { amount: amount } )
				let qrPng = qrimg.imageSync(payload)

				let filename = ((new Date()).getTime()).toString() + '.png'
				let file = bucket.file(filename)
				
				let meta = {
					contentType: 'image/png'
				}

				file.save(qrPng)
				.then(() => {
					return file.setMetadata(meta)
				})
				.then(data => {
					return file.makePublic()
				})
				.then(data => {
					let encodedURL = `https://firebasestorage.googleapis.com/v0/b/tuangnee.appspot.com/o/${encodeURIComponent(filename)}`
					return axios.get(encodedURL)

				})
				.then(response => {

					let token = response.data.downloadTokens
					let imgURL = `https://firebasestorage.googleapis.com/v0/b/tuangnee.appspot.com/o/${encodeURIComponent(filename)}?alt=media&token=${token}`
					
					console.log(`${filename} was uploaded!`)
					console.log(`using URL: ${imgURL}`)

					let msg = {
						recipient:{
							id: senderID
						},
						message:{
							attachment:{
								type: 'image',
								payload:{
									url: imgURL
								}
							}
						}
					}
	
					callSendAPI(msg)

				})
				.catch(err => {
					console.log(`error uploading file: ${err}`)
				})
				

			}
			else if (firstTerm.length == 13) {

				let id = firstTerm // firstTerm.substring(0, 1) + '-' + firstTerm.substring(1, 5) + '-' +
				firstTerm.substring(5, 10) + '-' + firstTerm.substring(10, 12) + '-' + firstTerm.substring(12, firstTerm.length)

				console.log('id : ' + id)
				let amount = parseFloat(secondTerm)

				let payload = promptPayload(id, { amount: amount } )
				let qrPng = qrimg.imageSync(payload)

				let filename = ((new Date()).getTime()).toString() + '.png'
				let file = bucket.file(filename)
				
				let meta = {
					contentType: 'image/png'
				}

				file.save(qrPng)
				.then(() => {
					return file.setMetadata(meta)
				})
				.then(data => {
					return file.makePublic()
				})
				.then(data => {
					let encodedURL = `https://firebasestorage.googleapis.com/v0/b/tuangnee.appspot.com/o/${encodeURIComponent(filename)}`
					return axios.get(encodedURL)

				})
				.then(response => {

					let token = response.data.downloadTokens
					let imgURL = `https://firebasestorage.googleapis.com/v0/b/tuangnee.appspot.com/o/${encodeURIComponent(filename)}?alt=media&token=${token}`
					
					console.log(`${filename} was uploaded!`)
					console.log(`using URL: ${imgURL}`)

					let msg = {
						recipient:{
							id: senderID
						},
						message:{
							attachment:{
								type: 'image',
								payload:{
									url: imgURL
								}
							}
						}
					}
	
					callSendAPI(msg)
				})
				.catch(err => {
					console.log(`error uploading file: ${err}`)
				})

			}
			else {
				sendTextMessage(senderID, 'บอทยังไม่ฉลาดพอที่จะเข้าใจข้อความลักษณะนี้')	
			}

		}
		else {
			sendTextMessage(senderID, 'เมื่อไรจะคืนอะ ที่ยืมไปวันก่อน')
		}
		
  } else if (messageAttachments) {
    sendTextMessage(senderID, 'Message with attachment received');
  }

}


function svgToQR (payload) {

	const options = { type: 'svg', color: { dark: '#003b6a', light: '#f7f8f7' } }

	return new Promise((resolve, reject) => {

		qrcode.toString(payload, options, (err, svg) => {
			if (err) return reject(err)
			resolve(svg)
		})
		  
	})

}
