const firebaseInit = require('./firebase-settings.js')
const messengerAPI = require('./API/messengerProfile.js')
const userManagementAPI = require('./API/userManagement.js')
const param = require('jquery-param')
const axios = require('axios')
const messengerTemplates = require('./FBMessageTemplate/templates.js')
const db = firebaseInit.admin.database()

/*
	LIST
	
		sendCoupon
		updateCouponBalanceToUsers
		assignCouponNumber
		sendToAll ___ tell users that lucky draw is about to start
		getCouponPair
		sendCouponNumber
		addCouponNumber
		addWinner
		sendMessageToWhoGetSmallPrize

*/

module.exports = function (util, messengerFunctions) {

	let module = {}

	// -----------------------------------------------
	// send invite to join upcoming game
	// -----------------------------------------------
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

	// -----------------------------------------------
	// send message to tell users that coupons were update
	// -----------------------------------------------
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


	// -----------------------------------------------
	// assign coupon number
	// -----------------------------------------------
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

	// -----------------------------------------------
	// tell users that lucky draw is about to start
	// -----------------------------------------------
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

				// messengerFunctions.sendBatchMessageWithDelay(batchRequests, 200)
				messengerFunctions.sendBatchMessage(batchRequests)
				res.send('sent!')
			})
			.catch(error => {
				res.json({
					error: error
				})
			})
	}

	// -----------------------------------------------
	// get Coupon Pair using coupon number
	// -----------------------------------------------
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

	// -----------------------------------------------
	// send coupon number to users
	// -----------------------------------------------
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

				// messengerFunctions.sendBatchMessageWithDelay(requestArray, 500)
				messengerFunctions.sendBatchMessage(requestArray)

				res.json({
					error: null,
					message: 'works fine... ?'
				})
			})
			.catch(error => {
				console.log(`send coupon number error : ${error}`)
			})
	}

	// -----------------------------------------------
	// add winners to DB to allow them to contact us through messenger
	// -----------------------------------------------
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

	// -----------------------------------------------
	// tell small prize winners that they got prize
	// -----------------------------------------------
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

	// --------- END HERE

	return module
}
