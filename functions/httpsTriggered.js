const firebaseInit = require('./firebase-settings.js')
const messengerAPI = require('./API/messengerProfile.js')
const userManagementAPI = require('./API/userManagement.js')
const param = require('jquery-param')
const axios = require('axios')
const messengerTemplates = require('./FBMessageTemplate/templates.js')
const db = firebaseInit.admin.database()

const basicMessage = messengerTemplates.textMessage('ข้อความ')

function axiousRequestForFBSharedPost (startURL) {
	var completeData = []

	const getFBShared = URL =>
		axios
			.get(URL)
			.then(response => {
				console.log(response.data)
				// add the contacts of this response to the array
				if (response.data.data.length > 0) completeData = completeData.concat(response.data.data)
				if (response.data.paging) {
					return getFBShared(response.data.paging.next)
				} else {
					// this was the last page, return the collected contacts
					return completeData
				}
			})
			.catch(error => {
				console.log('oh, error is here')
				//  console.log(error)
				throw error
			})
	console.log('fb axios request URL is ', startURL)
	return getFBShared(startURL)
}

function axiousRequestFBUserFeedOnlyDS (startURL, targetPageID, targetPostID) {
	console.log(`param is ${startURL}`)
	console.log(`other param is ${targetPageID} ${targetPostID}`)
	var completeData = []

	const getFBShared = URL =>
		axios
			.get(URL)
			.then(response => {
				//  console.log(response.data)
				//  console.log(response.data)
				// add the contacts of this response to the array
				if (response.data.data.length > 0) {
					for (var i = 0; i < response.data.data.length; i++) {
						if (response.data.data[i].parent_id) {
							let extractor = /(\d+)_(\d+)/
							let extracted = extractor.exec(response.data.data[i].parent_id)
							let pageID = extracted[1]
							let postID = extracted[2]
							console.log(`pageID and post ID is ${pageID} ${postID}`)
							if (pageID == targetPageID) {
								if (postID == targetPostID) {
									completeData.push(response.data.data[i])
									console.log('found target Post on this user timeline')
									return completeData
								}
							}
						}
					}
				}
				if (response.data.paging) {
					return getFBShared(response.data.paging.next)
				} else {
					// this was the last page, return the collected contacts
					return completeData
				}
			})
			.catch(error => {
				console.log(error)
				return []
			})
	return getFBShared(startURL)
}

function checkUserPostsForShare (userID, pageID, postID, accessToken) {
	// page scope ID of page "DS" is used as the main ID`
	//
	// We have to use access_token in query
	return new Promise(function (resolve, reject) {
		axiousRequestFBUserFeedOnlyDS(`https://graph.facebook.com/v2.10/${userID}/feed?fields=link,story,message,id,parent_id&access_token=${accessToken}`, pageID, postID)
			.then(res => {
				// an array with a single element or none.
				if (res.length > 0) {
					return resolve(true)
				} else {
					return resolve(false)
				}
			})
			.catch(error => {
				console.log('Shareposts count error ')
				console.log(`${error}`)
				return reject(error)
				// throw error
			})
	})
}

function getSharedPostsByApp (pageID, postID, accessToken) {
	// page scope ID of page "DS" is used as the main ID`
	//
	// We have to use access_token in query
	return new Promise(function (resolve, reject) {
		axiousRequestForFBSharedPost(`https://graph.facebook.com/v2.10/${pageID}_${postID}/sharedposts?access_token=${accessToken}`)
			.then(res => {
				var ids = []
				var extractor = /(\d+)_*/
				res.forEach(obj => {
					var extracted = extractor.exec(obj.id)
					ids.push(extracted[1])
				})

				return resolve(ids)
			})
			.catch(error => {
				console.log('Shareposts count error ')
				console.log(`${error}`)
				return reject(error)
				// throw error
			})
	})
}


// ------------------------------------------------------------------------------------------------------------

module.exports = function (util, messengerFunctions) {

	let module = {}

	module.testCheckUserSharedPost = function (req, res) {
		checkUserPostsForShare(req.query.userID, req.pageID, req.postID, req.accessToken)
			.then(found => {
				if (!found) {
					return res.status(404).json({ error: 'ไม่พบการแชร์โพสต์ที่ทดสอบ' })
				}
				return db
					.ref('users')
					.orderByChild('fb_loginid')
					.equalTo(req.query.userID)
					.once('value')
			})
			.then(userNotFold => {
				if (!userNotFold) {
					return res.status(404).json({ error: 'ไม่พบเจอในระบบ' })
				}
				let coupon = 0
				let usersData = userNotFold.val()
				let couponIsAdded = false
				let userKey
				var postID = req.postID
				var date = '2017-08-28'
				Object.keys(usersData).map(key => {
					userKey = key
					coupon = usersData[key].coupon
					if (usersData[key].couponHistory) {
						if (!usersData[key].couponHistory[date]) {
							console.log('user has coupon history, but not with the date and postID')
							couponIsAdded = true
							usersData[key].coupon = usersData[key].coupon == null ? 1 : usersData[key].coupon + 1
							coupon = usersData[key].coupon
							usersData[key].couponHistory[date] = {
								[postID]: true
							}
						} else if (!usersData[key].couponHistory[date][postID]) {
							couponIsAdded = true

							usersData[key].coupon = usersData[key].coupon == null ? 1 : usersData[key].coupon + 1
							coupon = usersData[key].coupon
							usersData[key].couponHistory[date][postID] = true
						}
					} else {
						couponIsAdded = true
						usersData[key].coupon = usersData[key].coupon == null ? 1 : usersData[key].coupon + 1
						coupon = usersData[key].coupon
						usersData[key].couponHistory = {
							[date]: {
								[postID]: true
							}
						}
					}
				})
				if (req.query['mode'] == 99) {
					var toBeSet = usersData[userKey]

					return db
						.ref(`users/${userKey}`)
						.set(toBeSet)
						.then(() => {
							res.json({
								error: null,
								couponIsAdded: couponIsAdded,
								couponNum: coupon
							})
						})
				} else {
					return res.json({
						userKey: userKey,
						userData: usersData
					})
				}
			})
			.catch(error => {
				console.log(error)
				return res.status(500).json({})
			})
	}

	module.addTemplateMessage = function (req, res) {
		let type = req.body.category
		let name = req.body.messageType
		if (!type || !name) {
			return res.status(500).json({})
		}
		let message
		if (type == 'text') {
			if (!req.body.payload) {
				return res.status(500).json({})
			}
			message = messengerTemplates.textMessage(req.body.payload)
		} else if (type == 'image') {
			if (!req.body.payload) {
				return res.status(500).json({})
			}
			message = messengerTemplates.imageMessage(req.body.payload)
		} else if (type == 'quick_reply') {
			// force type of quick reply to "text" only
			// var obj = {
			// 	content_type: 'text',
			// 	title: title,
			// 	image_url: imgURL,
			// 	payload: textPayload
			// }
			// this request needs an array of objects, up to length of 11
			/*
				[
					{title
					image_url}
				]
			
			*/
			let quickRepliesArray = []
			if (!req.body.text) {
				return res.status(500).json({})
			}
			if (!Array.isArray(req.body.quickReplies)) {
				return res.status(500).json({})
			}
			if (req.body.quickReplies.length > 11 || req.body.quickReplies.length <= 0) {
				return res.status(500).json({})
			}
			for (let m = 0; m < req.body.quickReplies.length; m++) {
				let curReply = req.body.quickReplies[m]
				if (!curReply.title || !curReply.payload) {
					return res.status(500).json({})
				}
				if (!curReply.imgURL) quickRepliesArray.push(messengerTemplates.quickReplyObject(curReply.title, curReply.payload))
				else {
					quickRepliesArray.push(messengerTemplates.quickReplyObject(curReply.title, curReply.payload, curReply.imgURL))
				}
			}
			message = messengerTemplates.quickReplyMessage(req.body.text, quickRepliesArray)
		} else {
			return res.status(500).json()
		}
		// purpose is a custom type such as "welcome"
		// messageType is  a messenger message type "text","image","quick replies"
		// this function add message template to database
		/*
			The structure will be
			messageTemplates
				|-'welcome'-|
										|-type:""
		*/
		// let newMessageKey = db.ref('posts').push().key;
		db
			.ref(`messageTypes/${name}`)
			.push(true)
			.then(snap => {
				let key = snap.key
				message['message']['messageType'] = name
				message['message']['category'] = type
				db.ref(`messageTemplates/${key}`).set(message['message'])
				return res.json({ error: null })
			})
			.catch(e => {})
		// db.ref(`messageTemplates/${name}`).set(message['message'])
	}

	module.editTemplateMessage = function (req, res) {
		// we receive POST

		let target = req.body.target

		// target must be firebase key
		db.ref(`messageTemplates/${target}`).once('value').then(snapshot => {
			if (!snapshot){
				return res.status(404).json({})
			}
			let oldMessage = snapshot.val()
			console.log(oldMessage)
			if (!oldMessage){
				return res.status(404).json({})
			}
			// sort things out by its category
			if (oldMessage.category == 'text'){
				if (!req.body.payload){
					return res.status(400).json({})
				}
				if (typeof req.body.payload != 'string'){
					return res.status(400).json({})
				}
				oldMessage.text = req.body.payload
			}
			else if (oldMessage.category == 'image'){
				if (!req.body.payload){
					return res.status(400).json({})
				}
				if (typeof req.body.payload != 'string'){
					return res.status(400).json({})
				}
				oldMessage.attachment.payload.url = req.body.payload;
			}
			else if (oldMessage.category == 'quick_reply'){
				return res.status(404).json({})
			}
			db.ref(`messageTemplates/${target}`).set(oldMessage)

		});
	}


	// --------- START HERE

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

	// this function create coupon for users that shares our post
	module.sendCouponOfSharedPost = function (req, res) {
		// get ids of users that share target post
		getSharedPostsByApp(req.query.pageID, req.query.postID, req.accessToken)
			.then(data => {
				if (req.query['approveCommand'] != 'IAgreeToGiveTheseCouponToPlayersWhoMetRequirement') return res.json({ error: "you don't have permission" })
				if (!req.query['postID']) return res.json({ error: 'invalid parameters' })

				let participants = null
				let usersData = null
				req.rewardedIDs = data
				// let allPlayers = []
				let whoGetPlayCoupon = []
				let topUsers = []
				let whoGetSpecialBonus = []
				let rewardedIDs = data
				console.log('rewarded IDs is ', rewardedIDs)
				let bestScore = 0
				let date = req.query['dateOfEvent']
				let bonusQuestion = req.query['bonusQ'] && !isNaN(req.query['bonusQ']) ? req.query['bonusQ'] : -1
				console.log(`bonus q = ${bonusQuestion}`)
				console.log(date)
				return db.ref(`couponSchedule/${date}`).once('value')
			})
			.then(csSnap => {
				// console.log(csSnap)
				// console.log("rewarded IDs is ",rewardedIDs)
				console.log('after querying coupon')
				let couponSchedule = csSnap.val()
				if (couponSchedule == null) throw 'event time error, check couponSchedule'
				console.log('passed coupon val')
				return db.ref('users/').once('value')
			})
			.then(userSnap => {
				console.log('after querying users')
				usersData = userSnap.val()
				// variable rewardedIDs
				// console.log("rewarded IDs is ",rewardedIDs)

				let result = {}
				let proofOfCount = 0
				let idInBonus = []
				let postID = req.query.postID
				let date = req.query.dateOfEvent
				let rewardedIDs = req.rewardedIDs
				Object.keys(usersData).map(key => {
					// if users fb_loginid appears in rewardedIDs, give a coupon... IF THERE IS NO DUPLICATE!
					if (rewardedIDs.indexOf(usersData[key].fb_loginid) > -1) {
						//

						if (usersData[key].couponHistory) {
							console.log('user has coupon history')
							// if a user has couponHistory
							// check if couponHistoryOn[date]and[req.query.postID]is false
							if (!usersData[key].couponHistory[date]) {
								// doesn't have date & postID in history
								// add coupon.
								console.log('user has coupon history, but not with the date and postID')
								// create couponHistory[date]
								usersData[key].coupon = usersData[key].coupon == null ? 1 : usersData[key].coupon + 1
								usersData[key].couponHistory[date] = {
									[postID]: true
								}

								// {
								//   [date]: {
								//     [postID]:true
								//   }
								// }
							} else if (!usersData[key].couponHistory[date][postID]) {
								// user has history of [date], but doesn't have [postID]
								// set it to true
								usersData[key].coupon = usersData[key].coupon == null ? 1 : usersData[key].coupon + 1
								usersData[key].couponHistory[date][postID] = true
							}
						} else {
							// ah yes, we can be sure in this case that the user never has any record ofcoupon
							// add coupon
							usersData[key].coupon = usersData[key].coupon == null ? 1 : usersData[key].coupon + 1
							usersData[key].couponHistory = {
								[date]: {
									[postID]: true
								}
							}
						}

						result[usersData[key].fbid] = {
							key: key,
							id: usersData[key].fbid,

							coupon: usersData[key].coupon
						}
					}
				})

				if (req.query['mode'] == 99) {
					return db
						.ref('users')
						.set(usersData)
						.then(() => {
							res.json({
								error: null,
								message: 'Coupon Sent!!'
							})
						})
				} else {
					res.json({
						error: null,

						result_count: Object.keys(result).length,

						users_count: Object.keys(usersData).length,
						usersData: usersData
					})
				}
			})
			.catch(error => {
				console.log(`error : ${error}`)
				res.json({
					error: error
				})
			})
	}

	module.requestCouponOfSharedPosts = function (req, res) {
		// get ids of users that share target post
		getSharedPostsByApp(req.query.pageID, req.query.postID, req.accessToken)
			.then(data => {
				if (req.query['approveCommand'] != 'IAgreeToGiveTheseCouponToPlayersWhoMetRequirement') return res.json({ error: "you don't have permission" })
				if (!req.query['postID']) return res.json({ error: 'invalid parameters' })

				let participants = null
				let usersData = null
				req.rewardedIDs = data
				// let allPlayers = []
				let whoGetPlayCoupon = []
				let topUsers = []
				let whoGetSpecialBonus = []
				let rewardedIDs = data
				console.log('rewarded IDs is ', rewardedIDs)
				let bestScore = 0
				let date = req.query['dateOfEvent']
				let bonusQuestion = req.query['bonusQ'] && !isNaN(req.query['bonusQ']) ? req.query['bonusQ'] : -1
				console.log(`bonus q = ${bonusQuestion}`)
				console.log(date)
				return db.ref(`couponSchedule/${date}`).once('value')
			})
			.then(csSnap => {
				// console.log(csSnap)
				// console.log("rewarded IDs is ",rewardedIDs)
				console.log('after querying coupon')
				let couponSchedule = csSnap.val()
				if (couponSchedule == null) throw 'event time error, check couponSchedule'
				console.log('passed coupon val')
				return db.ref('users/').once('value')
			})
			.then(userSnap => {
				console.log('after querying users')
				usersData = userSnap.val()
				// variable rewardedIDs
				// console.log("rewarded IDs is ",rewardedIDs)

				let result = {}
				let proofOfCount = 0
				let idInBonus = []
				let postID = req.query.postID
				let date = req.query.dateOfEvent
				let rewardedIDs = req.rewardedIDs
				Object.keys(usersData).map(key => {
					// if users fb_loginid appears in rewardedIDs, give a coupon... IF THERE IS NO DUPLICATE!
					if (rewardedIDs.indexOf(usersData[key].fb_loginid) > -1) {
						//

						if (usersData[key].couponHistory) {
							console.log('user has coupon history')
							// if a user has couponHistory
							// check if couponHistoryOn[date]and[req.query.postID]is false
							if (!usersData[key].couponHistory[date]) {
								// doesn't have date & postID in history
								// add coupon.
								console.log('user has coupon history, but not with the date and postID')
								// create couponHistory[date]
								usersData[key].coupon = usersData[key].coupon == null ? 1 : usersData[key].coupon + 1
								usersData[key].couponHistory[date] = {
									[postID]: true
								}

								// {
								//   [date]: {
								//     [postID]:true
								//   }
								// }
							} else if (!usersData[key].couponHistory[date][postID]) {
								// user has history of [date], but doesn't have [postID]
								// set it to true
								usersData[key].coupon = usersData[key].coupon == null ? 1 : usersData[key].coupon + 1
								usersData[key].couponHistory[date][postID] = true
							}
						} else {
							// ah yes, we can be sure in this case that the user never has any record ofcoupon
							// add coupon
							usersData[key].coupon = usersData[key].coupon == null ? 1 : usersData[key].coupon + 1
							usersData[key].couponHistory = {
								[date]: {
									[postID]: true
								}
							}
						}

						result[usersData[key].fbid] = {
							key: key,
							id: usersData[key].fbid,

							coupon: usersData[key].coupon
						}
					}
				})

				if (req.query['mode'] == 99) {
					return db
						.ref('users')
						.set(usersData)
						.then(() => {
							res.json({
								error: null,
								message: 'Coupon Sent!!'
							})
						})
				} else {
					res.json({
						error: null,

						result_count: Object.keys(result).length,

						users_count: Object.keys(usersData).length,
						usersData: usersData
					})
				}
			})
			.catch(error => {
				console.log(`error : ${error}`)
				res.json({
					error: error
				})
			})
	}



	return module
}
