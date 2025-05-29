//// MAIN GAME CODE

// canvas setup
var canvas = document.getElementById('game-screen');
var ctx = canvas.getContext('2d');
canvas.width = 1600;
canvas.height = 900;

// background image imports
var map1_IMG = new Image();
map1_IMG.src = 'assets/tmp/battlefield.jpg';    // https://gamebanana.com/mods/369805

var map2_IMG = new Image(); 
map2_IMG.src = 'assets/tmp/plaza.jpg';          // https://www.deviantart.com/jakebowkett/art/Fantasy-Town-Plaza-689235345

var map3_IMG = new Image();
map3_IMG.src = 'assets/tmp/forest.jpg';         // https://www.freepik.com/free-photos-vectors/cartoon-forest

// UI imports
var check_IMG = new Image();
check_IMG.src = 'assets/ui/check.png';         // <a href="https://www.flaticon.com/free-icons/tick" title="tick icons">Tick icons created by Freepik - Flaticon</a>

var cross_IMG = new Image();
cross_IMG.src = 'assets/ui/cancel.png';         // <a href="https://www.flaticon.com/free-icons/cross" title="cross icons">Cross icons created by Freepik - Flaticon</a>

var map_IMG = new Image();
map_IMG.src = 'assets/ui/map.png';           // <a href="https://www.flaticon.com/free-icons/fantasy" title="fantasy icons">Fantasy icons created by Freepik - Flaticon</a>

var exit_IMG = new Image();
exit_IMG.src = 'assets/ui/exit.png';           // <a href="https://www.flaticon.com/free-icons/exit-door" title="exit door icons">Exit door icons created by Freepik - Flaticon</a>




var map_num = 2; // current map number



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
    if (map_num === 1) {
        ctx.drawImage(map1_IMG, 0, 0, canvas.width, canvas.height);
    } else if (map_num === 2) {
        ctx.drawImage(map2_IMG, 0, 0, canvas.width, canvas.height);
    } else if (map_num === 3) {
        ctx.drawImage(map3_IMG, 0, 0, canvas.width, canvas.height);
    }


    ctx.restore();
}


//// EVENT HANDLERS ////


// CHANGE MAP FUNCTION
function changeMap(newMap) {
    if (newMap >= 1 && newMap <= 3) {
        map_num = newMap;
        render(); // re-render the game with the new map
    } else {
        console.error("Invalid map number. Please choose between 1 and 3.");
    }
}

// SHOW POPUPS
function showPopup(id){
    // hide all current popups
    var all_pops = document.getElementsByClassName("ui-popup");
    for (var i = 0; i < all_pops.length; i++) {
        all_pops[i].style.display = "none";
    }

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
    // hide all current popups
    var all_pops = document.getElementsByClassName("ui-popup");
    for (var i = 0; i < all_pops.length; i++) {
        all_pops[i].style.display = "none";
    }

    changeMap(2); // change to plaza map
    document.getElementById("game-ui").style.display = "block"; // show the game screen
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



// INITIALIZATION FUNCTION 
function init(){
    //showPopup("welcome")
    startGame(); // start the game immediately for testing purposes
}

// MAIN GAME LOOP
function main() {
    render();
    requestAnimationFrame(main);
}

main();