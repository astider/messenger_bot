const firebaseInit = require('./firebase-settings.js')
const messengerAPI = require('./API/messengerProfile.js')
const userManagementAPI = require('./API/userManagement.js')
const param = require('jquery-param')
const axios = require('axios')
const messengerTemplates = require('./FBMessageTemplate/templates.js')
const db = firebaseInit.admin.database()


module.exports = function (util, messengerFunctions) {

	let module = {}
	
	module.setMessengerProperties = function (req, res, messenger_env) {

		if (req.method == 'GET') {

			let fields = req.query['fields']

			if (!fields) res.json({ error: 'invalid params' })
			else {

				axios(`https://graph.facebook.com/v2.10/me/messenger_profile?fields=${fields}&access_token=${messenger_env.page_token}`)
				.then(response => {
	
					if (response.status == 200) {
	
						res.json({
							error: null,
							data: response.data.data
						})
	
					}
					else if (response.error) throw response.error
					else throw response.status
	
				})
				.catch(error => {
	
					res.json({
						error: error
					})
	
				})

			}

		}
		else if (req.method == 'POST') {

			let fields = req.body.fields
			let splitField = fields.split(',')
			
			let getStartedButton = req.body.getStartedButton
			let greetingText = req.body.greetingText
			let persistentMenu = req.body.persistentMenu

			let data = splitField.reduce((obj, val) => {

				if (val == 'get_Started') {

					obj[val] = {
						payload: getStartedButton
					}

				}
				else if (val == 'greeting') {

					obj[val] = [
						{
							locale: 'default',
							text: greetingText
						}
					]

				}
				else if (val == 'persistent_menu') {

					obj[val] = [
						{
							locale: 'default',
							composer_input_disabled: true,
							call_to_actions: persistentMenu
						}
					]

				}
				

			}, {} )

			axios.post(`https://graph.facebook.com/v2.10/me/messenger_profile?access_token=${messenger_env.page_token}`, {
				data: data
			})
			.then(response => {

				if (response.status == 200) {

					res.json({
						error: null,
						message: 'success'
					})

				}
				else if (response.error) throw response.error
				else throw response.status

			})
			.catch(error => {

				res.json({
					error: error
				})

			})

		}
		else if (req.method == 'DELETE') {

			axios.delete(`https://graph.facebook.com/v2.10/me/messenger_profile?access_token=${messenger_env.page_token}`, {
				data: req.body
			})
			.then(response => {

				if (response.status == 200) {

					res.json({
						error: null,
						message: 'success'
					})

				}
				else if (response.error) throw response.error
				else throw response.status

			})
			.catch(error => {

				res.json({
					error: error
				})

			})
			
		}
		else res.status(403).json({
			error: 'Forbidden Request'
		})

	}


	// --------- END HERE

	return module
}
