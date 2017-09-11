function templates() {}
/*
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
  */
/*
  "quick_replies":[
        {
          "content_type":"text",
          "title":"Red",
          "payload":"DEVELOPER_DEFINED_PAYLOAD_FOR_PICKING_RED"
        }
      ]
  
  */

/*
    "quick_replies":[
        {
          "content_type":"text",
          "title":"Red",
          "image_url":"http://example.com/img/red.png",
          "payload":"DEVELOPER_DEFINED_PAYLOAD_FOR_PICKING_RED"
        }
      ]
  */

templates.prototype.textMessage = function(text) {

	var obj = {
		message: {
			text: text
		}
	}
	return obj
}

templates.prototype.imageMessage = function(imgURL) {
	var obj = {
		message: {
			attachment: {
				type: 'image',
				payload: {
					url: imgURL
				}
			}
		}
	}
	return obj
}
templates.prototype.quickReplyObject = function(title, textPayload, imgURL = undefined) {
	var obj = {
		content_type: 'text',
		title: title,
		image_url: imgURL,
		payload: textPayload
	}
	return obj
}
templates.prototype.quickReplyMessage = function(headerText, arrayOfQuickReplies) {
  if(arrayOfQuickReplies.length>11 || arrayOfQuickReplies.length<=0){
    return null;
  }
	var obj = {
		message: {
			text: headerText,
			quick_replies: arrayOfQuickReplies
		}
	}
	return obj
}
let asdf = new templates()

module.exports = asdf
