//// MAIN GAME CODE

// canvas setup
var canvas = document.getElementById('game-canvas');
var ctx = canvas.getContext('2d');
canvas.width = 800;
canvas.height = 450;

// player sprite sheet
var spr_sheet = document.getElementById("spr-sheet");

// PLAYER PROPERTIES
var all_avatars = null;
var avatar_name = "";
var socket_avatar = null;
var highlight_avatar = null;
var AVATAR_SCALE = 1;

var char_dat = {}; // character data for the player
var has_joined = false;
var role_type = ""; // default role type for testing purposes

var chat_dat = {};

var ui_overlay = document.getElementById("game-ui"); // the game UI overlay


// load boundaries
var boundaries = {}
fetch('./static/data/area_boundaries.json')
  .then(response => response.json())
  .then(data => {
    boundaries = data; // store the loaded boundaries
  })
  .catch(error => console.error('Error loading JSON:', error));



//////////////////////////      FUNCTIONS      //////////////////////////

function dist(pos1, pos2){
    // calculate the distance between two points
    return Math.sqrt(Math.pow(pos2.x - pos1.x, 2) + Math.pow(pos2.y - pos1.y, 2));
}

function inArr(arr, val){
    // check if a value is in an array
    return arr.indexOf(val) != -1;
}

function inZone(pos, boundary) {
    const { x, y } = pos;
    let inside = false;

    for (let i = 0, j = boundary.length - 1; i < boundary.length; j = i++) {
        const xi = boundary[i].x, yi = boundary[i].y;
        const xj = boundary[j].x, yj = boundary[j].y;

        // Check if point is within the y-range of the edge
        const intersect = ((yi > y) !== (yj > y)) &&
                          (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);

        if (intersect) inside = !inside;
    }

    return inside;
}


// var saved_pos = []
// var record_pos = false;

// function rec_pos(){
//     if(saved_pos.length > 0 && record_pos) {
//         let j = {}
//         j[cur_location] = saved_pos; // save the current location and positions
//         console.log(JSON.stringify(j)); // log the saved positions to the console
//     }

//     saved_pos = []; // reset the saved positions
//     record_pos = true; // start recording positions
//     console.log("Recording positions...");
// }


///////// RENDER /////////


function renderAvatar(p){
    // username
    /*
    ctx.font = "16px Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = "black";
    ctx.fillText(p.name, p.position.x, p.position.y + 40);
    */

    let offset = {x: 0, y: -20}

   if(!localAvatar(p)) // check if the avatar is local and the sprite sheet is loaded
        return; // do not render the avatar if it is not local


    // highlight
    if(highlight_avatar && highlight_avatar == p.id) {
        // draw a highlight circle under the avatar if it is highlighted
        ctx.beginPath();
        ctx.ellipse(p.position.x-2, p.position.y+(p.sprite.height*AVATAR_SCALE)/2, 16, 
            8, 0, 0, Math.PI * 2); // use the click radius as the highlight radius
        ctx.fillStyle = "yellow"; // set the highlight color
        ctx.lineWidth = 5; // set the highlight line width
        ctx.fill(); // draw the highlight circle
    }

    AVATAR_SCALE = MAP_SCALE[cur_location] || 1; // get the scale for the current location, default to 1 if not found
    if(p.raceType == 'chuck')
        AVATAR_SCALE = MAP_SCALE[cur_location]*0.5 || 0.5; // chuck's scale is smaller

    // draw sprite from sprite sheet
    ctx.drawImage(spr_sheet, 
        (p.sprite.width * p.sprite.frame), 
        (p.sprite.height * AVATAR_RACE[p.raceType]), 
        p.sprite.width, 
        p.sprite.height, 
        p.position.x - (p.sprite.width * AVATAR_SCALE)/2 , // center the sprite
        p.position.y - (p.sprite.height * AVATAR_SCALE)/2 + offset.y*AVATAR_SCALE, // center the sprite
        p.sprite.width * AVATAR_SCALE, // resize width
        p.sprite.height * AVATAR_SCALE // resize height
    );

    // draw the class clothes on top
    if(p.classType && p.classType != 'hero' && p.classType != 'chuck') {
        ctx.drawImage(spr_sheet,
            (p.sprite.width * AVATAR_CLASS[p.classType]), 
            (p.sprite.height * 6), // assuming class clothing are in row 6
            p.sprite.width,
            p.sprite.height,
            p.position.x - (p.sprite.width * AVATAR_SCALE)/2 , // center the sprite
            p.position.y - (p.sprite.height * AVATAR_SCALE)/2 + offset.y*AVATAR_SCALE, // center the sprite
            p.sprite.width * AVATAR_SCALE, // resize width
            p.sprite.height * AVATAR_SCALE // resize height
        );
    }
    
}

function drawBoundary(points, options = {}) {
    if (points.length < 2) return;

    const {
        strokeStyle = 'black',
        lineWidth = 1,
        fill = false,
        fillStyle = 'rgba(0, 0, 0, 0.1)'
    } = options;

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }

    ctx.closePath(); // closes the shape (back to first point)

    if (fill) {
        ctx.fillStyle = fillStyle;
        ctx.fill();
    }

    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
}

function localAvatar(a){
    return a && a.show && a.area == cur_location;
}

// DRAWS THE GAME
function updateGame(avatar_set){
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
    let bg_img = document.getElementById("bg-"+cur_location);
    if (cur_location == "" || !bg_img) {
        ctx.fillStyle = "#000"; // black void background for unknown locations
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }else
        ctx.drawImage(bg_img, 0, 0, canvas.width, canvas.height);

    // DEBUG: draw boundaries for the current area
    // if (boundaries[cur_location]) {
    //     drawBoundary(boundaries[cur_location], {
    //         strokeStyle: 'blue', // color of the boundary lines
    //         lineWidth: 2, // width of the boundary lines
    //         fill: true, // fill the boundary area
    //         fillStyle: 'rgba(255, 0, 0, 0.1)' // fill color for the boundary area
    //     });
    // }


    // draw the avatars
    for (var i = 0; i < avatar_list.length; i++) {
        var avatar = avatar_list[i];

        // draw the sprite
        if (localAvatar(avatar)) {
            renderAvatar(avatar); // render the avatar on the canvas

            // make or delete chatboxes
            if (avatar.showText) {
                // create a new chatbox if it doesn't exist, or replace text
                if (chat_dat[avatar.id])
                    chat_dat[avatar.id].remove(); // remove previous chat box if it exists
                chat_dat[avatar.id] = makeChatBox(avatar);
            } else {
                // delete the chatbox if it exists
                if (chat_dat[avatar.id]) {
                    chat_dat[avatar.id].remove(); // remove the chat box from the DOM
                    delete chat_dat[avatar.id];
                }
            }
        }
    }

    ctx.restore();
}

function makeChatBox(avatar){
    // create a chat box for the avatar
    if (!avatar || !avatar.showText || !avatar.text || avatar.text.trim() === '')
        return null;

    let chatBox = document.createElement('div');
    chatBox.className = 'av-chat-box';
    chatBox.id = 'chat-box-' + avatar.id; // unique id for the chat

    chatBox.innerHTML = avatar.text;

    chatBox.style.left = (avatar.position.x) + 'px'; // position the chat box relative to the avatar
    chatBox.style.top = (avatar.position.y) + 'px'; // position the chat box above the avatar

    document.body.appendChild(chatBox); // add the chat box to the body
    return chatBox; // return the chat box element
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
        // check if the click is within the boundaries of the current area
        if (cur_location && boundaries[cur_location]) {
            if (inZone({ x, y }, boundaries[cur_location])) {
                socket.emit('move', { position: { x: x, y: y } }); // send the move event to the server
            }
        }

        //console.log("Avatar moved to position:", { x: x, y: y });
        // if (record_pos) {
        //     // record the position if recording is enabled
        //     saved_pos.push({ x: x, y: y });
        // }
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

    //console.log(`Click at (${x}, ${y}) on ${target}.`);

    // hidde the vote UI if the click is not on the game UI
    hideVoteUI();
}

// mouse + touch event listeners for the "canvas" (really just the ui-overlay on top)
ui_overlay.addEventListener('click', gameClick);
ui_overlay.addEventListener('touchstart', gameClick);

// shortcuts
window.onkeydown = function(e) {
    if(e.key == 'b')
        rec_pos(); // start recording positions when B is pressed
    
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