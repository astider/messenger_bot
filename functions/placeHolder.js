
const FB = require('fbgraph')
const axios = require('axios')
const param = require('jquery-param')
const firebaseInit = require('./firebase-settings.js')

const functions = firebaseInit.functions
const admin = firebaseInit.admin
// const env = firebaseInit.env
const env = functions.config()
const db = admin.database()

/*
test function

https://graph.facebook.com/v2.10/125837970785202_1407107829324870/sharedposts?access_token=appKey|appSecret
after /v2.10/ is a pageid_postid






This graph API request requests shared posts data of post from a choosen Droidsans page's post

and will use app key and secret as a token, kept in NODE_ENV of firebase

the "data" field below contains actual shared posts, which consist of "id"(of post) "story", optional "message",

"id" is in a form of userid_postid ,of which userid can be extracted with very simple regex (\d+)_\d+
and be used to request actual public profile of the users if needed.
{

    "data": [
        {
            "created_time": "2017-08-11T11:24:44+0000",
            "story": "Rebert Apptester shared DroidSans's post.",
            "id": "104336860274776_108995116475617"

        },
        {
            "created_time": "2017-08-10T07:31:41+0000",
            "message": "แชร์ของเก่าแจ้",
            "story": "ธนาธิป สุนทรทิพย์ shared DroidSans's post.",
            "id": "10209731896163248_10209750402825903"
        },
        {
            "created_time": "2017-08-08T07:01:02+0000",
            "message": "อาจจะเป็นแสงสว่างเล็กๆ ที่ปลายอุโมงค์ของแฟนๆ LG ในบ้านเราครับ ^ ^",
            "id": "373920162662677_1424878910900125"
        },
        {
            "created_time": "2017-08-08T06:22:12+0000",
            "message": "มาเถอะ",
            "story": "Parcusto Fashion & Design shared DroidSans's post.",
            "id": "371811892893718_1591369354271293"
        }
    ],
    "paging": {
        "cursors": {
            "before": "MTA4OTk1MTE2NDc1NjE3Ojk6MAZDZD",
            "after": "MTU5MTM2OTM1NDI3MTI5Mzo5OjAZD"
        },
        "next": "https://graph.facebook.com/v2.10/125837970785202_1407107829324870/sharedposts?access_token=appID|appsecret"
    }

}
https://graph.facebook.com/v2.10/{userID}?access_token=appKey|appSecret
this URL makes a request for user (public) detail such as Full Name

we will have to match users by "name"

*/
function axiousRequestForFBSharedPost(startURL){
var completeData = [];

  const getFBShared = URL => axios.get(
       URL
   ).then(response => {
    //  console.log(response.data)
       // add the contacts of this response to the array
       if(response.data.data.length>0)completeData= completeData.concat(response.data.data);
       if (response.data.paging) {
           return getFBShared(response.data.paging.next);
       } else {
           // this was the last page, return the collected contacts
           return completeData;
       }
   }).catch(error=>{
     console.log(error)
     return error;
   });
   return getFBShared(startURL);



}







exports.getSharedPostsByApp = function getSharedPostsByApp (pageID,postID,request,response){
  // page scope ID of page "DS" is used as the main ID
  //
  // We have to use access_token in query

    axiousRequestForFBSharedPost(`https://graph.facebook.com/v2.10/${pageID}_${postID}/sharedposts?access_token=${env.chatchingchokeapp.app_id}|${env.chatchingchokeapp.app_secret}`)

    .then(res => {

        response.json({ body:res })


  })
    .catch(error => {
      console.log('Shareposts count error ')
      console.log(`${error}`)
      response.status(500).json({ error:error })
    })

}
