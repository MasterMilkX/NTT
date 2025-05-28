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
}







// INITIALIZATION FUNCTION 
function init(){
    showPopup("welcome")
}

// MAIN GAME LOOP
function main() {
    render();
    requestAnimationFrame(main);
}

main();