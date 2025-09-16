const CHAT_TIMEOUT = 3000;


class Avatar{
    constructor(username, classType, occupation, roletype) {

        // identity properties
        this.username = username; // the username of the avatar
        this.classType = classType; // the class of the avatar (e.g., "warrior", "mage")
        this.occupation = occupation; // the occupation of the avatar (e.g., "blacksmith", "farmer")
        this.roletype = roletype; // the role type of the avatar (e.g., "impostor", "crewmate")

        // other properties
        this.position = { x: 0, y: 0 }; // the position of the avatar on the map
        this.area = null;   // the area where the avatar is currently located
        this.nextPos = { x: 0, y: 0 }; // the next position of the avatar on the map
        this.speed = 0.5; // the speed of the avatar (default is 1)
        this.move = false; // whether the avatar is currently moving or not
        this.moveTime = 0;

        // animations and rendering
        this.show = false;
        this.baseSpr = new Image();    // the base sprite for the avatar (class)
        this.costSpr = new Image();    // the costume overlay (occupation)
        this.highlight = false; // whether the avatar is highlighted or not

        // chat properties
        this.chatMsg = ""; // the chat message of the avatar
        this.chatTimeout = 0; // the time when the chat message was sent
        this.showChat = false; // whether the chat message is currently shown or not
        this.chatTime = 0; // the time when the chat message was sent



        // load the sprite for the avatar immediately on spawning
        this.onloadSpr(); // call the method to load the sprite
    }

    onloadSpr(){
        // Load the sprite for the avatar
        this.spr = new Image();

        // TODO: set to the appropriate setup based on class and occupation
        if(this.classType == "chicken"){
            this.baseSpr.src = "assets/tmp/chicken.png"; // chicken is special
        }else{
            this.baseSpr.src = `assets/tmp/goblin.png`; 
        }


        this.baseSpr.onload = () => {
            console.log(`${this.username}'s sprite loaded successfully.`);
            this.show = true; // set show to true when the sprite is loaded
        };
    }

    setPos(x, y) {
        // Set the position of the avatar
        this.position = { x, y };
        this.nextPos = { x, y }; // also set the next position to the same as the current position
        clearTimeout(this.moveTime); // clear any existing move timeout
    }

    setNextPos(x, y) {
        // Set the next position of the avatar
        this.nextPos = { x, y };
        this.move = true; // set move to true to start moving towards the next position
    }
    
    gotoPos(){
        // move the avatar towards the next position

        if(dist(this.position, this.nextPos) < this.speed){
            // if the avatar is close enough to the next position, set the position to the next position
            this.position = { ...this.nextPos };
            this.move = false; // stop moving
            clearTimeout(this.moveTime); // clear the timeout to stop moving

        }else{
            // move the avatar towards the next position
            const angle = Math.atan2(this.nextPos.y - this.position.y, this.nextPos.x - this.position.x);
            this.position.x += Math.cos(angle) * this.speed;
            this.position.y += Math.sin(angle) * this.speed;

            // repeat until the avatar reaches the next position
            self.moveTime = setTimeout(() => {
                this.gotoPos();
            }, 1000 / 60); // call this function at 60 FPS
        }

    }

    setArea(newArea) {
        // Set the area where the avatar is currently located
        this.area = newArea;
    }

    wasClicked(x, y) {
        // Check if the avatar was clicked based on the x and y coordinates
        const clickRadius = 75; // define a click radius for the avatar
        return this.show && dist({ x, y }, this.position) < clickRadius; // return true if the distance is less than the click radius
    }

    // --- CHAT MESSAGES --- //

    setChatMsg(msg) {
        // Set the chat message of the avatar
        this.chatMsg = msg; // set the chat message
        this.chatTime = Date.now(); // set the time when the chat message was sent
        this.chatShow = true; // set show to true to show the chat message
        clearTimeout(this.chatTimeout); // clear any existing chat timeout
        this.chatTimeout = setTimeout(() => {
            this.showChat = false; // hide the chat message after 5 seconds
            this.chatMsg = ""; // clear the chat message
        }, CHAT_TIMEOUT+(Math.floor(msg.length/20))*200); // hide the chat message after 2 seconds
    }

    ///// GENERAL METHODS /////

    update() {
        // Update the avatar's position and other properties
        if (this.show && this.move) {
            this.gotoPos(); // move the avatar towards the next position
        }
    }


    render(ctx) {
        // Render the avatar on the canvas context
        if (!this.show || !this.baseSpr) return; // if the sprite is not loaded, do not render

        ctx.save();

        // highlight
        if(this.highlight){
            // draw a highlight circle under the avatar if it is highlighted
            ctx.beginPath();
            ctx.ellipse(this.position.x, this.position.y+70, 64, 16, 0, 0, Math.PI * 2); // use the click radius as the highlight radius
            //ctx.arc(this.position.x, this.position.y+100, 30, 0, Math.PI * 2); // use the click radius as the highlight radius
            ctx.fillStyle = "yellow"; // set the highlight color
            ctx.lineWidth = 5; // set the highlight line width
            ctx.fill(); // draw the highlight circle
        }


        // draw the character
        ctx.drawImage(this.baseSpr, this.position.x-64, this.position.y-64, 128, 128); // draw the base sprite
        if (this.costSpr) {
            ctx.drawImage(this.costSpr, this.position.x, this.position.y); // draw the costume overlay if it exists
        }

        // show the chat message 
        if (this.chatShow && this.chatMsg) {
            // draww the box above
            ctx.fillStyle = "#ffffffdd"; // semi-transparent white background
            var chatWidth = Math.max(200, this.chatMsg.length * 10); // calculate the width based on the message length
            ctx.fillRect(this.position.x - chatWidth / 2, this.position.y - 100, chatWidth, 40); // draw a rectangle for the chat message background


            ctx.font = "20px Arial"; // set the font for the chat message
            ctx.fillStyle = "black"; // set the color for the chat message
            ctx.textAlign = "center"; // center the text
            ctx.fillText(this.chatMsg, this.position.x, this.position.y - 70); // draw the chat message above the avatar
        }


        ctx.restore();
    }

}


function dist(p1,p2){
    // Calculate the distance between two points p1 and p2
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}