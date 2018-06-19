
function createUserInterface(actioncallback) {

var usermap = new Map();

var usrinterface = document.createElement('div'); 

var usrlist = document.createElement('div');
usrinterface.style = "height:310px; overflow: auto; webkit-touch-callout: none; -webkit-user-select: none; -khtml-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none; display: flex; width: 400px; flex-direction: row-reverse";
//usrinterface.classList.add("shadowb");
//usrinterface.classList.add("blueback");
usrlist.style = 'display: flex; flex-direction: column; flex-grow: 1; overflow: auto;'

usrinterface.appendChild(usrlist)


var usrnamediv = document.createElement('div');
usrnamediv.style = "display: flex; margin: 2px; border-bottom: 1px solid rgb(70, 65, 130);"
usrnamediv.innerHTML = '<div style="flex-grow: 1; margin-left: 2px;" >Name:</div>'
var namedisp = document.createElement('div')
namedisp.style.marginRight = "5px" 
usrnamediv.appendChild(namedisp)

usrlist.appendChild(usrnamediv);

usrinterface.isadmin = false;

var chat = document.createElement('div')
chat.style = "display: flex; flex-direction: column; margin: 2px;"
usrinterface.appendChild(chat)

chat.classList.add("lightb");


var chatList = document.createElement('div')
chatList.style = "flex-grow: 1; max-height: 100%; overflow: auto; word-break: break-all; margin-bottom: 5px; border-right: 1px solid rgb(70, 65, 130); width: 305px;"
chat.appendChild(chatList)

var chatInput = document.createElement('textarea')
chatInput.style = "resize: none; width: 300px"
chatInput.maxLength = 300
chatInput.addEventListener("keyup", function(event) {
	if (event.key === "Enter") {
		var json = { Text:  chatInput.value }
		chatInput.value = ""
		actioncallback( JSON.stringify(json) );
	}
});
chat.appendChild(chatInput)


function addUser(username) {

	var u = usermap.get(username)

	if (u !== undefined ) {
		return
	}


	console.log(username);
	var u = document.createElement('div');
	u.style = "display: flex; margin: 3px; flex-shrink: 0;"
	u.namediv = document.createElement('div');
	usermap.set(username, u);
	u.namediv.innerHTML = username;
	u.namediv.style = "flex-grow: 1;";
	//u.namediv.innerHTML = '<div style="flex-grow: 1; margin-left: 2px;" >' + username + '</div>'
	u.appendChild(u.namediv);

	if (usrinterface.isadmin) {
		var uUndo = document.createElement('button');
		uUndo.innerHTML = "undo";
		uUndo.onclick = function() {
			var json = '{ "User": "' + u.namediv.innerHTML + '", "Undo": {} }'
			console.log(u.namediv.innerHTML);
			actioncallback( json );
		}
		u.appendChild(uUndo);

		var uBan = document.createElement('button');
		uBan.innerHTML = "Ban";
		uBan.onclick = function() {
			var json = '{ "Ban": "' + u.namediv.innerHTML + '"}'
			console.log(u.namediv.innerHTML);
			actioncallback( json );
		}
		u.appendChild(uBan);

		var uUnban = document.createElement('button');
		uUnban.innerHTML = "Unban";
		uUnban.onclick = function() {
			var json = '{ "Unban": "' + u.namediv.innerHTML + '"}'
			console.log(u.namediv.innerHTML);
			actioncallback( json );
		}
		u.appendChild(uUnban);
	}
	usrlist.appendChild(u);

}
usrinterface.addUser = addUser

function yourName(yn) {
	usrinterface.name = yn;
	namedisp.innerHTML = yn;
	namedisp.onclick = function() {
		namedisp.style.display = "none"
		var input = document.createElement('input')
		input.style.width = "70px";
		input.maxLength = 5
		input.value = namedisp.innerHTML
		usrnamediv.appendChild(input)
		input.addEventListener("keyup", function(event) {
			if (event.key === "Enter") {
				var json = '{ "NameChange": "' + input.value + '" }'
				console.log(json);
				actioncallback( json );
				usrnamediv.removeChild(input)
				namedisp.style.display = "block"
			}
		});
	}

	if (usrinterface.isadmin) {

		usrinterface.style.width = "500px"

		var uUnbanAll = document.createElement('button');
		uUnbanAll.innerHTML = "Unban Everyone";
		uUnbanAll.onclick = function() {
			var json = '{ "Unban": "all"}'
			actioncallback( json );
		}
		usrlist.appendChild(uUnbanAll);
	}
}
usrinterface.yourName = yourName

// TODO: namechange also needs to update the map obviously
function nameChange(nc) {
	if (namedisp.innerHTML == nc.from) {
		namedisp.innerHTML = nc.to
		usrinterface.name = nc.to
	} else {
		var u = usermap.get(nc.from)
		usermap.delete(nc.from)
		u.namediv.innerHTML = nc.to;
		usermap.set(nc.to, u)

	}
}
usrinterface.nameChange = nameChange

function removeUser(username) {

	if (!usrinterface.isadmin) {
		var u = usermap.get(username)
		if (u != null) {
			usrlist.removeChild(u)
			usermap.delete(username) 
		} 
	}
}
usrinterface.removeUser = removeUser

function newText(message) {
	var t = document.createElement('div')
	t.innerHTML = message.User + " : " + message.Text
	chatList.appendChild(t)
	chatList.scrollTo(0,chatList.scrollHeight)
}
usrinterface.newText = newText


return usrinterface

}