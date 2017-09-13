const firebaseInit = require('./firebase-settings.js')
const messengerAPI = require('./API/messengerProfile.js')
const userManagementAPI = require('./API/userManagement.js')
const param = require('jquery-param')
const axios = require('axios')
const messengerTemplates = require('./FBMessageTemplate/templates.js')
const db = firebaseInit.admin.database()

function scheduleBroadcast(){
// set interval to be 15 mins 
}
/*
 scheduledBroadcast collection will have 2 attr, with its epoch time as its key
 */
module.exports = function (util, messengerFunctions) { 

  let module = {}
  module.setScheduledBroadcast = function (req, res) {
    // we will use epoch time stored in database
    
    let date = Date.parse(req.body.date)
    let message = req.body.message
    // assume that date string will be in ISO format e.g 2017-09-13T11:27:54.088Z

    db.ref(`scheduledBroadcast/${date}`).set({message:message,active:true})
  }

  }
