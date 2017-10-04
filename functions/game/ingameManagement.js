const firebaseInit = require('../firebase-settings.js')
const messengerAPI = require('../API/messengerProfile.js')
const userManagementAPI = require('../API/userManagement.js')
const param = require('jquery-param')
const axios = require('axios')
const db = firebaseInit.admin.database()

/*
	LIST
	
		getOverallStatus
		sendQuiz
		getParticipants
		showRandomCorrectUsers
		getTopUsers
		selectVoteAnswer		

*/

module.exports = function (util, messengerFunctions) {

	let module = {}

	// -----------------------------------------------
	// get status, use to check if database works well
	// -----------------------------------------------
	module.getOverallStatus = function (req, res) {

		let cq = -1
		let fqa = null
		let q = null
		let p = []
		let ucount = 0

		util.getStatus()
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
	
	// -----------------------------------------------
	// send batch message quiz 
	// -----------------------------------------------
	module.sendQuiz = function (req, res) {

		let status = null
		let participants = null
		let quiz = null
		let fireQuizAt = null

		util.getStatus()
			.then(fetchedStatus => {
				status = fetchedStatus
				return util.getFireQuizAt()
			})
			.then(fqaSnapshot => {
				fireQuizAt = fqaSnapshot.val()
				return util.getParticipants()
			})
			.then(participantsSnapshot => {
				participants = participantsSnapshot.val()
				return util.getQuiz()
			})
			.then(quizSnapshot => {
				quiz = quizSnapshot.val()

				if (!status.playing) db.ref('playing').set(true)

				if (!quiz)
					res.json({
						error: 'quiz not ready, try again later',
						quiz: quiz
					})
				else if (!participants)
					res.json({
						error: 'no participants, try again later'
					})
				else {
					let oldc = status.currentQuiz
					if (req.query.next == 'true' && status.currentQuiz < quiz.length) {
						db.ref('currentQuiz').set(status.currentQuiz + 1)
						status.currentQuiz += 1
						console.log(`update currentQuiz to ${oldc + 1} // is it : ${status.currentQuiz}`)
					}

					if (status.currentQuiz > quiz.length - 1 || status.currentQuiz < 0)
						res.json({
							error: 'quiz no. out of bound',
							currentQuiz: status.currentQuiz,
							suggestion: "if this is the first question don't forget to use ?next=true param"
						})
					else {
						let quickReplyChoices = []
						let answerTime = req.query.timer ? parseInt(req.query.timer) + 10 : 70

						db.ref('answerWindow').set(answerTime)

						// check if this quiz has choices
						if (quiz[status.currentQuiz].choices) {
							quickReplyChoices = quiz[status.currentQuiz].choices.map(choice => {
								return {
									content_type: 'text',
									title: choice,
									payload: choice
								}
							})
						}

						// ---------- start preparing batch request

						let sendQuizBatch = []

						Object.keys(participants).forEach(id => {
							let quizBodyData = {
								recipient: {
									id: id
								},
								message: {
									text: quiz[status.currentQuiz].q
								}
							}

							// if chocies prepared, add choices to quick replies button
							if (quickReplyChoices.length > 0) {
								quizBodyData.message.quick_replies = quickReplyChoices
							}

							sendQuizBatch.push({
								method: 'POST',
								relative_url: 'me/messages?include_headers=false',
								body: param(quizBodyData)
							})
						})

						if (!fireQuizAt) fireQuizAt = Array(quiz.length).fill(0)

						if (fireQuizAt[status.currentQuiz] == 0) {
							fireQuizAt[status.currentQuiz] = new Date().getTime()

							db.ref('fireQuizAt').set(fireQuizAt)
								.then(() => {
									return db.ref('canAnswer').set(true)
								})
								.then(() => {
									console.log('sync SENDING')
									messengerFunctions.sendBatchMessageWithDelay(sendQuizBatch, 10)
									// sendBatchMessageWithDelay2(sendQuizBatch, 200)

									res.json({
										error: null,
										qno: status.currentQuiz,
										q: quiz[status.currentQuiz].q,
										choices: quiz[status.currentQuiz].choices
									})
								})
						} else {
							db.ref('canAnswer').set(true)
							.then(() => {
								console.log('sync SENDING / not set new FQA')
								messengerFunctions.sendBatchMessageWithDelay(sendQuizBatch, 10)
								// sendBatchMessageWithDelay2(sendQuizBatch, 200)

								res.json({
									error: null,
									qno: status.currentQuiz,
									q: quiz[status.currentQuiz].q,
									choices: quiz[status.currentQuiz].choices
								})
							})
						}
					}
				}
			})
			.catch(error => {
				console.log(`there's an error in sendQuiz: ${error}`)
				res.end()
			})

	}


	// -----------------------------------------------
	// get participants status while playing
	// -----------------------------------------------
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

	// -----------------------------------------------
	// get list of random corrected user
	// -----------------------------------------------
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

	// -----------------------------------------------
	// get list of users with best score
	// -----------------------------------------------
	module.getTopUsers = function (req, res) {
		let fq = null
		let participants = null

		util
			.getFireQuizAt()
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


	// -----------------------------------------------
	// select vote choice to make it correct answer
	// -----------------------------------------------
	module.selectVoteAnswer = function (req, res) {

		let selectedChoice = req.body.choice
		let point = (req.body.point) ? 1 : 0 // req.body.point -- bool
		let selectedAnswer = null
		let currentQuiz = -1


		if (req.method == 'GET') res.status(403).json({ error: 'Forbidden Request' })
		else if ( selectedChoice != 0 && !selectedChoice) res.json({ error: 'no choice was selected' })
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
				let updates = {}

				Object.keys(participants).map(key => {
					let playerAnswerInfo = participants[key].answerPack[currentQuiz]

					if (playerAnswerInfo.ans == selectedAnswer && !playerAnswerInfo.correct) {
						playerAnswerInfo.correct = true
						participants[key].point = participants[key].point + point

							
						if (key == '1425637910807433') console.log(`point : ${participants[key].point}`)

						updates[`/${key}/answerPack/${currentQuiz}`] = playerAnswerInfo
						updates[`/${key}/point`] = participants[key].point
					}
				})

				db.ref('participants').update(updates)
				.then(() => {
					console.log('update completed')
					res.json({
						error: null,
						message: 'updated!'
					})
				})

			})
			.catch(error => {
				console.error(`selectVoteAnswer error: ${error}`)
				res.json({
					error: error,
					message: 'error found'
				})
			})

		}

	}

	// --------- END HERE

	return module
}
