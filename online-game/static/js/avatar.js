const AVATAR_RACE = {'elf':0, 'beastman':1, 'orc':2, 'lizard':3, 'nord':4, 'chuck': 5}
const AVATAR_CLASS = {'baker':0, 'butcher':1, 'blacksmith':2, 'general_goods':3, 'apothecary':4, 'knight_trainer':5, 'librarian':6, 'barmaid':7, 'gossip':8, 'mercenary':9, 'drunk':10, 'wizard':11, 'bard':12};
const AVATAR_AREAS = {'hero':'plaza','baker': 'bakery', 'butcher': 'butcher', 'blacksmith': 'blacksmith', 'general_goods': 'market', 'apothecary': 'apothecary', 'knight_trainer': 'training_ground', 'librarian': 'library', 'barmaid': 'tavern', 'gossip': 'plaza', 'mercenary': 'training_ground', 'drunk': 'tavern', 'wizard': 'library', 'bard': 'tavern', 'chuck': 'plaza'};


// Role data sheet: https://docs.google.com/spreadsheets/d/1-5Qovckhty3XPEZ0E2dhk-cmdnd1MXBUqJ2Fu7BJ8l0/edit?gid=1067230120#gid=1067230120

function randomPos(w,h){
    return {
        x: Math.floor(Math.random() * w),
        y: Math.floor(Math.random() * h)
    };
}

function randomClass(){
    let classes = Object.keys(AVATAR_CLASS);
    return classes[Math.floor(Math.random() * classes.length)];
}

function randomRace(){
    let races = Object.keys(AVATAR_RACE);
    return races[Math.floor(Math.random() * races.length)];
}

// for use with offline testing only
function randomChar(role){
    let r = randomRace();
    let c = randomClass();
    if (r == 'chuck')
        c = 'chuck'; // chuck is always chuck
    else if (role == 'AP')
        c = 'hero'; // if the role is AP, set the class to hero
    let a = new Avatar(
       'OFFLINE AVATAR',
       'offline-' + Math.random().toString(36).substring(2, 8), // generate a random socket id
       c,
       r,
       role
    );
    a.area = AVATAR_AREAS[a.classType]; // set the area based on the class type
    a.position = randomPos(canvas.width, canvas.height); // set a random position on the
    a.show = true; // set the avatar to be visible
    a.tasks = ["Do a little dance", "Explore", "Say hi"]; // initialize tasks as an empty array

    return a;
}

// player class definition
class Avatar {
    constructor(name, id, occ, race, roletype) {
        // identity properties
        this.name = name; // the username of the avatar
        this.id = id; // the unique identifier of the avatar (socket id)

        this.classType = occ; // the class/occupation of the avatar (e.g., "warrior", "mage")
        this.raceType = race  // the race of the avatar (e.g., "human", "elf")
        this.roletype = roletype; // the role type of the avatar (e.g., "impostor", "crewmate")

        this.area = null;   // the area where the avatar is currently located
        this.show = true; // whether the avatar is currently visible on the map

        // movement properties
        this.position = { x: 0, y: 0 }; // the position of the avatar on the map
        this.nextPos = { x: 0, y: 0 }; // the next position of the avatar on the map
        this.speed = 0.5; // the speed of the avatar (default is 1)
        this.move = false; // whether the avatar is currently moving or not
        this.moveTime = 0;

        // sprite properties
        this.sprite = {
            width: 48, // width of the sprite
            height: 48, // height of the sprite

            frame: 0, // current frame for animation
            frameCount: 2, // number of frames in the sprite animation
            frameInterval: 250, // time between frames in milliseconds

            animations:{
                'idle': [0,0],
                'dance': [0,2],
                'wave': [3,4]
            },
            cur_animation: 'idle', // current animation state
        };

        // text properties
        this.text = "";
        this.textInt = 0;   // text timeout interval
        this.showText = false;
    }

    // functions are not passed through by the socket -- so define them externally
    move(x, y) {
        this.position.x += x;
        this.position.y += y;
    }

    setText(text) {
        this.text = text;
        this.showText = true;
    }


}


module.exports = {
    Avatar: Avatar,
    AVATAR_CLASS : AVATAR_CLASS,
    AVATAR_RACE : AVATAR_RACE,
    AVATAR_AREAS : AVATAR_AREAS,
    randomRace : randomRace
};