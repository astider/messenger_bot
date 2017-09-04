const admin = require('firebase-admin')
const functions = require('firebase-functions')
const env = functions.config().tuangnee

let serviceAccount = require('./credential/tuangnee-credential.json')

const firebaseConfig = {
	credential: admin.credential.cert(serviceAccount),
	apiKey: env.firebase.api_key,
	authDomain: 'tuangnee.firebaseapp.com',
	databaseURL: 'https://tuangnee.firebaseio.com/'
}

admin.initializeApp(firebaseConfig)
serviceAccount = null

module.exports = {
  env,
  admin,
  functions
}
