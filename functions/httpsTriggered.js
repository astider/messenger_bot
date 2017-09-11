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
		let type = req.body.messageType
		let name = req.body.name
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
			if (!req.body.headerText) {
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
				if (!curReply.imgURL)quickRepliesArray.push(messengerTemplates.quickReplyObject(curReply.title, curReply.payload))
					else {
						quickRepliesArray.push(messengerTemplates.quickReplyObject(curReply.title, curReply.payload, curReply.imgURL))
					}
			}
			message = messengerTemplates.quickReplyMessage(req.body.headerText, quickRepliesArray)
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
		let messageObject = {
			type: req.body.messageType,
			message: message
		}
		db.ref(`messageTemplates/${name}`).set(messageObject)
		return res.json({ error: null })
	}
	// --------- START HERE
	module.getOverallStatus = function (req, res) {
		let cq = -1
		let fqa = null
		let q = null
		let p = []
		let ucount = 0

		util
			.getStatus()
			.then(status => {
				cq = status.currentQuiz
				return util.getQuiz()
			})
			.then(snapshot => {
				q = snapshot.val()
				return util.getFireQuizAt()
			})
			.then(snapshot => {
				fqa = snapshot.val()
				return util.getParticipants()
			})
			.then(partSnap => {
				let tp = partSnap.val()
				if (tp) {
					Object.keys(tp).forEach(key => {
						p.push(tp[key])
					})
				}

				return db.ref('/userIds').once('value')
			})
			.then(uidSnap => {
				let uids = uidSnap.val()

				if (uids) ucount = Object.keys(uids).length

				res.json({
					currentQuiz: cq,
					quizLength: q ? q.length : 0,
					fireQuizAt: fqa,
					quiz: q,
					userAmount: ucount,
					participantsAmount: p.length,
					participants: p
				})
			})
			.catch(error => {
				console.log(`there's an error in getQuizStatus: ${error}`)
				res.json({
					error: `error in ${error} `
				})
			})
	}

	module.getParticipants = function (req, res) {
		util
			.getParticipants()
			.then(snapshot => {
				res.json({
					participants: snapshot.val()
				})
			})
			.catch(error => {
				console.log(`there's an error in getParticipants: ${error}`)
				res.end()
			})
	}

	module.showRandomCorrectUsers = function (req, res) {
		let quiz = null
		let participants = null
		let currentQuiz = -1

		util
			.getStatus()
			.then(status => {
				currentQuiz = status.currentQuiz
				return util.getQuiz()
			})
			.then(quizSnapshot => {
				quiz = quizSnapshot.val()
				return util.getParticipants()
			})
			.then(participantsSnapshot => {
				participants = participantsSnapshot.val()

				if (!req.query.quizno) res.json({ error: 'please specify quiz no.' })
				else if (!quiz) res.json({ error: 'quiz not ready' })
				else if (!participants) res.json({ error: 'participants not found' })
				else if (req.query.quizno < 0 || req.query.quizno > quiz.length - 1) res.json({ error: 'incorrect quiz no.' })
				else {
					let targetQuizNo = parseInt(req.query.quizno)

					let answerAmount = 0
					let answerRate = quiz[targetQuizNo].choices.reduce((obj, choiceValue) => {
						obj[choiceValue] = 0
						return obj
					}, {})

					console.log('answerRate = ' + JSON.stringify(answerRate))
					console.log('quiz = ' + JSON.stringify(quiz))
					console.log('participant = ' + JSON.stringify(participants))

					if (targetQuizNo > -1 || targetQuizNo < quiz.length) {
						let correctUsers = Object.keys(participants).map(key => {
							if (participants[key].answerPack[targetQuizNo].ans.length > 0) {
								answerAmount++
								answerRate[participants[key].answerPack[targetQuizNo].ans]++
								console.log('>>> in map : answerRate = ' + JSON.stringify(answerRate))
							}

							if (participants[key].answerPack[targetQuizNo].correct == true) {
								return {
									id: key,
									firstName: participants[key].firstName,
									lastName: participants[key].lastName,
									profilePic: participants[key].profilePic,
									answerTime: participants[key].answerPack[targetQuizNo].at
								}
							}
						})

						correctUsers = correctUsers.filter(n => {
							return n != undefined
						})

						for (let key in answerRate) {
							answerRate[key] = Math.round(answerRate[key] / answerAmount * 100)
						}

						console.log('>>> AFTER % : answerRate = ' + JSON.stringify(answerRate))
						let range = correctUsers.length
						let sortCorrectUsers = []

						if (range <= 25) {
							if (range > 1)
								sortCorrectUsers = correctUsers.sort((a, b) => {
									return a.answerTime - b.answerTime
								})
							else sortCorrectUsers = correctUsers

							console.log(`sortCorrectUsers : ${sortCorrectUsers}`)

							res.json({
								error: null,
								answerRate: answerRate,
								correctUsers: sortCorrectUsers
							})
						} else {
							let array = correctUsers
							for (let i = array.length - 1; i > 0; i--) {
								let j = Math.floor(Math.random() * (i + 1))
								let temp = array[i]
								array[i] = array[j]
								array[j] = temp
							}

							res.json({
								error: null,
								answerRate: answerRate,
								correctUsers: array
							})
						}
					} else
						res.json({
							error: 'quiz no. incorrect',
							text: `you requested quiz number ${targetQuizNo}
               but current quiz number is ${currentQuiz} and quiz length is ${quiz.length}`
						})
				}
			})
			.catch(error => {
				res.json({
					error: error,
					text: "there should be error, but i dont' know what it is. system don't tell me"
				})
			})
	}

	module.getTopUsers = function (req, res) {
		let fq = null
		let participants = null

		util.getFireQuizAt()
		.then(snapshot => {
			fq = snapshot.val()
			return util.getParticipants()
		})
		.then(snapshot => {
			if (!fq) res.json({ error: 'no quiz sent OR no sent time collected' })
			else {
				participants = snapshot.val()
				let candidate = Object.keys(participants).map(key => {
					let timeUsedBeforeAnswer = participants[key].answerPack.reduce((collector, ansDetail, idx) => {
						console.log('firequiz time : ' + fq[idx])
						return ansDetail.ans ? collector + (ansDetail.at - fq[idx]) : collector
					}, 0)

					return {
						id: key,
						firstName: participants[key].firstName,
						lastName: participants[key].lastName,
						profilePic: participants[key].profilePic,
						point: participants[key].point,
						totalTimeUsed: timeUsedBeforeAnswer
					}
				})

				let topUsers = candidate.sort((a, b) => {
					if (b.point - a.point == 0) return a.totalTimeUsed - b.totalTimeUsed
					else return b.point - a.point
				})

				if (topUsers.length > 15) {
					topUsers = topUsers.splice(0, 15)
				}

				res.json({
					error: null,
					topUsers: topUsers
				})
			}
		})
		.catch(error => {
			console.log(`there's an error in getTopUsers: ${error}`)
			res.end()
		})
	}

	module.sendRequest = function (req, res) {
		db.ref('canEnter').set(true)

		userManagementAPI
			.getAllID()
			.then(allID => {
				let sendRequestBatch = []

				allID.forEach(id => {
					let inviteMessage = {
						recipient: { id: id },
						message: {
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
					}

					sendRequestBatch.push({
						method: 'POST',
						relative_url: 'me/messages?include_headers=false',
						body: param(inviteMessage)
					})

					// sendQuickReplies(id, inviteMessage)
				})

				messengerFunctions.sendBatchMessage(sendRequestBatch)

				res.json({
					error: null,
					text: 'everything is fine... I guess ?'
				})
			})
			.catch(error => {
				res.json({
					error: error,
					text: 'shit happens'
				})
			})
	}

	module.addQuiz = function (req, res) {
		if (req.method == 'POST') {
			db.ref('quiz').set(req.body.quiz)
		}

		res.json({
			error: null
		})
	}

	module.selectVoteAnswer = function (req, res) {
		let selectedChoice = req.body.choice
		let selectedAnswer = null
		let currentQuiz = -1

		if (req.method == 'GET') res.status(403).json({ error: 'Forbidden Request' })
		else if (!selectedChoice) res.json({ error: 'no choice was selected' })
		else if (isNaN(selectedChoice)) res.json({ error: 'selected choice data type is not a number' })
		else {
			util.getStatus()
			.then(status => {
				currentQuiz = status.currentQuiz
					
				console.log(JSON.stringify(status))

				if (status.canAnswer) res.json({ error: 'cannot perform this function', message: 'time is not up yet, please wait' })
				else if (!status.voting) res.json({ error: 'cannot perform this function', message: 'voting value is FALSE' })
				else return db.ref(`quiz/${currentQuiz}`).once('value')
			})
			.then(qSnap => {
				let quizInfo = qSnap.val()

				if (quizInfo.type != 'VOTE') res.json({ error: 'cannot perform this function', message: 'This function is available only for VOTE type' })
				else if (selectedChoice < 0 || selectedChoice > quizInfo.choices.length) res.json({ error: 'cannot perform this function', message: 'choice out of bound' })
				else {
					selectedAnswer = quizInfo.choices[selectedChoice]
					quizInfo.a = selectedAnswer
					return db.ref(`quiz/${qSnap.key}`).set(quizInfo)
				}
			})
			.then(() => {
				console.log('selected choice saved!')
				return db.ref('participants').once('value')
			})
			.then(partSnap => {
				let participants = partSnap.val()
				let updates = []

				Object.keys(participants).map(key => {
					let playerAnswerInfo = participants[key].answerPack[currentQuiz]

					if (playerAnswerInfo.ans == selectedAnswer) {
						playerAnswerInfo.correct = true
						updates[`participants/${key}/answerPack/${currentQuiz}`] = playerAnswerInfo
					}
				})

				db.ref().update(updates)
			})
			.catch(error => {
				console.error(`selectVoteAnswer error: ${error}`)
			})
		}
	}

	module.sendResult = function (req, res) {
		db.ref('canAnswer').set(false)
		db.ref('canEnter').set(false)
		db.ref('playing').set(false)

		let participants = null

		util
			.getParticipants()
			.then(participantsSnapshot => {
				participants = participantsSnapshot.val()

				let sendResultRequests = []
				Object.keys(participants).forEach(id => {
					let bodyData = {
						recipient: {
							id: id
						},
						message: {
							text: `กิจกรรมจบแล้ว ยินดีด้วย คุณได้คะแนนรวม ${participants[id].point} คะแนน สำหรับคูปองนั้นทางเราจะคำนวณและแจกให้ผู้เข้าร่วมกิจกรรมที่ทำตามเงื่อนไขนะ`
						}
					}

					sendResultRequests.push({
						method: 'POST',
						relative_url: 'me/messages?include_headers=false',
						body: param(bodyData)
					})
				})

				messengerFunctions.sendBatchMessage(sendResultRequests)

				res.json({
					error: null
				})
			})
			.catch(error => {
				console.log(`there's an error in sendResult: ${error}`)
				res.end()
			})
	}

	module.restart = function (req, res) {
		db.ref('currentQuiz').set(-1)
		db.ref('canEnter').set(false)
		db.ref('canAnswer').set(false)
		db.ref('playing').set(false)
		db.ref('participants').set(null)
		db.ref('fireQuizAt').set(null)

		res.json({
			error: null
		})
	}

	/*
  module.sendEndMessage = function (req, res) {

    let participants = null

    util.getStatus()
    .then(status => {
      if (status.canAnswer) db.ref('canAnswer').set(false)
      if (status.canEnter) db.ref('canEnter').set(false)
      if (status.playing) db.ref('playing').set(false)

      return util.getParticipants()
    })
    .then(participantsSnapshot => {

			participants = participantsSnapshot.val()

      Object.keys(participants).forEach(id => {
				messengerFunctions.sendTextMessage(
					id,
					'บ๊ายบาย ไว้มาร่วมสนุกกับพวกเราได้ใหม่วันจันทร์หน้านะ :)'
				)
			})

			res.json({
        'error': null,
        'message': 'send ending message success'
			})
		})
		.catch(error => {
			console.log(`there's an error in sendResult: ${error}`)
			res.end()
		})

  }
	*/

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

	module.assignCounponNumber = function (req, res) {
		db
			.ref('/users')
			.once('value')
			.then(usersSnap => {
				let couponCount = 0
				let couponMatching = {}
				let users = usersSnap.val()

				Object.keys(users).map(key => {
					couponCount += users[key].coupon ? users[key].coupon : 0
				})

				console.log(`coupon amount: ${couponCount}`)

				let numbers = []
				for (let i = 1; i <= couponCount; i++) numbers.push(i)

				for (let i = numbers.length - 1; i > 0; i--) {
					let j = Math.floor(Math.random() * (i + 1))
					let temp = numbers[i]
					numbers[i] = numbers[j]
					numbers[j] = temp
				}

				let counter = 0
				let mutableUsers = users

				Object.keys(users).map(key => {
					if (mutableUsers[key].coupon) {
						mutableUsers[key].couponNumber = []

						for (let i = 0; i < mutableUsers[key].coupon; i++) {
							mutableUsers[key].couponNumber.push(numbers[counter])
							couponMatching[numbers[counter]] = {
								fbid: mutableUsers[key].fbid,
								firstName: mutableUsers[key].firstName,
								lastName: mutableUsers[key].lastName,
								profilePic: mutableUsers[key].profilePic
							}

							counter++
						}
					}
				})

				// console.log(`new users: ${JSON.stringify(users, null, 4)}`)
				// console.log(`check counter = ${counter} | ${couponCount}`)
				// res.json({
				// 	counter: counter,
				// 	couponCount: couponCount,
				// 	users: mutableUsers,
				// 	pair: couponMatching
				// })
				db.ref('/users').set(mutableUsers)
				db.ref('/couponPair').set(couponMatching)

				res.json({
					error: null,
					message: 'successfully assign coupon'
				})
			})
			.catch(error => {
				console.log(`assign coupon number error : ${error}`)
			})
	}

	module.getCouponPair = function (req, res) {
		if (!req.query['couponNumber'] || isNaN(req.query['couponNumber'])) res.json({ error: 'Invalid param', message: 'please specify couponNumber' })
		else {
			let couponNumber = parseInt(req.query['couponNumber'])

			db
				.ref(`couponPair/${couponNumber}`)
				.once('value')
				.then(pairSnapshot => {
					let user = pairSnapshot.val()
					if (!user) res.json({ error: null, message: 'no result' })
					else
						res.json({
							error: null,
							couponNumber: couponNumber,
							matchedUser: user
						})
				})
				.catch(error => {
					console.error(`error found in getCouponPair: ${error}`)
					res.json({
						error: error,
						message: 'please specify couponNumber'
					})
				})
		}
	}

	module.sendCouponNumber = function (req, res) {
		db
			.ref('couponPair')
			.once('value')
			.then(pairSnap => {
				let pair = pairSnap.val()
				let requestArray = []
				let matchDuplciate = []

				let anotherReqArray = []

				for (let i = 1; i < pair.length; i++) {
					let imageMessage = {
						recipient: {
							id: pair[i].fbid
						},
						message: {
							attachment: {
								type: 'image',
								payload: {
									url: 'https://firebasestorage.googleapis.com/v0/b/codelab-a8367.appspot.com/o/ccc-ticket.jpg?alt=media&token=6566450a-37bd-4327-9e1a-a3ffc8cfb718'
								}
							}
						}
					}

					// image message
					if (matchDuplciate.indexOf(pair[i].fbid) == -1) {
						requestArray.push({
							method: 'POST',
							relative_url: 'me/messages?include_headers=false',
							body: param(imageMessage)
						})
					}

					matchDuplciate.push(pair[i].fbid)
				}

				matchDuplciate = []
				let keyMap = {}
				let startIndex = requestArray.length

				for (let i = 1; i < pair.length; i++) {
					if (matchDuplciate.indexOf(pair[i].fbid) < 0) {
						let bodyData = {
							recipient: {
								id: pair[i].fbid
							},
							message: {
								text: `คูปองหมายเลข ${i}`
							}
						}

						requestArray.push({
							method: 'POST',
							relative_url: 'me/messages?include_headers=false',
							body: bodyData
						})

						matchDuplciate.push(pair[i].fbid)
						keyMap[pair[i].fbid] = requestArray.length - 1
					} else {
						let index = keyMap[pair[i].fbid]
						requestArray[index].body.message.text += `\r\nคูปองหมายเลข ${i}`
					}
				}

				for (let i = startIndex; i < requestArray.length; i++) {
					console.log(requestArray[i].body.message.text)
					requestArray[i].body = param(requestArray[i].body)
				}

				messengerFunctions.sendBatchMessageWithDelay(requestArray, 500)

				res.json({
					error: null,
					message: 'works fine... ?'
				})
			})
			.catch(error => {
				console.log(`send coupon number error : ${error}`)
			})
	}

	module.addWinner = function (req, res) {
		let couponNumber = req.query['couponNumber']
		if (!couponNumber) res.json({ message: 'invalid param' })
		else {
			db
				.ref(`couponPair/${couponNumber}`)
				.once('value')
				.then(userInfo => {
					let user = userInfo.val()

					return db.ref(`winners/${user.fbid}`).set({
						approved: true,
						confirm: false,
						firstName: user.firstName,
						lastName: user.lastName
					})
				})
				.then(() => {
					res.send('success!')
				})
				.catch(error => {
					res.send(error)
				})
		}
	}

	module.sendMessageToWhoGetSmallPrize = function (req, res) {
		let couponNumber = req.query['couponNumber']
		if (!couponNumber) res.json({ message: 'invalid param' })
		else {
			let uid = null

			db
				.ref(`couponPair/${couponNumber}`)
				.once('value')
				.then(userInfo => {
					let user = userInfo.val()
					uid = user.fbid

					return db.ref(`smallPrizeWinners/${user.fbid}`).set({
						approved: true,
						confirm: false,
						firstName: user.firstName,
						lastName: user.lastName
					})
				})
				.then(() => {
					messengerFunctions.sendTextMessage(uid, 'ยินดีด้วย คุณได้รับรางวัลปลอบใจจาก แชทชิงโชค กรุณาติดต่อกลับหลังรายการจับรางวัลจบ')
					res.send('success!')
				})
				.catch(error => {
					res.send(error)
				})
		}
	}

	module.sendCoupon = function (req, res) {
		if (req.query['approveCommand'] != 'IAgreeToGiveTheseCouponToPlayersWhoMetRequirement') res.json({ error: "you don't have permission" })
		else if (!req.query['dateOfEvent']) res.json({ error: 'invalid parameters' })
		else {
			let participants = null
			let usersData = null

			// let allPlayers = []
			let whoGetPlayCoupon = []
			let topUsers = []
			let whoGetSpecialBonus = []

			let bestScore = 0
			let date = req.query['dateOfEvent']
			let bonusQuestion = req.query['bonusQ'] && !isNaN(req.query['bonusQ']) ? req.query['bonusQ'] : -1
			console.log(`bonus q = ${bonusQuestion}`)

			db
				.ref(`couponSchedule/${date}`)
				.once('value')
				.then(csSnap => {
					let couponSchedule = csSnap.val()
					if (!couponSchedule || couponSchedule == null) throw 'event time error, check couponSchedule'

					return db.ref('participants').once('value')
				})
				.then(partSnap => {
					participants = partSnap.val()

					let allPlayers = Object.keys(participants).map(key => {
						if (participants[key].point > bestScore) bestScore = participants[key].point

						let answerAmount = participants[key].answerPack.reduce((collector, ansDetail) => {
							return ansDetail.ans ? collector + 1 : collector
						}, 0)

						// console.log(`answer count = ${answerAmount}`)
						if (bonusQuestion > -1) {
							return {
								id: key,
								point: participants[key].point,
								answerCount: answerAmount,
								played_reward_coupon: answerAmount >= 3 ? true : false,
								specialBonus: participants[key].answerPack[bonusQuestion].correct ? true : false
							}
						} else {
							return {
								id: key,
								point: participants[key].point,
								answerCount: answerAmount,
								played_reward_coupon: answerAmount >= 3 ? true : false,
								specialBonus: false
							}
						}
					})

					whoGetSpecialBonus = allPlayers.filter(user => {
						return user.specialBonus
					})

					whoGetPlayCoupon = allPlayers.filter(user => {
						return user.played_reward_coupon
					})

					topUsers = allPlayers.filter(user => {
						return user.point == bestScore
					})

					/*
				res.json({
					error: null,
					allPlayersCount: allPlayers.length,
					whoGetPlayCouponCount: whoGetPlayCoupon.length,
					topUsersCount: topUsers.length,
					underline: '___________________________________',
					allPlayers: allPlayers,
					whoGetPlayCoupon: whoGetPlayCoupon,
					topUsers: topUsers
				})
				*/
					return db.ref('users/').once('value')
				})
				.then(userSnap => {
					usersData = userSnap.val()

					let special_reward_keys = whoGetSpecialBonus.map(player => {
						return player.id
					})

					let played_reward_keys = whoGetPlayCoupon.map(player => {
						return player.id
					})

					let top_reward_keys = topUsers.map(player => {
						return player.id
					})

					let result = {}
					let proofOfCount = 0
					let idInBonus = []

					Object.keys(usersData).map(key => {
						// ticket for users who answer >= 3 times
						if (played_reward_keys.indexOf(usersData[key].fbid) > -1) {
							usersData[key].coupon = usersData[key].coupon == null ? 1 : usersData[key].coupon + 1

							if (usersData[key].couponHistory) {
								usersData[key].couponHistory[date] = {
									playReward: true
								}
							} else {
								usersData[key].couponHistory = {
									[date]: {
										playReward: true
									}
								}
							}

							result[usersData[key].fbid] = {
								key: key,
								id: usersData[key].fbid,
								coupon: usersData[key].coupon
							}
						}

						// special ticket for specific question
						if (special_reward_keys.indexOf(usersData[key].fbid) > -1) {
							proofOfCount++
							idInBonus.push(usersData[key].fbid)
							usersData[key].coupon = usersData[key].coupon == null ? 1 : usersData[key].coupon + 1

							if (usersData[key].couponHistory && usersData[key].couponHistory[date]) {
								usersData[key].couponHistory[date].specialBonus = true
							} else {
								usersData[key].couponHistory = {
									[date]: {
										specialBonus: true
									}
								}
							}
							/*
						result[usersData[key].fbid] = {
							key: key,
							id: usersData[key].fbid,
							coupon: usersData[key].coupon,
							specialTicket: true
						}
						*/
						}

						// bonus for players who get max point
						if (top_reward_keys.indexOf(usersData[key].fbid) > -1) {
							usersData[key].coupon = usersData[key].coupon == null ? 1 : usersData[key].coupon + 1

							if (usersData[key].couponHistory && usersData[key].couponHistory[date]) {
								usersData[key].couponHistory[date].bonusReward = true
							} else {
								usersData[key].couponHistory = {
									[date]: {
										bonusReward: true
									}
								}
							}

							result[usersData[key].fbid] = {
								key: key,
								id: usersData[key].fbid,
								coupon: usersData[key].coupon,
								bonus: true
							}
						}
					})

					if (req.query['mode'] == 99) {
						db
							.ref(`couponSchedule/${date}`)
							.set(false)
							.then(() => {
								console.log(`recorded coupon distribution on ${date}`)
								return db.ref('users').set(usersData)
							})
							.then(() => {
								res.json({
									error: null,
									message: 'Coupon Sent!!'
								})
							})
					} else {
						res.json({
							error: null,
							normal_count: played_reward_keys.length,
							bonus_count: top_reward_keys.length,
							sp_count: special_reward_keys.length,
							counter: proofOfCount,
							result_count: Object.keys(result).length,
							// normal: played_reward_keys,
							// bonus: top_reward_keys,
							users_count: Object.keys(usersData).length,
							usersData: usersData
							// special_reward_keys: special_reward_keys,
							// idInBonus: idInBonus
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
	}

	module.updateCouponBalanceToUsers = function (req, res) {
		let date = req.query['dateOfEvent']
		if (!date) res.json({ error: 'invalid parameters' })
		else {
			let participants = null
			let usersData = null
			let sendResultRequests = []

			util
				.getParticipants()
				.then(partSnap => {
					participants = partSnap.val()
					return db.ref('users').once('value')
				})
				.then(uSnap => {
					usersData = uSnap.val()

					let participantKeys = Object.keys(participants)
					let partWhoGetCoupon = Object.keys(usersData).map(key => {
						let user = usersData[key]
						if (user.coupon > 0) {
							return {
								id: user.fbid,
								totalCoupon: user.coupon,
								bonus: user.couponHistory && user.couponHistory[date] && user.couponHistory[date].bonusReward
							}
						} else return null
					})

					// remove null
					partWhoGetCoupon = partWhoGetCoupon.filter(user => {
						return user != undefined
					})

					// filter to get only user who played the last game
					partWhoGetCoupon = partWhoGetCoupon.filter(user => {
						return participantKeys.indexOf(user.id) > -1
					})

					// only send to user who get coupon
					let testA = []
					partWhoGetCoupon.forEach(user => {
						let bodyData = {
							recipient: {
								id: user.id
							},
							message: {
								text: `ระบบได้อัพเดตคูปองให้คุณแล้ว ปัจจุบันคุณมีคูปองรวม ${user.totalCoupon} คูปอง`
							}
						}

						if (user.bonus) bodyData.message.text += ' ขอแสดงความยินดีด้วย เพราะคุณเป็นหนึ่งในผู้เล่นที่มีคะแนนสูงสุดประจำสัปดาห์นี้ :D'

						testA.push(bodyData.message.text)

						sendResultRequests.push({
							method: 'POST',
							relative_url: 'me/messages?include_headers=false',
							body: param(bodyData)
						})
					})

					messengerFunctions.sendBatchMessage(sendResultRequests)

					res.json({
						error: null,
						// result: partWhoGetCoupon,
						// textToBeSent: testA
						amount: testA.length,
						message: 'message is on the way!'
					})
				})
				.catch(error => {
					console.error(`there's an error in update Coupon: ${error}`)

					res.json({
						error: error
					})
				})
		}
	}

	module.sendToAll = function (req, res) {
		let batchRequests = []

		db
			.ref('users')
			.once('value')
			.then(userSnap => {
				let allUsers = userSnap.val()

				Object.keys(allUsers).forEach(key => {
					let bodyData = {
						recipient: {
							id: allUsers[key].fbid
						},
						message: {
							text: 'ขณะนี้การ Live จับรางวัลได้เริ่มต้นขึ้นแล้ว\r\nสามารถดู Live ได้ที่ https://www.youtube.com/watch?v=RcdIwrSazRQ\r\nบอกไว้ก่อนว่าถ้าจับได้หมายเลขของคุณ แต่คุณไม่ได้ดูอยู่ เราจะข้ามไปให้คนถัดไปทันทีนะ'
						}
					}

					batchRequests.push({
						method: 'POST',
						relative_url: 'me/messages?include_headers=false',
						body: param(bodyData)
					})
					// sendTextMessage(id, text)
				})

				messengerFunctions.sendBatchMessageWithDelay(batchRequests, 200)
				res.send('sent!')
			})
			.catch(error => {
				res.json({
					error: error
				})
			})
	}

	// ----------------------------------- WEB API

	module.addNewUserFromWeb = function (req, res, messenger_env) {
		let uid = req.body.userID // || req.query['xuid']
		let firebaseAuth = req.body.firebaseKey

		if (!uid || !firebaseAuth) res.json({ error: 'no userID or Firebase Auth key' })
		else {
			console.log(`in else ${uid}`)
			axios
				.get(`https://graph.facebook.com/v2.10/${uid}/ids_for_pages`, {
					params: {
						page: '1849513501943443', // DS page ID
						appsecret_proof: messenger_env.proof,
						access_token: messenger_env.access_token,
						include_headers: false
					}
				})
				.then(response => {
					if (response.status == 200) {
						if (response.data.data.length < 1) throw { error: 'This user need to chat on page first', error_code: 5555 }

						let data = response.data.data[0]
						console.log(`data.id : ${data.id}`)
						userManagementAPI.recordNewUserID_FBlogin(uid, data.id, firebaseAuth).then(userData => {
							res.json({
								error: null,
								PSID: userData.PSID,
								firstName: userData.firstName,
								lastName: userData.lastName,
								coupon: userData.coupon
							})
						})
					} else
						res.json({
							error: `response with status code ${response.status}`,
							error_code: `HTTP status code ${response.status}`
						})
				})
				.catch(err => {
					if (err.error_code == 5555) {
						res.json({
							error: err.error,
							error_code: err.error_code
						})
					} else
						res.json({
							error: err.response.data.error.message,
							error_code: err.response.data.error.code
						})
				})
		}
	}

	module.answerFromWeb = function (req, res) {
		let PSID = req.body.PSID
		let answer = req.body.answer
		let normalizedAnswer = answer.trim().toLowerCase() // for string answer

		if (!PSID || !answer) res.json({ error: 'no PSID, answer data found' })
		else {
			let participantInfo = null
			let status = null

			db
				.ref(`participants/${PSID}`)
				.once('value')
				.then(partSnap => {
					participantInfo = partSnap.val()

					if (participantInfo == null) throw `error getting info of participant id : ${PSID}`
					else return util.getStatus()
				})
				.then(fStatus => {
					status = fStatus

					if (!status.playing) throw { code: 1, message: 'quiz not started' }
					else if (!status.canAnswer) throw { code: 1, message: 'quiz timeout' }
					else if (participantInfo.answerPack[status.currentQuiz].ans.length > 0) throw { code: 2, message: 'already answered' }
					else return db.ref(`quiz/${status.currentQuiz}`).once('value') // status.playing && status.canAnswer
				})
				.then(quizSnap => {
					let quiz = quizSnap.val()
					let quizType = quiz.type
					let isCorrect = false

					if (!quiz.type == 'STRING' && !quiz.type == 'CHOICES' && !quiz.type == 'VOTE') throw { code: 2, message: 'what the f with this quiz, it has no choices and not support string answer' }
					else if (quiz.type == 'CHOICES') {
						// if (quiz.choices.indexOf(answer) == -1 ) throw { code: 2, message: 'answer not in choices scope ?!' }
						// else if (answer == quiz.a) isCorrect = true
						if (Array.isArray(quiz.a)) {
							if (quiz.a.indexOf(answer) >= 0) isCorrect = true
						} else {
							if (quiz.a == answer) isCorrect = true
						}
					} else if (quiz.type == 'STRING' && quiz.a.indexOf(normalizedAnswer) > -1) isCorrect = true

					if (isCorrect) {
						participantInfo.answerPack[status.currentQuiz].correct = true
						participantInfo.point++
					}

					participantInfo.answerPack[status.currentQuiz].at = new Date().getTime()
					participantInfo.answerPack[status.currentQuiz].ans = answer

					db
						.ref(`participants/${PSID}/`)
						.set(participantInfo)
						.then(() => {
							console.log(`update participant [${PSID}] answer for quiz no [${status.currentQuiz}] success`)

							res.json({
								error: null,
								message: 'update success'
							})
						})
				})
				.catch(error => {
					console.log(`Error found in [answerFromWeb]: ${error}`)

					if (error.code) {
						console.log(`Error found in [answerFromWeb]: ${JSON.stringify(error)}`)
						res.json({ error: error.code, message: error.message })
					} else res.json({ error: 3, message: error })
				})
		}
	}

	// --------- END HERE

	return module
}
