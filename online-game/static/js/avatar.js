const AVATAR_RACE = {'elf':0, 'beastman':1, 'orc':2, 'lizard':3, 'nord':4, 'chuck': 5}
const AVATAR_CLASS = {'baker':0, 'butcher':1, 'blacksmith':2, 'general_goods':3, 'apothecary':4, 'knight_trainer':5, 'librarian':6, 'barmaid':7, 'gossip':8, 'mercenary':9, 'drunk':10, 'wizard':11, 'bard':12};

function randomPos(w,h){
    return {
        x: Math.floor(Math.random() * w),
        y: Math.floor(Math.random() * h)
    };
}

function randomRace(){
    let races = Object.keys(AVATAR_RACE);
    return races[Math.floor(Math.random() * races.length)];
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
        this.highlight = false; // whether the avatar is highlighted or not

        // sprite properties
        this.sprite = {
            width: 48, // width of the sprite
            height: 48, // height of the sprite

            frame: 0, // current frame for animation
            frameCount: 2, // number of frames in the sprite animation
            frameInterval: 500, // time between frames in milliseconds

            animations:{
                'idle': [0,0],
                'dance': [1,2],
                'wave': [3,4]
            },
            cur_animation: 'idle', // current animation state
        };

        // text properties
        this.text = "";
        this.textInt = 0;   // text timeout interval
        this.showText = false;
    }

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
    randomRace : randomRace
};