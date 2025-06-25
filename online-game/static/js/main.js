//// MAIN GAME CODE

// canvas setup
var canvas = document.getElementById('game-canvas');
var ctx = canvas.getContext('2d');
canvas.width = 800;
canvas.height = 450;

// player sprite sheet
var spr_sheet = new Image();
spr_sheet.src = '/static/assets/ShireSpriteSheet.png'; // path to your sprite sheet image
var spr_loaded = false;
spr_sheet.onload = function() {
    spr_loaded = true;
};

// PLAYER PROPERTIES
var all_avatars = null;
var avatar_name = "";
var socket_avatar = null;
var highlight_avatar = null;

var char_dat = {}; // character data for the player
var cur_location = "";      // current location of the player out of the 9 areas
var has_joined = false;
var role_type = ""; // default role type for testing purposes



var ui_overlay = document.getElementById("game-ui"); // the game UI overlay


//////////////////////////      FUNCTIONS      //////////////////////////

function dist(pos1, pos2){
    // calculate the distance between two points
    return Math.sqrt(Math.pow(pos2.x - pos1.x, 2) + Math.pow(pos2.y - pos1.y, 2));
}

function inArr(arr, val){
    // check if a value is in an array
    return arr.indexOf(val) != -1;
}



///////// RENDER /////////


function renderAvatar(p){
    // username
    /*
    ctx.font = "16px Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = "black";
    ctx.fillText(p.name, p.position.x, p.position.y + 40);
    */
   if(!localAvatar(p) || !spr_loaded) // check if the avatar is local and the sprite sheet is loaded
        return; // do not render the avatar if it is not local


    // highlight
    if(highlight_avatar && highlight_avatar == p.id) {
        // draw a highlight circle under the avatar if it is highlighted
        ctx.beginPath();
        ctx.ellipse(p.position.x-2, p.position.y+p.sprite.height/2, 16, 8, 0, 0, Math.PI * 2); // use the click radius as the highlight radius
        ctx.fillStyle = "yellow"; // set the highlight color
        ctx.lineWidth = 5; // set the highlight line width
        ctx.fill(); // draw the highlight circle
    }

    // draw sprite from sprite sheet
    ctx.drawImage(spr_sheet, 
        (p.sprite.width * p.sprite.frame), 
        (p.sprite.height * AVATAR_RACE[p.raceType]), 
        p.sprite.width, 
        p.sprite.height, 
        p.position.x - p.sprite.width/2, // center the sprite
        p.position.y - p.sprite.height/2, // center the sprite
        p.sprite.width, // resize width
        p.sprite.height // resize height
    );

    // draw the class clothes on top (TODO: underneath the sprite)
    ctx.drawImage(spr_sheet,
        (p.sprite.width * AVATAR_CLASS[p.classType]), 
        (p.sprite.height * 6), // assuming class clothing are in row 6
        p.sprite.width,
        p.sprite.height,
        p.position.x - p.sprite.width/2 , // center the sprite
        p.position.y - p.sprite.height/2, // center the sprite
        p.sprite.width, // resize width  
        p.sprite.height // resize height
    );

    // text rendering
    if (p.showText) {
        ctx.font = "14px Arial";
        ctx.fillStyle = "black";
        ctx.textAlign = "center";
        ctx.fillText(p.text, p.position.x, p.position.y - 30);
    }
    
}

function localAvatar(a){
    return a && a.show && a.area == cur_location;
}

// DRAWS THE GAME
function updateAvatars(avatar_set){
    if(!in_game || !avatar_set || avatar_set.length === 0) {
        return;
    }
    let avatar_list = Object.values(all_avatars); 

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
        if (localAvatar(avatar)) {
            renderAvatar(avatar); // render the avatar on the canvas
        }
    }

    ctx.restore();
}




//// EVENT HANDLERS ////



function getAvatar(){
    return socket_avatar; // return the current user's avatar
}

function avatarClicked(avatar, x, y, radius=16){
    // check if the click is within the avatar's bounding box
    if (!localAvatar(avatar))
        return false; 

    return dist({ x, y }, avatar.position) < radius; // return true if the distance is less than the click radius
    
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
    //console.log(`Click at (${x}, ${y}) on ${target}.`);

    // move the avatar to the clicked position
    var avatar = socket_avatar; // get the avatar of the current user
    if (avatar) {
        socket.emit('move', { position: { x: x, y: y } }); // send the move event to the server
        //console.log("Avatar moved to position:", { x: x, y: y });
        // TODO: move gradually
    }

    // handle other game UI interactions here
}


// check if the click is on an avatar
function clickAvatar(e){
    let curs = getCursorPos(e); // get the cursor offset
    let x = curs.offx;
    let y = curs.offy;

    // check if the click is on an avatar
    let avatar_list = Object.values(all_avatars); // get the list of avatars from the players object
    if (!avatar_list || avatar_list.length === 0) {
        console.log("No avatars found.");
        return false; // no avatars to click on
    }else{
        avatar_list = avatar_list.filter(avatar => localAvatar(avatar)); // filter out avatars that are not shown
    }
    for (var i = 0; i < avatar_list.length; i++) {
        var avatar = avatar_list[i];
        if(avatar.id == getAvatar().id)
            continue; // skip the current user's avatar

        if (avatarClicked(avatar, x, y)) { 
            // handle avatar click
            console.log("Avatar clicked:", avatar.name);
            highlight_avatar = avatar.id // add the clicked avatar to the highlight list
            voteChar(avatar.name); // open the vote UI with the clicked avatar's username
            return true;
        }
    }
    //hideVoteUI(); // hide the vote UI if no avatar was clicked
    highlight_avatar = null; // clear the highlight if no avatar was clicked
    return false; // no avatar was clicked
}



// chat features
function sendMessage(){
    let msg = document.getElementById('chat-input').value;
    if (msg && msg.trim() !== '' && in_game) {
        socket.emit('chat', { text: msg });
    }
    document.getElementById('chat-input').value = ''; // clear input
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
    showPopup("welcome")
    //startGame(); // start the game immediately for testing purposes
}

// prevent refresh
window.onbeforeunload = function() {
    // handle before unload event to clean up or notify the server
    if (has_joined) {
        socket.emit('disconnect'); // notify the server about disconnection
    }
    return null; // confirmation message
}

/*
// MAIN GAME LOOP
function main() {
    requestAnimationFrame(main);
}

main();
*/