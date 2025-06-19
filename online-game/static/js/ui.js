
// UI imports
var check_IMG = new Image();
check_IMG.src = './static/assets/check.png';         // <a href="https://www.flaticon.com/free-icons/tick" title="tick icons">Tick icons created by Freepik - Flaticon</a>

var cross_IMG = new Image();
cross_IMG.src = './static/assets/cancel.png';         // <a href="https://www.flaticon.com/free-icons/cross" title="cross icons">Cross icons created by Freepik - Flaticon</a>

var map_IMG = new Image();
map_IMG.src = './static/assets/map.png';           // <a href="https://www.flaticon.com/free-icons/fantasy" title="fantasy icons">Fantasy icons created by Freepik - Flaticon</a>

var exit_IMG = new Image();
exit_IMG.src = './static/assets/exit.png';           // <a href="https://www.flaticon.com/free-icons/exit-door" title="exit door icons">Exit door icons created by Freepik - Flaticon</a>



// background image imports
var map1_IMG = new Image();
map1_IMG.src = './static/assets/battlefield.jpg';    // https://gamebanana.com/mods/369805

var map2_IMG = new Image(); 
map2_IMG.src = './static/assets/plaza.jpg';          // https://www.deviantart.com/jakebowkett/art/Fantasy-Town-Plaza-689235345

var map3_IMG = new Image();
map3_IMG.src = './static/assets/forest.jpg';         // https://www.freepik.com/free-photos-vectors/cartoon-forest


var cur_location = "";
var MAP_IMG_SET = {
    "plaza" : map2_IMG,
    "battlefield" : map1_IMG,
    "forest" : map3_IMG,
    "A" : null, // placeholder images for unknown locations
    "B" : null, // placeholder images for unknown locations
    "C" : null, // placeholder images for unknown locations
    "D" : null, // placeholder images for unknown locations
    "E" : null, // placeholder images for unknown locations
    "F" : null, // placeholder images for unknown locations
}
var MAP_ICON_SET = {
    "plaza" : "./static/assets/plaza.jpg",
    "battlefield" : "./static/assets/battlefield.jpg",
    "forest" : "./static/assets/forest.jpg",
    "A" : "./static/assets/point.png",
    "B" : "./static/assets/point.png",
    "C" : "./static/assets/point.png",
    "D" : "./static/assets/point.png",
    "E" : "./static/assets/point.png",
    "F" : "./static/assets/point.png"
}

var MAP_CELL_LIST = ["A", "B", "C", "forest", "plaza", "battlefield", "D", "E", "F"]; // list of all map cells


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

function selectRole(){
    // give the player a random role
    // TODO: implement role selection logic




    // bring up the role assignment popup
    showPopup("role-ass");
}

// START THE GAME
// insert the player into the plaza
function startGame(){
    closePopups(); // close all current popups
    cur_screen = "game"; // set the current screen to game
    cur_location = "plaza"; // set the current location to plaza

    changeMap("plaza"); // change to plaza map
    addAvatar("plaza")
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
    render();
}

// populate the map cells of the pop up menu
function setMapCells(){
    let map_grid = document.getElementById("map-grid");
    map_grid.innerHTML = ""; // clear the container

    // create map cell elements
    for (let i = 0; i < MAP_CELL_LIST.length; i++) {
        let cell = document.createElement("div");
        cell.className = "map-cell";
        cell.id = "map-loc-" + MAP_CELL_LIST[i];
        let img = document.createElement("img");
        img.src = MAP_ICON_SET[MAP_CELL_LIST[i]];
        cell.appendChild(img);
        // cell.style.backgroundImage = "url('" + MAP_ICON_SET[MAP_CELL_LIST[i]] + "')";
        cell.onclick = function() { changeMap(MAP_CELL_LIST[i]); };
        cell.onmouseover = function() { setMapLabel(MAP_CELL_LIST[i].toUpperCase()); };
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

function voteChar(username="???"){
    var vote_window = document.getElementById("vote-ui");
    vote_window.style.display = "block"; // show the vote UI
    vote_window.querySelector("#vote-user").innerHTML = username; // set the voted user name
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
    document.getElementById("game-ui").style.display = "none"; // hide the game screen
    closePopups(); // close all current popups
    document.getElementById("vote-confirm").innerHTML = ""; // clear the vote confirmation message
    setMapCells(); // reset the map cells in the popup menu
    showPopup("welcome"); // show the welcome popup
    removeAvatar(); // remove all avatars from the game
}


window.onbeforeunload = function() {
  return "You will not be able to return as the same character. Once you leave, the experiment is over<br>Do you wish to leave?";
};