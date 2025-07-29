
// !!!!!! ---- NOTE ---- !!!!!!
// This is the main offline game code for testing purposes.
// It is not meant to be used in the online version of the game.

//// MAIN GAME CODE

// canvas setup
var canvas = document.getElementById('game-canvas');
var ctx = canvas.getContext('2d');
canvas.width = 800;
canvas.height = 450;

// player sprite sheet
var spr_sheet = document.getElementById("spr-sheet");

// PLAYER PROPERTIES
var all_avatars = {};
var avatar_name = "";
var socket_avatar = null;
var highlight_avatar = null;
var AVATAR_SCALE = 1;

var char_dat = {}; // character data for the player
var role_type = ""; // default role type for testing purposes

var ui_overlay = document.getElementById("game-ui"); // the game UI overlay

var chat_dat = {}; // chat boxes for avatars

// load boundaries
var boundaries = {}
fetch('./static/data/area_boundaries.json')
  .then(response => response.json())
  .then(data => {
    boundaries = data; // store the loaded boundaries
  })
  .catch(error => console.error('Error loading JSON:', error));

  
// load tasks
var task_json = {};
function setTasks(){
    // set the tasks for the avatar based on the class type
    let poss_tasks = [];
    if (socket_avatar && task_json[socket_avatar.classType]) {
        poss_tasks = task_json[socket_avatar.classType].tasks; // set the tasks
    }

    // pick 3 random tasks from the possible tasks
    socket_avatar.tasks = [];
    for (let i = 0; i < 3 && poss_tasks.length > 0; i++) {
        let task = poss_tasks.splice(Math.floor(Math.random() * poss_tasks.length), 1)[0]; // pick a random task
        socket_avatar.tasks.push(task); // add the task to the avatar's tasks
    }

    // update the tasks in the dropdown
    for(let i=0;i<socket_avatar.tasks.length;i++){
        let task = socket_avatar.tasks[i];
        let task_label = document.getElementById('task' + (i+1) + 'Label');
        if (task_label) {
            task_label.innerHTML = task; // update the label text
        }
    }
}

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


function localAvatar(a){
    return a && a.show && a.area == cur_location;
}


// creating boundaries via game
var saved_pos = []
var record_pos = false;

function rec_pos(){
    if(saved_pos.length > 0 && record_pos) {
        let j = {}
        j[cur_location] = saved_pos; // save the current location and positions
        console.log(JSON.stringify(j)); // log the saved positions to the console
    }

    saved_pos = []; // reset the saved positions
    record_pos = true; // start recording positions
    console.log("Recording positions...");
}


//////////////////////      RENDER     ////////////////////////

let RENDER_OFFSET = {x: 2, y: -20, cx: -2}
function renderAvatar(p){
    // username
    /*
    ctx.font = "16px Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = "black";
    ctx.fillText(p.name, p.position.x, p.position.y + 40);
    */

    let offset = RENDER_OFFSET; // offset for the avatar position
    let spr_y = p.position.y - (p.sprite.height * AVATAR_SCALE)/2 + offset.y*AVATAR_SCALE;
    let px = p.position.x + offset.x*AVATAR_SCALE;
    let py = p.position.y + offset.y*AVATAR_SCALE;


    if(!localAvatar(p)) // check if the avatar is local and the sprite sheet is loaded
        return; // do not render the avatar if it is not local


    // highlight
    if(highlight_avatar && highlight_avatar == p.id) {
        // draw a highlight circle under the avatar if it is highlighted
        ctx.beginPath();
        ctx.ellipse(px + offset.cx*AVATAR_SCALE, // center the highlight circle
               spr_y + (p.sprite.height * AVATAR_SCALE),  
            (p.sprite.width * AVATAR_SCALE)/3, 8, 0, 0, Math.PI * 2); // use the click radius as the highlight radius
        ctx.fillStyle = "yellow"; // set the highlight color
        ctx.lineWidth = 5; // set the highlight line width
        ctx.fill(); // draw the highlight circle
    }

    // -- modify the avatar scale based on the current location
    AVATAR_SCALE = MAP_SCALE[cur_location] || 1; // get the scale for the current location, default to 1 if not found
    // if(p.raceType == 'chuck')
    //     AVATAR_SCALE = MAP_SCALE[cur_location]*0.5 || 0.5; // chuck's scale is smaller

    // set the sprite frame based on the current animation
    p.sprite.frame = Math.floor((Date.now() - p.sprite.frameInterval) / p.sprite.frameInterval) % 2;
    let ani_frame = p.sprite.animations[p.sprite.cur_animation][p.sprite.frame];


    // draw sprite from sprite sheet
    ctx.drawImage(spr_sheet, 
        (p.sprite.width * ani_frame), 
        (p.sprite.height * AVATAR_RACE[p.raceType]), 
        p.sprite.width, 
        p.sprite.height, 
        p.position.x - (p.sprite.width * AVATAR_SCALE)/2 + offset.x*AVATAR_SCALE, // center the sprite
        p.position.y - (p.sprite.height * AVATAR_SCALE)/2 + offset.y*AVATAR_SCALE, // center the sprite
        p.sprite.width * AVATAR_SCALE, // resize width
        p.sprite.height * AVATAR_SCALE // resize height
    );

    // draw the class clothes on top
    if(p.classType && p.classType != 'hero' && p.classType != 'chuck') {

        let dance_offset = 0;
        if (p.sprite.cur_animation === 'dance' && p.sprite.frame == 1) {
            dance_offset = -5; // offset for the dance animation
        }

        let wave_offset = 0;
        if (p.sprite.cur_animation === 'wave') {
            wave_offset = -5; // offset for the wave animation
        }

        ctx.drawImage(spr_sheet,
            (p.sprite.width * AVATAR_CLASS[p.classType]), 
            (p.sprite.height * 6), // assuming class clothing are in row 6
            p.sprite.width,
            p.sprite.height,
            p.position.x - ((p.sprite.width+wave_offset) * AVATAR_SCALE)/2 + offset.x*AVATAR_SCALE, // center the sprite
            p.position.y - ((p.sprite.height+dance_offset) * AVATAR_SCALE)/2 + offset.y*AVATAR_SCALE, // center the sprite
            p.sprite.width * AVATAR_SCALE, // resize width
            p.sprite.height * AVATAR_SCALE // resize height
        );
    }


    // DEBUG DRAWING
    // ctx.strokeStyle = "white";
    // // DRAW A circle to represent the click area
    // ctx.beginPath();
    // ctx.arc(px + offset.cx*AVATAR_SCALE, // center the circle
    //         py, 
    //         24*AVATAR_SCALE, 0, Math.PI * 2); // use the click radius as the highlight radius
    // ctx.stroke();

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

// DRAWS THE GAME
function updateGame(){
    if(!in_game || !socket_avatar || !all_avatars)
        return; // do not update the game if not in game or no avatars
    let avatar_list = Object.values(all_avatars); // get the list of avatars from the players object

    ctx.save();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // background
    ctx.fillStyle = "#dedede";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // draw the background for the location
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

    // clean up unnecessary chat boxes
    let all_boxes = document.getElementsByClassName('av-chat-box');
    for (let b=0;b<all_boxes.length;b++){
        let box = all_boxes[b]; // get the chat box element
        if (!box.id || !box.id.startsWith('chat-box-')) continue; // skip if the box does not have a valid id{
        let id = box.id.replace('chat-box-', ''); // get the avatar id from the chat box id
        if (!all_avatars[id] || !all_avatars[id].showText || (!localAvatar(all_avatars[id]))) {
            if (chat_dat[id]){
                chat_dat[id].remove(); // remove the chat box from the DOM
                delete chat_dat[id]; // delete the chat box from the chat data
            }
            box.remove(); // remove the chat box element
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

    let rect = ui_overlay.getBoundingClientRect(); // get the bounding rectangle of the UI overlay
    let ax = avatar.position.x; // center the chat box relative to the avatar
    let ay = avatar.position.y - (avatar.sprite.height * AVATAR_SCALE); // position the chat box above the avatar

    let cx = ax * (rect.width / canvas.width); // convert to canvas coordinates
    let cy = ay * (rect.height / canvas.height); // convert to canvas coordinates

    chatBox.style.left = (cx) + 'px'; // position the chat box relative to the avatar
    chatBox.style.top = (cy) + 'px'; // position the chat box above the avatar

    document.getElementById('container').appendChild(chatBox); // add the chat box to the body
    
    //console.log("CHAT!" + avatar.text + " at " + cx + ", " + cy);
    return chatBox; // return the chat box element
}




////////////////////////   CLICK / MOUSE FUNCTIONS   ////////////////////


function getAvatar(){
    return socket_avatar; // return the current user's avatar
}

function avatarClicked(avatar, x, y, radius=24){
    // check if the click is within the avatar's bounding box
    if (!localAvatar(avatar))
        return false; 

    let offset = RENDER_OFFSET; // offset for the avatar position
    let opos = { x: avatar.position.x + (offset.x+ offset.cx)*AVATAR_SCALE, y: avatar.position.y + (offset.y)*AVATAR_SCALE }; // get the avatar's position with offset

    return dist({ x, y }, opos) < radius*AVATAR_SCALE; // return true if the distance is less than the click radius

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
                socket_avatar.position = { x, y }; // set the avatar's position to the clicked position
                resetAnim(); // reset the avatar's animation
                //updateGame(); // update the game with the new position
                //socket.emit('move', { position: { x: x, y: y } }); // send the move event to the server
            }
        }

        //console.log("Avatar moved to position:", { x: x, y: y });
        if (record_pos) {
            // record the position if recording is enabled
            saved_pos.push({ x: x, y: y });
        }
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

        if (getAvatar().roletype == "AP" && avatarClicked(avatar, x, y)) { 
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


function showClickPos(e){
    let target = e.target.id; // get the target element id or unknown if not available

    if (!target || target !== "game-ui") {
        return;
    }

    let curs = getCursorPos(e); // get the cursor offset
    let x = curs.offx;
    let y = curs.offy;

    //console.log(`Click at (${x}, ${y}) on ${target}.`);

    // hide the vote UI if the click is not on the game UI
    hideVoteUI();
}



////////////////////////   AVATAR ACTIONS  ////////////////////////////////





// chat features
function sendMessage(){
    let msg = document.getElementById('chat-input').value;
    if (msg && msg.trim() !== '' && in_game) {
        socket_avatar.setText(msg); // set the text for the avatar
        socket_avatar.textInt = setTimeout(() => {
            socket_avatar.showText = false; // hide the text after a timeout
            socket_avatar.text = ""; // clear the text
            //updateGame(); // update the game with the new text
        }, 3000); // hide the text after 3 seconds
        //updateGame(); // update the game with the new text
        //socket.emit('chat', { text: msg });
    }
    document.getElementById('chat-input').value = ''; // clear input
}

// --- Avatar animations
function toggleDance(){
    if (socket_avatar) {
        socket_avatar.sprite.frame = 0; // reset the frame to 0
        if (socket_avatar.sprite.cur_animation === 'dance') {
            resetAnim(); // switch to idle animation
        }else {
            socket_avatar.sprite.cur_animation = 'dance'; // switch to dance animation
        }
    }
}

function toggleWave(){
    if (socket_avatar) {
        socket_avatar.sprite.frame = 0; // reset the frame to 0
        if (socket_avatar.sprite.cur_animation === 'wave') {
            resetAnim(); // switch to idle animation
        }else {
            socket_avatar.sprite.cur_animation = 'wave'; // switch to wave animation
        }
    }
}

function resetAnim(){
    if (socket_avatar) {
        socket_avatar.sprite.cur_animation = 'idle'; // reset the animation to idle
        socket_avatar.sprite.frame = 0; // reset the frame to 0
        socket_avatar.sprite.frameInterval = 250;
    }
}





////////////////////////   EVENT LISTENERS ////////////////////////////////



// mouse + touch event listeners for the "canvas" (really just the ui-overlay on top)
ui_overlay.addEventListener('click', gameClick);
ui_overlay.addEventListener('touchstart', gameClick);

// shortcuts
window.onkeydown = function(e) {
    // debug shortcuts
    if(e.key == 'b')
        rec_pos(); // start recording positions when B is pressed
    
    // non-text input shortcuts
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
        }else if(e.key == 'i'){
            toggleAvatarInfo()   // toggle avatar info
        }
        else if(e.key == 'd'){
            if (socket_avatar) {
                toggleDance(); // toggle dance animation when D is pressed
            }
        }else if(e.key == 'w'){
            if (socket_avatar) {
                toggleWave(); // toggle wave animation when W is pressed
            }
        }
    }
    
    // text input shortcuts
    else{
        if (e.key === 'Enter') {
            sendMessage(); // send the chat message when Enter is pressed
        }else if (e.key === 'Escape') {
            document.activeElement.blur(); // remove focus from the input field when Escape is pressed
        }
    }
    
}



// INITIALIZATION FUNCTION 
in_game = true;

function init(){
    socket_avatar = randomChar('NPP'); // store the avatar data
    cur_location = socket_avatar.area;
    all_avatars[socket_avatar.id] = socket_avatar; // initialize all_avatars with the offline avatar
    updateInfo({
        name: socket_avatar.name,
        occ: socket_avatar.classType,
        race: socket_avatar.raceType,
        role: socket_avatar.roletype,
        id: socket_avatar.id
    }, true)
    // set tasks
    fetch('./static/data/roles.json')
        .then(response => response.json())
        .then(data => {
            task_json = data; // store the loaded tasks
            setTasks(); // set the tasks for the avatar
        })
        .catch(error => console.error('Error loading tasks:', error));
    setMapCells(true); // populate the map cells in the popup menu
    startGame('plaza',true); // start the game immediately for testing purposes
    main();
}


// MAIN FUNCTION

// simulate constant update calls from the server
function main(){
    setInterval(() => {
        if (in_game) {
            // Update the game state
            updateGame();
        }
    }, 1000 / 60); // 60 FPS
}

