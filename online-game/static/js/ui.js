
// UI imports
var check_IMG = new Image();
check_IMG.src = './static/assets/check2.png';         // <a href="https://www.flaticon.com/free-icons/tick" title="tick icons">Tick icons created by Freepik - Flaticon</a>

var cross_IMG = new Image();
cross_IMG.src = './static/assets/x.png';         // <a href="https://www.flaticon.com/free-icons/cross" title="cross icons">Cross icons created by Freepik - Flaticon</a>

var map_IMG = new Image();
map_IMG.src = './static/assets/map2.png';           // <a href="https://www.flaticon.com/free-icons/fantasy" title="fantasy icons">Fantasy icons created by Freepik - Flaticon</a>

var exit_IMG = new Image();
exit_IMG.src = './static/assets/exit.png';           // <a href="https://www.flaticon.com/free-icons/exit-door" title="exit door icons">Exit door icons created by Freepik - Flaticon</a>

var map_icons = document.getElementById("map-icons"); // get the map icons from the HTML

// background image imports
var map1_IMG = new Image();
map1_IMG.src = './static/assets/battlefield.jpg';    // https://gamebanana.com/mods/369805

var map2_IMG = new Image(); 
map2_IMG.src = './static/assets/plaza.jpg';          // https://www.deviantart.com/jakebowkett/art/Fantasy-Town-Plaza-689235345

var map3_IMG = new Image();
map3_IMG.src = './static/assets/forest.jpg';         // https://www.freepik.com/free-photos-vectors/cartoon-forest



var MAP_IMG_SET = {
    "plaza" : map2_IMG,
    // "battlefield" : map1_IMG,
    // "forest" : map3_IMG,
    // "A" : null, // placeholder images for unknown locations
    // "B" : null, // placeholder images for unknown locations
    // "C" : null, // placeholder images for unknown locations
    // "D" : null, // placeholder images for unknown locations
    // "E" : null, // placeholder images for unknown locations
    // "F" : null, // placeholder images for unknown locations
}
var MAP_ICON_SET = {}

//var MAP_CELL_LIST = ["A", "B", "C", "forest", "plaza", "battlefield", "D", "E", "F"]; // list of all map cells
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

var cur_screen = "welcome";


// CLOSE POPUPS
function closePopups(){
    // hide all current popups
    var all_pops = document.getElementsByClassName("ui-popup");
    for (var i = 0; i < all_pops.length; i++) {
        all_pops[i].style.display = "none";
    }
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
function updateRole(){
    let x = toTitleCase(char_dat.occ.replace('_'," ")) + " " + toTitleCase(char_dat.race);
    document.getElementById("role-ass-occ").innerHTML = "Role Assignment - " + toTitleCase(char_dat.occ.replace('_'," "));

    // role description
    let rd_div = document.getElementById("role-desc");
    rd_div.innerHTML = "";

    let d = document.createElement("p");
    d.innerHTML = "<span class='bold'> You are a "+ char_dat.name + " -- a " + x +"</span><br>"
    d.innerHTML += "<span class='italic' style='font-size:0.8em'>"+char_dat.desc + "</span>"
    rd_div.appendChild(d)

    // tasks
    let t = document.createElement("p");
    let task_txt = "";
    for(let i=0;i<char_dat.tasks.length;i++){
        let task = char_dat.tasks[i];
        task_txt += task + (i < char_dat.tasks.length-1 ? "<br>" : "");
    }
    t.innerHTML = "<span class='bold'>You are given the following tasks:</span><br>"
    t.innerHTML += task_txt;
    rd_div.appendChild(t);

    // ending text
    let e = document.createElement("p");
    e.innerHTML = "Please be respectful in any and all interactions. You might be talking to an actual person!";
    e.innerHTML += " Click EXIT when you want to leave and have fun!";
    
    rd_div.appendChild(e);

    // update the tasks in the dropdown
    for(let i=0;i<char_dat.tasks.length;i++){
        let task = char_dat.tasks[i];
        let task_label = document.getElementById('task' + i + 'Label');
        if (task_label) {
            task_label.innerHTML = task; // update the label text
        }
    }

}

function pregame(){
    socket.emit('join'); // send the username to the server to join the game
}

// START THE GAME
// insert the player into the plaza
function startGame(){
    closePopups(); // close all current popups
    cur_screen = "game"; // set the current screen to game
    cur_location = "plaza"; // set the current location to plaza

    changeMap("plaza"); // change to plaza map
    document.getElementById("game-ui").style.display = "block"; // show the game screen
}

// CHANGE THE PLAYER'S LOCATION
function changeMap(location){
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
    socket.emit('changeArea', {'area': location, position: randomPos(canvas.clientWidth, canvas.height)}); // send the new area to the server
}

// populate the map cells of the pop up menu
function setMapCells(){
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
        cell.onclick = function() { changeMap(MAP_CELL_LIST[i]); };
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


// -- GAME UI

// toggle the task list
function toggleTasks(){
    if (document.getElementById("task-list").style.display === "none") {
        document.getElementById("task-list").style.display = "block";
    }else {
        document.getElementById("task-list").style.display = "none";
    }
}

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
function resetGame(){
    // reset the game state
    cur_location = "";
    role_type = "";


    document.getElementById("game-ui").style.display = "none"; // hide the game screen
    closePopups(); // close all current popups
    document.getElementById("vote-confirm").innerHTML = ""; // clear the vote confirmation message
    setMapCells(); // reset the map cells in the popup menu
    showPopup("welcome"); // show the welcome popup
    // switch to the role assignment screen
    document.getElementById("pick-role").style.display = "none"; // hide the role selection screen
    document.getElementById("role-confirmation").style.display = "block"; // show the role confirmation screen
    //removeAvatar(); // remove all avatars from the game
}


window.onbeforeunload = function() {
  return "You will not be able to return as the same character. Once you leave, the experiment is over<br>Do you wish to leave?";
};