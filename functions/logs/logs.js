const firebaseInit = require('../firebase-settings.js')
const messengerAPI = require('../API/messengerProfile.js')
const userManagementAPI = require('../API/userManagement.js')
const param = require('jquery-param')
const axios = require('axios')
const db = firebaseInit.admin.database()

/*
	LIST
	
		readLogs

*/

module.exports = function () {

	let module = {}

	// -----------------------------------------------
	// add new user when user access via Web
	// -----------------------------------------------
	module.readLog = function (req, res) {
		let date = req.query['date']

		if (!date) res.json({ error: 'please specify date param' })
		else {
			db
				.ref(`/batchLogs/${date}`)
				.once('value')
				.then(batchSnapshot => {
					let bat = {}
					let rB = batchSnapshot.val()
					Object.keys(rB).forEach(date => {
						bat = Object.assign(bat, rB[date])
					})

					let error = {
						detail: [],
						count: 0
					}

					let success = {
						detail: [],
						count: 0
					}

					let logCount = Object.keys(bat).length

					Object.keys(bat).forEach(key => {
						let tempLog = JSON.parse(bat[key])

						if (tempLog.error) {
							error.detail.push(tempLog)
							error.count++
						} else if (tempLog.recipient_id) {
							success.detail.push(tempLog)
							success.count++
						}
					})

					res.json({
						total: logCount,
						success: success,
						error: error
					})
				})
				.catch(error => {
					console.error(error)
				})
		}
	}
	// --------- END HERE

	return module
}
