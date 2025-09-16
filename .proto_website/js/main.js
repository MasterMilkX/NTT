//// MAIN GAME CODE

// canvas setup
var canvas = document.getElementById('game-screen');
var ctx = canvas.getContext('2d');
canvas.width = 1600;
canvas.height = 900;

// TODO: Keep track of avatars via the server
var avatar_list = []; // list of all avatars in the game
var USERNAME = "TotallyChicken3"; // default username for testing purposes

var ui_overlay = document.getElementById("game-ui"); // the game UI overlay


//////////////////////////      FUNCTIONS      //////////////////////////





///////// RENDER /////////

// DRAWS THE GAME
function render(){
    ctx.save();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // background
    ctx.fillStyle = "#dedede";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // draw a temporary world
    if (cur_location == "" || !MAP_IMG_SET[cur_location]) {
        ctx.fillStyle = "#000"; // black void background for unknown locations
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }else
        ctx.drawImage(MAP_IMG_SET[cur_location], 0, 0, canvas.width, canvas.height);


    // draw the avatars
    for (var i = 0; i < avatar_list.length; i++) {
        var avatar = avatar_list[i];
        if (avatar && avatar.show) {
            avatar.render(ctx); // render the avatar on the canvas
        }
    }

    ctx.restore();
}

//// UPDATE LOOP ////

function update() {
    for (var i = 0; i < avatar_list.length; i++) {
        var avatar = avatar_list[i];
        if (avatar && avatar.show) {
            // update the avatar's position and other properties
            avatar.update(); // assuming the avatar class has an update method
        }
    }
}




//// EVENT HANDLERS ////


// remove all avatars from the game
// TODO: remove just the one avatar of the current user
function removeAvatar(){
    avatar_list = []; // clear the avatar list
    render(); // re-render the game screen
}

// add a new avatar to the game
function addAvatar(location){
    var new_avatar = new Avatar(USERNAME, "chicken", "chicken", "AP"); // create a new avatar instance
    new_avatar.setPos(800, 450); // set the initial position of the avatar
    avatar_list.push(new_avatar); // add the avatar to the list
}

function getAvatar(username){
    // find the avatar with the given username
    for (var i = 0; i < avatar_list.length; i++) {
        var avatar = avatar_list[i];
        if (avatar && avatar.show && avatar.username === username) {
            return avatar; // return the avatar if found
        }
    }
    return null; // return null if no avatar with the given username is found
}


// Change relative position of the cursor
function getCursorPos(e){
    let curs = {offx:0, offy:0};
    let rect = {left:0, top:0, width:canvas.width, height:canvas.height}; // default rect for canvas

    //mouse
    if(e instanceof MouseEvent){
        rect = e.target.getBoundingClientRect();
        curs.offx = e.offsetX;
        curs.offy = e.offsetY;
    }
    //touch
    else if(e instanceof TouchEvent){
        rect = e.target.getBoundingClientRect();
        let touch = e.touches[0] || e.changedTouches[0];
        curs.offx = touch.pageX - rect.left;
        curs.offy = touch.pageY - rect.top;
    }

    curs.offx = Math.floor(curs.offx * (canvas.width / rect.width));
    curs.offy = Math.floor(curs.offy * (canvas.height / rect.height));

    return curs;
}


function gameClick(e){
    let target = e.target.id; // get the target element id or unknown if not available

    if (!target || target !== "game-ui") {
        return; // ignore clicks outside the game UI
    }

    

    // check if the click is on an avatar
    if (clickAvatar(e)) {
        return; // if an avatar was clicked, do not proceed further
    }else if (document.getElementById("vote-ui").style.display === "block") {
        hideVoteUI(); // hide the vote UI if it is open and no avatar was clicked
        return; // do not proceed further if the vote UI is open
    }
    let curs = getCursorPos(e); // get the cursor offset
    let x = curs.offx;
    let y = curs.offy;
    console.log(`Click at (${x}, ${y}) on ${target}.`);

    // move the avatar to the clicked position
    var avatar = getAvatar(USERNAME); // get the avatar of the current user
    if (avatar) {
        avatar.setNextPos(x, y); // set the next position of the avatar to the clicked position
        avatar.gotoPos(); // start moving the avatar towards the next position
    }

    // handle other game UI interactions here

}


// check if the click is on an avatar
function clickAvatar(e){
    let curs = getCursorPos(e); // get the cursor offset
    let x = curs.offx;
    let y = curs.offy;

    // check if the click is on an avatar
    for (var i = 0; i < avatar_list.length; i++) {
        var avatar = avatar_list[i];
        if (avatar.wasClicked(x, y)) { 
            // handle avatar click
            console.log("Avatar clicked:", avatar.username);
            avatar.highlight = true; // highlight the clicked avatar
            voteChar(avatar.username); // open the vote UI with the clicked avatar's username
            return true;
        }else {
            avatar.highlight = false; // remove highlight if not clicked
        }
    }
    //hideVoteUI(); // hide the vote UI if no avatar was clicked
    return false; // no avatar was clicked
}

function sendMessage(){
    var msg = document.getElementById("chat-input").value; // get the chat message from the input field
    if (!msg || msg.trim() === "") {
        return; // do not send empty messages
    }

    // send a chat message to the server
    var avatar = getAvatar(USERNAME); // get the avatar of the current user
    if (avatar) { // check if the avatar exists and the message is not empty
        avatar.setChatMsg(msg); // set the chat message for the avatar
        document.getElementById("chat-input").value = ""; // clear the input field after sending the message
        console.log(`Message sent: ${msg}`); // log the message to the console
    }
}


function showClickPos(e){
    let target = e.target.id; // get the target element id or unknown if not available

    if (!target || target !== "game-ui") {
        return;
    }

    let curs = getCursorPos(e); // get the cursor offset
    let x = curs.offx;
    let y = curs.offy;

    console.log(`Click at (${x}, ${y}) on ${target}.`);

    // hidde the vote UI if the click is not on the game UI
    hideVoteUI();
}

// mouse + touch event listeners for the "canvas" (really just the ui-overlay on top)
ui_overlay.addEventListener('click', gameClick);
ui_overlay.addEventListener('touchstart', gameClick);

// shortcuts
window.onkeydown = function(e) {
    
    
    if(!document.activeElement || document.activeElement.tagName !== 'INPUT') {
        e.preventDefault(); // prevent default behavior of the key press
        if(e.key == 't'){
            toggleTasks(); // toggle the task list when T is pressed
        }else if(e.key == 'Escape'){
            if(document.getElementById("vote-ui").style.display === "block")
                hideVoteUI(); // hide the vote UI when Escape is pressed
        }
        else if(e.key == 'm'){
            if(document.getElementById("map-popup").style.display !== "none")
                closePopups(); // hide the map popup when M is pressed
            else
                showPopup("map"); // show the map popup when M is pressed
        }
        else if(e.key == 'Tab'){
            document.getElementById("chat-input").focus(); // focus the chat input when Left Shift is pressed
        }
    }else{
        if (e.key === 'Enter') {
            sendMessage(); // send the chat message when Enter is pressed
        }else if (e.key === 'Escape') {
            document.activeElement.blur(); // remove focus from the input field when Escape is pressed
        }
    }
    
}



// INITIALIZATION FUNCTION 
function init(){
    setMapCells(); // populate the map cells in the popup menu
    //showPopup("welcome")
    startGame(); // start the game immediately for testing purposes
}

// MAIN GAME LOOP
function main() {
    render();
    update(); // update the game state
    requestAnimationFrame(main);
}

main();