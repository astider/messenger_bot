const firebaseInit = require('./firebase-settings.js')
const messengerAPI = require('./API/messengerProfile.js')
const userManagementAPI = require('./API/userManagement.js')
const param = require('jquery-param')
const axios = require('axios')
const messengerTemplates = require('./FBMessageTemplate/templates.js')
const db = firebaseInit.admin.database()

const FB = require('fbgraph')


module.exports = function (util, messengerFunctions) {

	let module = {}
	
	module.playGround = function (req, res) {
		
		let batchRequests = []
		let delay = (req.query['delay']) ? req.query['delay'] : 200
		let limitVal = parseInt(req.query['limit'])

		userManagementAPI.getAllSubscribedID()
		.then(ids => {

			console.log('got user ids')
			console.log(`${ids.length} will get this message`)
			
			let time = (new Date()).getTime()
			
			ids.map(uid => {

				let bodyData = {
					recipient: {
						id: uid
					},
					message: {
						text: `ทดลอง BATCH @${time}`
					}
				}

				batchRequests.push({
					method: 'POST',
					relative_url: 'me/messages?include_headers=false',
					body: param(bodyData)
				})
				
			})

			// ---

			let batchLimit = 50
			let maxIncre = Math.ceil(batchRequests.length / batchLimit)
			let roundLimit = (limitVal > 0) ? limitVal : maxIncre

			let reformatReqPack = []

			for (let i = 0; i < roundLimit; i++) {
				reformatReqPack.push( batchRequests.slice(i * 50, i * 50 + batchLimit) )
			}

			console.log(`reformat reqpack size = ${reformatReqPack.length}`)
			let usersCount = 0

			reformatReqPack.reduce((promiseOrder, packOf50, i) => {
				return promiseOrder.then(() => {

					usersCount += packOf50.length

					FB.batch(packOf50, (error, res) => {
						if (error) {
							// console.log(`\n batch [${i}] error : ${JSON.stringify(error)} \n`)
							console.log(`\n batch [${i + 1}] error`)
						} else {

							console.log(`running through batch [${i + 1}]`)

							let time = new Date()
							let date = time.getFullYear() + '-' + (time.getMonth() + 1) + '-' + time.getDate()
							let epochTime = time.getTime()

							res.forEach(response => {

								db.ref(`batchLogs/${date}/${epochTime}`).push().set(response['body'])
								.then(() => {

									let data = JSON.parse(response['body'])

									// if messege delivered successfully, record user's id
									if (data.recipient_id) {

										console.log(`id [${data.recipient_id}] received message!`)
										db.ref(`batchSentComplete/${date}/${epochTime}/${data.recipient_id}`).set(true)

									}

								})
								.catch(error => {
									console.error(`SEND BATCH ERROR: ${error}`)
								})

							})

						}

					})

					return new Promise(res => {
						setTimeout(res, delay)
					})
					
				})

			}, Promise.resolve())
			.then(
				() => {
					console.log('batch request DONE!')
					console.log('====================')
					console.log(`send to ${usersCount} users`)
					console.log('====================')

					let texts = [
						'batch request done',
						`send to ${usersCount} users`
					]
					messengerFunctions.sendCascadeMessage('1432315113461939', texts)

				},
				error => {
					console.error(`reduce error : ${error} `)
				}
			)


			res.send(`sending with delay = ${delay} ...`)

		})

	}

	// --------- END HERE

	return module
}
