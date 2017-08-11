
const FB = require('fbgraph')
const axios = require('axios')
const param = require('jquery-param')
const firebaseInit = require('./firebase-settings.js')

const functions = firebaseInit.functions
const admin = firebaseInit.admin
const env = firebaseInit.env
const db = admin.database()

/*
test function

https://graph.facebook.com/v2.10/125837970785202_1407107829324870/sharedposts?access_token=appKey|appSecret

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
        "next": "https://graph.facebook.com/v2.10/125837970785202_1407107829324870/sharedposts?access_token=1815661628655343%7Cd11dafa5ca2e91288af711bea4b98cbf&pretty=1&limit=25&after=MTU5MTM2OTM1NDI3MTI5Mzo5OjAZD"
    }

}



*/
