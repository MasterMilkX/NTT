
// UI imports
var check_IMG = new Image();
check_IMG.src = './static/assets/check2.png';         // <a href="https://www.flaticon.com/free-icons/tick" title="tick icons">Tick icons created by Freepik - Flaticon</a>

var cross_IMG = new Image();
cross_IMG.src = './static/assets/x.png';         // <a href="https://www.flaticon.com/free-icons/cross" title="cross icons">Cross icons created by Freepik - Flaticon</a>

var map_IMG = new Image();
map_IMG.src = './static/assets/map2.png';           // <a href="https://www.flaticon.com/free-icons/fantasy" title="fantasy icons">Fantasy icons created by Freepik - Flaticon</a>

var exit_IMG = new Image();
exit_IMG.src = './static/assets/exit.png';           // <a href="https://www.flaticon.com/free-icons/exit-door" title="exit door icons">Exit door icons created by Freepik - Flaticon</a>



// --- MAP UI --- //

var map_icons = document.getElementById("map-icons"); // get the map icons from the HTML

var MAP_ICON_SET = {}

var MAP_CELL_LIST = [
    "library", "blacksmith", "training_ground",
    "bakery", "plaza", "butcher",
    "market", "apothecary", "tavern"
]; // list of all map cells

var MAP_ICON_ORDER = {
    'library': 0,
    'bakery': 1,
    'market': 2,
    'tavern': 3,
    'butcher': 4,
    'training_ground': 5,
    'blacksmith': 6,
    'apothecary': 7,
    'plaza': 8
}

var MAP_SCALE = {
    'library': 1.25,
    'blacksmith': 2,
    'training_ground': 1.5,
    'bakery': 2,
    'plaza': 1,
    'butcher': 3,
    'market': 2,
    'apothecary': 2,
    'tavern': 1.5
}

var cur_screen = "welcome";
var cur_location = ""; // current location of the player


// CLOSE POPUPS
function closePopups(){
    // hide all current popups
    var all_pops = document.getElementsByClassName("ui-popup");
    for (var i = 0; i < all_pops.length; i++) {
        all_pops[i].style.display = "none";
    }
    // close emoji popup too
    document.getElementById("emoticon-popup").style.display = "none"; // close the emoticon popup
}

// SHOW POPUPS
function showPopup(id){
    closePopups(); // close all current popups
    cur_screen = id;

    // show the selected popup
    var popup = document.getElementById(id+"-popup");
    if (popup) {
        popup.style.display = "flex";
    } else {
        console.error("Popup with id " + id + "-popup does not exist.");
    }
}


function selectRole(role){
    // give the player a random role
    // TODO: implement role selection logic
    if(role_type !== ""){ // if the role is already selected, do nothing
        return;
    }

    role_type = role; // set the role type to the selected role
    socket.emit('assign-role',role); // send the selected role to the server
    
    console.log("Selected role: " + role + "\n Sending to server~!"); // log the selected role

    // switch to the role assignment screen
    document.getElementById("pick-role").style.display = "none"; // hide the role selection screen
    document.getElementById("role-confirmation").style.display = "block"; // show the role confirmation screen
}

function toTitleCase(str) {
  return str.replace(
    /\w\S*/g,
    text => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
  );
}

// updates the role text in the role selection popup
function updateRole(dat){
    let x = toTitleCase(dat.occ.replace('_'," ")) + " " + toTitleCase(dat.race);
    document.getElementById("role-ass-occ").innerHTML = "Role Assignment - " + toTitleCase(dat.occ.replace('_'," "));

    // role description
    let rd_div = document.getElementById("role-desc");
    rd_div.innerHTML = "";

    let d = document.createElement("p");
    d.innerHTML = "<span class='bold'> You are a "+ dat.name + " -- a " + x +"</span><br>"
    d.innerHTML += "<span class='italic' style='font-size:0.8em'>"+dat.desc + "</span>"
    rd_div.appendChild(d)

    // tasks
    let t = document.createElement("p");
    t.className = "resize-text";
    let task_txt = "";
    for(let i=0;i<dat.tasks.length;i++){
        let task = dat.tasks[i];
        task_txt += task + (i < dat.tasks.length-1 ? "<br>" : "");
    }
    t.innerHTML = "<span class='bold'>You are given the following tasks:</span><br>"
    t.innerHTML += task_txt;
    rd_div.appendChild(t);

    // ending text      
    let e = document.createElement("p");
    e.innerHTML = "Please be respectful in any and all interactions. You might be talking to an actual person!";
    e.innerHTML += "<br>Click EXIT when you want to leave and have fun!";
    e.className = "red-text resize-text";
    
    
    rd_div.appendChild(e);

    // update the tasks in the dropdown
    for(let i=0;i<dat.tasks.length;i++){
        let task = dat.tasks[i];
        let task_label = document.getElementById('task' + (i+1) + 'Label');
        if (task_label) {
            task_label.innerHTML = task; // update the label text
        }
    }
}

function updateInfo(dat=null, offline=false){
    if(!dat)
        dat = char_dat; // use the character data if not provided

    // update the avatar info in the game UI
    let avatar_info = document.getElementById("avatar-info");
    avatar_info.innerHTML = ""; // clear the current info

    // set name
    let name_div = document.createElement("div");
    name_div.id = "avatar-name";
    let l = document.createElement("span");
    l.className = "av-info-label";
    l.innerHTML = "Name: ";
    name_div.appendChild(l);
    let n = document.createElement("span");
    n.innerHTML = dat.name; // set the name from the character data
    name_div.appendChild(n);
    avatar_info.appendChild(name_div);
    name_div.onclick = function() {
        highlight(n); // highlight the name div when clicked
    };

    // set occupation
    let occ_div = document.createElement("div");
    occ_div.id = "avatar-occ";
    let o = document.createElement("span");
    o.className = "av-info-label";
    o.innerHTML = "Class: ";
    occ_div.appendChild(o);
    let occ_span = document.createElement("span");
    occ_span.innerHTML = dat.occ; // set the occupation from the character data
    occ_div.appendChild(occ_span);
    avatar_info.appendChild(occ_div);
    occ_div.onclick = function() {
        highlight(occ_span); // highlight the occupation div when clicked
    };

    // set race
    let race_div = document.createElement("div");
    race_div.id = "avatar-race";
    let a = document.createElement("span");
    a.className = "av-info-label";
    a.innerHTML = "Race: ";
    race_div.appendChild(a);
    let race_span = document.createElement("span");
    race_span.innerHTML = dat.race; // set the race from the character data
    race_div.appendChild(race_span);
    avatar_info.appendChild(race_div);
    race_div.onclick = function() {
        highlight(race_span); // highlight the race div when clicked
    };

    // set role
    let role_div = document.createElement("div");
    role_div.id = "avatar-role";
    let r = document.createElement("span");
    r.className = "av-info-label";
    r.innerHTML = "Role: ";
    role_div.appendChild(r);
    let role_span = document.createElement("span");
    role_span.innerHTML = dat.role; // set the role from the character data
    role_div.appendChild(role_span);
    avatar_info.appendChild(role_div);
    role_div.onclick = function() {
        highlight(role_span); // highlight the role div when clicked
    };

    // set location
    let loc_div = document.createElement("div");
    loc_div.id = "avatar-loc";
    let l2 = document.createElement("span");
    l2.className = "av-info-label";
    l2.innerHTML = "Location: ";
    loc_div.appendChild(l2);
    let loc_span = document.createElement("span");
    loc_span.innerHTML = cur_location.replace('_', ' ').toUpperCase(); // set
    loc_span.id = "avatar-loc-span"; // set the id for the location span
    loc_div.appendChild(loc_span);
    avatar_info.appendChild(loc_div);
    loc_div.onclick = function() {
        highlight(loc_span); // highlight the location div when clicked
    };

    // set socket id
    let id_div = document.createElement("div");
    id_div.id = "avatar-socket-id";
    let id_span = document.createElement("span");
    id_span.className = "av-info-label";
    id_span.innerHTML = "Socket ID: ";
    id_div.appendChild(id_span);
    let socket_id_span = document.createElement("span");
    socket_id_span.innerHTML = offline ? dat.id : socket.id; // set the socket id
    id_div.appendChild(socket_id_span);
    avatar_info.appendChild(id_div);
    id_div.onclick = function() {
        highlight(socket_id_span); // highlight the socket id div when clicked
    };

}



function highlight(element){
    var range = document.createRange();
    range.selectNode(element);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
}

function pregame(){
    socket.emit('join'); // send the username to the server to join the game
}

// START THE GAME
// insert the player into the plaza
function startGame(location="plaza",offline=false){
    closePopups(); // close all current popups
    cur_screen = "game"; // set the current screen to game
    cur_location = location; // set the current location to the specified location

    changeMap(location,offline); // change to the specified map
    document.getElementById("game-ui").style.display = "block"; // show the game screen
}

// CHANGE THE PLAYER'S LOCATION
function changeMap(location,offline=false){
    // TODO: implement location change logic

    let all_map_icons = document.getElementsByClassName("map-cell");
    for (let i = 0; i < all_map_icons.length; i++) {
        all_map_icons[i].classList.remove("cur-pos");
    }

    // highlight the new location
    let new_location = document.getElementById("map-loc-"+location);
    new_location.classList.add("cur-pos");

    // set the background image
    cur_location = location;
    closePopups();
    if(!offline)
        socket.emit('changeArea', {'area': location, position: {x:canvas.width/2, y:canvas.height*0.75}}); // send the new area to the server
    else{
        socket_avatar.area = location; // set the area for the offline avatar
        socket_avatar.position = {x:canvas.width/2, y:canvas.height*0.75}; // set the position for the offline avatar
        updateGame(); // update the game with the new area and position
    }

    // update info
    let loc_info = document.getElementById("avatar-loc-span");
    if(loc_info)
        loc_info.innerHTML = cur_location.replace('_', ' ').toUpperCase(); // update the location in the avatar info

    // delete all chatboxes
    if(chat_dat)
        chat_dat = {}; // clear the chat data
}

// populate the map cells of the pop up menu
function setMapCells(offline=false){
    let map_grid = document.getElementById("map-grid");
    map_grid.innerHTML = ""; // clear the container

    // setup map icons canvas for transfer
    let ico_canv = document.createElement("canvas");
    ico_canv.width = 48; // set the canvas width
    ico_canv.height = 48; // set the canvas height
    let ico_ctx = ico_canv.getContext("2d");


    // create map cell elements
    for (let i = 0; i < MAP_CELL_LIST.length; i++) {

        
        let cell = document.createElement("div");
        cell.className = "map-cell";
        cell.id = "map-loc-" + MAP_CELL_LIST[i];

        // create icon image for cell
        let img = document.createElement("img");
        ico_ctx.clearRect(0, 0, ico_canv.width, ico_canv.height); // clear the canvas
        ico_ctx.drawImage(map_icons, MAP_ICON_ORDER[MAP_CELL_LIST[i]] * 48, 0, 48, 48, 0, 0, ico_canv.width, ico_canv.height); // draw
        img.src = ico_canv.toDataURL(); // convert canvas to image data URL
        cell.appendChild(img);

        // create events
        cell.onclick = function() { changeMap(MAP_CELL_LIST[i],offline); };
        cell.onmouseover = function() { setMapLabel(MAP_CELL_LIST[i].replace('_', ' ').toUpperCase()); };
        cell.onmouseout = function() { setMapLabel("&nbsp;"); }; // clear label on mouse out
        map_grid.appendChild(cell);
    }
}

function setMapLabel(loc){
    // set the map label to the current location
    let map_label = document.getElementById("map-label");
    map_label.innerHTML = loc; // display the location in uppercase
}

// EMOJI SETUP


// toggle the emoticon popup
function toggleEmojis(){
    if (document.getElementById("emoticon-popup").style.display === "none") {
        document.getElementById("emoticon-popup").style.display = "block";
    }else {
        document.getElementById("emoticon-popup").style.display = "none";
    }
}


// populate the emoji cells of the pop up menu
function setEmoCells(offline=false){
    let emo_grid = document.getElementById("emo-grid");
    emo_grid.innerHTML = ""; // clear the container


    // create emoji cell elements (30 emojis)
    for (let i = 0; i < 30; i++) {
        let pi = String(i+1).padStart(2, '0'); // pad the index with zeros for the image name
        
        let cell = document.createElement("div");
        cell.className = "emo-cell";
        // cell.id = "emo-cell-" + pi;

        // create icon image for cell
        let img = document.createElement("img");
        img.src = document.getElementById('emo-'+pi).src; // convert canvas to image data URL
        cell.appendChild(img);

        // create events
        cell.onclick = function() { 
            if(offline)
                sendMessage(":emo-" + pi + ":"); 
            else
                socket.emit('chat', {'text': ":emo-" + pi + ":"}); // send the emoticon as a message
            document.getElementById("emoticon-popup").style.display = "none"; // close the emoticon popup after sending
            document.getElementById('emo-btn-img').src = img.src; // update the emoticon button image
        }; // send the emoticon as a message
        emo_grid.appendChild(cell);
    }
}






// -- GAME UI

// toggle the task list
function toggleTasks(){
    if (document.getElementById("task-list").style.display === "none") {
        document.getElementById("task-list").style.display = "block";
    }else {
        document.getElementById("task-list").style.display = "none";
    }
}

// toggle the avatar info
function toggleAvatarInfo(){
    if (document.getElementById("avatar-info").style.display === "none") {
        document.getElementById("avatar-info").style.display = "block";
    }else {
        document.getElementById("avatar-info").style.display = "none";
    }
}

// ------ vote
function voteChar(name="???"){
    var vote_window = document.getElementById("vote-ui");
    vote_window.style.display = "block"; // show the vote UI
    vote_window.querySelector("#vote-user").innerHTML = name; // set the voted user name
}

function hideVoteUI(){
    var vote_window = document.getElementById("vote-ui");
    vote_window.style.display = "none"; // hide the vote UI
    document.getElementById("vote-user").innerHTML = "???"; // reset the voted user name
}

function closeVoteUI(){
    var vote_window = document.getElementById("vote-ui");
    vote_window.style.display = "none"; // hide the vote UI
}

function submitVote(vote){
    // TODO: implement vote submission logic to the database
    // userID, votedUserID, voteType, confidence

    document.getElementById("vote-confirm").innerHTML = "Vote submitted!"
    setTimeout(function() {
        document.getElementById("vote-confirm").innerHTML = "";
    },5000); // clear the confirmation message after 2 seconds
    

}


function updateConfidence(conf_val){
    // TODO: implement confidence update logic

    
}


// show the start up screen to select role again
// function resetGame(){
//     // reset the game state
//     cur_location = "";
//     role_type = "";


//     document.getElementById("game-ui").style.display = "none"; // hide the game screen
//     closePopups(); // close all current popups
//     document.getElementById("vote-confirm").innerHTML = ""; // clear the vote confirmation message
//     setMapCells(); // reset the map cells in the popup menu
//     showPopup("welcome"); // show the welcome popup
//     // switch to the role assignment screen
//     document.getElementById("pick-role").style.display = "none"; // hide the role selection screen
//     document.getElementById("role-confirmation").style.display = "block"; // show the role confirmation screen
//     //removeAvatar(); // remove all avatars from the game
// }

function exitGame(){
    if(in_game){ // if the player has joined the game
        socket.disconnect(); // notify the server about exit
        in_game = false; // set in_game to false
    }
    closePopups(); // close all current popups`
    document.getElementById("game-ui").style.display = "none"; // hide the game screen
    showPopup('goodbye'); // show the goodbye popup
}

