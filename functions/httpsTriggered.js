const firebaseInit = require('./firebase-settings.js')
const messengerAPI = require('./API/messengerProfile.js')
const userManagementAPI = require('./API/userManagement.js')
const param = require('jquery-param')
const axios = require('axios')

const db = firebaseInit.admin.database()

module.exports = function (util, messengerFunctions) {

	let module = {}

	module.getParticipants = function (req, res) {

		// ----

	}

  // --------- END HERE

  return module

}
