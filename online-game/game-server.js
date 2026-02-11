// requirements
var express = require('express');
var http = require('http');
var path = require('path');
var socketIO = require('socket.io');
var fs = require('fs');

var app = express();
var server = http.createServer(app);
var io = socketIO(server);
var port = 4000;


// set the port
app.set('port', port);
app.use('/static', express.static(path.join(__dirname, '/static')));


var playerjs = require('./static/js/avatar.js');

// Routing
app.get('/', function(req, res) {
    res.status(200).sendFile(path.join(__dirname, 'index.html'));
});


// starts the server
server.listen(app.get('port'), function() {
    console.log('Server is running on port ' + port);
});


// set up the role associations
var MAX_ROLES = 5;
var player_role_ct = {};
for(let occ in playerjs.AVATAR_CLASS) {
    player_role_ct[occ] = 0; // initialize the role count to 0
}
var hero_ct = 0; // count of heroes

// import class/role data
var nameDat = require('./static/data/names.json');
var roleDat = require('./static/data/roles.json');
var badWords = require('./static/data/badwords.json');


// handle player game state
var players = {};
var playerRoles = {};
var playerTxtTime = {};
var strike_list = {};

var chuck_ct = 0; // count of chuck characters
var human_ct = 0;
var npph_ct = 0;

var ghostDat = {};      // data stored of actions for the ghost characters (based on humans)
var valid_admins = [];

const MAX_PLAYERS = 50;
const FPS_I = 60;

var apid_list = [];

// import latest list of ap ids
fs.readFile('./static/data/APID_DATA.txt', 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading file:', err);
    return;
  }

  apid_list = data.split('\n').map(line => line.trim()).filter(line => line.length > 0);
});



// creates a player with a random role (as needed) and class
// gives a description and list of tasks
function newChar(role){
    let race = playerjs.randomRace();

    // get a random occupation based on need
    let occ = "";
    if(role === 'AP'){
        occ = "hero"  // all players in AP are heroes
        race = playerjs.randomNonChuckRace();
    }else{
        // if more roles than players, recount
        let rolesCt = totalRoles();
        if (Object.keys(player_role_ct).length > (rolesCt+hero_ct) ) {
            recountRoles(); // recount the roles
        }

        let avail_occ = getAvailOccs(); // get the available occupations
        
        // check if there are any available occupations
        if(avail_occ.length === 0) {
            // retry
            console.error("No available occupations left for " + role);
            return null; // no available occupations, return null
        }
        occ = avail_occ[Math.floor(Math.random() * avail_occ.length)]; // pick a random occupation from the available ones
        player_role_ct[occ]++; // increment the role count for the occupation
    }

    // change race if chuck limit reached
    if(race == "chuck" && chuck_ct >= 3 && occ != "chuck"){
        race = playerjs.randomNonChuckRace(); // pick a random race
    }else if(race == "chuck" && chuck_ct < 3){      // chuck's job is chuck
        occ = "chuck";
    }

    //console.log("Assigned occupation: " + occ + " and race: " + race + " for role: " + role);
    // get a random name from the names data
    let fnames = nameDat[race]['firstname']
    let lnames = nameDat[race]['lastname']
    let name = fnames[Math.floor(Math.random() * fnames.length)] + " " + lnames[Math.floor(Math.random() * lnames.length)];

    // set the description and tasks based on the occupation
    // TODO: mix in random tasks from general 
    let desc = roleDat[occ].description;
    let tasks = getRandomElements(roleDat[occ].tasks, 3); // get 3 random tasks from the occupation's task list

    return {'race': race, 'occ': occ, 'name': name, 'desc': desc, 'tasks': tasks, 'role': role};
}



function makeGhostDat(){
    
}



//newChar('NPP')


io.on('connection', function(socket) {
    // handle role assignment
    socket.on('assign-role', function(dat){
        let play_type = dat.role ? (dat.role) : dat; // grab full data structure or string
        let sid = dat.ap_id;
        if (Object.keys(players).length >= MAX_PLAYERS) {
            socket.emit('message', {'status':'reject','avatar':null});
            return;
        }

        // check if the ap_id added matches the saved socket ids file
        if(play_type == "NPP-Human"){
            if(!wasAP(sid)){
                console.log("Invalid NPP-Human request for socket ID: " + sid);
                socket.emit('message', {'status':'reject', 'avatar':null, 'msg':'Invalid AP Socket ID! \nPlay the game as the AP role first before you can play as an NPP!'}); // send reject message if character creation failed
                return;
            }else{
                console.log("Successful NPP-Human validation AP:[" + sid + "] -> NPP:[" + socket.id + "]")
            }
        }

        let char_dat = newChar(play_type);      // AP or NPP
        if (!char_dat) {
            console.error("Failed to create character data for role: " + play_type);
            socket.emit('role-reject', 'Not enough characters available'); // send reject message if character creation failed
            return;
        }else{
            playerRoles[socket.id] = char_dat; // store the character data for the player
            console.log("> Assigned role to player " + socket.id + ": " + char_dat.name + " (" + char_dat.race + " " + char_dat.occ + ") - " + play_type);
            socket.emit('role-assigned', char_dat); // send the assigned role to the client
        }
    })

    socket.on('admin', function(password){
        if(password == "2drunk_M3RCS!"){
            valid_admins.push(socket.id);
            socket.emit('message', {'status':'accept','avatar': null, 'admin':true});
        }else{
            socket.emit('message', {'status':'reject', 'avatar':null, 'msg':'Incorrect password!'})
        }
    })

    // handle player joining the game
    socket.on('join', function() {
        let char_data = playerRoles[socket.id]; // get the character data for the player

        players[socket.id] = new playerjs.Avatar(
            char_data.name, socket.id,
            char_data.occ, char_data.race,
            char_data.role
        );
        players[socket.id].roleType = char_data.role; // set the role type
        players[socket.id].area = playerjs.AVATAR_AREAS[char_data.occ] || 'plaza'; // set the area based on the occupation
        players[socket.id].tasks = char_data.tasks; // set the tasks for the player
        players[socket.id].show = true; // set the avatar to be shown
        
        console.log(players[socket.id].name + ' (' + players[socket.id].raceType + ' ' + players[socket.id].classType + ') joined! [ID: ' + socket.id + ']'); ;
        socket.emit('message', {'status':'accept','avatar': players[socket.id]}); // send the player data to the client
        io.emit('playerNum', {'cur_num':Object.keys(players).length,'max_num':MAX_PLAYERS});
        logDat(players[socket.id], '[JOIN SERVER]');  
        recountRoles(); // count the roles assigned

        if(char_data.role == "AP" || char_data.role == "NPP-Human"){
            addHumanCt();
        }

        // send the updated player list to all clients
        //io.emit('updatePlayers', players);
    });

    
    // handle player movement
    socket.on('move', function(data) {
        if (players[socket.id]) {
            players[socket.id].position = data.position;
            logDat(players[socket.id], '[MOVE]');
            //io.emit('updatePlayers', players);
        }
    });

    socket.on('moveToPlayer', function(data) {
        if (players[socket.id] && players[data.targetId]) {
            let new_pos = {x:players[data.targetId].position.x, y:players[data.targetId].position.y};
            // offset the position slightly to avoid overlap
            let ofx = Math.random() - 0.5;
            if( ofx < 0) new_pos.x -= 50; 
            if( ofx >= 0) new_pos.x += 50;

            players[socket.id].position = new_pos; // move to the target player's position
            logDat(players[socket.id], '[MOVE_TO_CHAR] ' + data.targetId + ' (' + new_pos.x + ', ' + new_pos.y + ')');
            //io.emit('updatePlayers', players);
        }
    });

    
    // handle player area change
    socket.on('changeArea', function(data) {
        if (players[socket.id]) {
            players[socket.id].area = data.area;
            players[socket.id].position = data.position; // update position when changing area
            players[socket.id].show = true; // set the avatar to be shown
            logDat(players[socket.id], '[CHANGE_AREA] ' + data.area);
        }
    });

    // handle player chat messages
    socket.on('chat', function(data) {
        if (players[socket.id]) {
            var txt = data.text.trim();
            if (txt.length === 0) return; // ignore empty messages
            txt = txt.substring(0, 75); // limit text length to 75 characters

            // check for bad words
            if(guardDog(txt)){
                
                // add strike to the player
                if(!strike_list[socket.id]){
                    strike_list[socket.id] = 1;
                }else{
                    strike_list[socket.id] += 1;
                }

                logDat(players[socket.id], '[CHAT BLOCKED] ' + data.text + " (Strike " + strike_list[socket.id] + ")");
                socket.emit('alert', {'msg':'Your message was blocked due to inappropriate language. Strike ' + strike_list[socket.id] + ' of 3.'});

                // check if player has reached 3 strikes
                if(strike_list[socket.id] >= 3){
                    const otherSocket = io.sockets.sockets.get(socket.id);
                    if (otherSocket){
                        otherSocket.emit('kick')
                        otherSocket.disconnect(true);
                        console.log("!! KICKED USER " + socket.id + " FOR 3 CHAT STRIKES");
                    }
                }
                return;
            }


            players[socket.id].setText(txt);
            textTimeout(players[socket.id], socket.id);
            logDat(players[socket.id], '[CHAT] ' + txt); // log the chat message
            //io.emit('updatePlayers', players);
        }
    });


    // handle player animation
    socket.on('animate', function(data) {
        if (players[socket.id]) {
            players[socket.id].sprite.cur_animation = data.cur_anim; // set the current animation
            players[socket.id].sprite.frame = data.frame; // set the current frame 
            players[socket.id].sprite.frameInterval = 250; // reset the frame interval
            logDat(players[socket.id], '[ANIM] ' + data.cur_anim);
        }
    });


    // handle player votes
    socket.on('vote', function(data){
        if(players[socket.id]){
            addVote(socket.id, data.avatar, data.dec, data.conf);
            addAPID(socket.id);
            console.log(":: AP [" + socket.id + "] voted " + data.dec.toUpperCase() + " on [" + data.avatar + "] (" + players[data.avatar].roleType + ") ::")
            io.emit('vote-accepted',{});
        }
    })

    // kick players
    socket.on('kick', function(other_id){
        if(valid_admins.indexOf(socket.id) != -1){
            const otherSocket = io.sockets.sockets.get(other_id);
            if (otherSocket){
                otherSocket.emit('kick')
                otherSocket.disconnect(true);
                console.log("!! ADMIN KICKED USER " + other_id);
            }
        }else{
            console.log("!! INVALID ADMIN: [" + socket.id + "] tried to kick [" + other_id + "]")
        }
    })


    // handle disconnection
    socket.on('disconnect', function() {
        console.log('User disconnected: ' + socket.id);
        if(players[socket.id]){ // if player does not exist, do nothing
            console.log("Leaving player:" + socket.id + " (" + players[socket.id].roleType + ")");
        
            logDat(players[socket.id], '[DISCONNECT]');
            let was_human = players[socket.id].roleType == "AP" || players[socket.id].roleType == "NPP-Human";
            freeOcc(socket.id); // free the occupation of the player
            if (playerTxtTime[socket.id]) {
                clearTimeout(playerTxtTime[socket.id]); // clear the text timeout
            }
            delete players[socket.id];
            delete playerRoles[socket.id]; // remove the character data for the player
            delete playerTxtTime[socket.id]; // remove the text timeout
            delete strike_list[socket.id];
            
            recountRoles();
            if(was_human){
                addHumanCt();
            }
            console.log('Current players: ' + Object.keys(players).length);
            io.emit('playerNum', {'cur_num':Object.keys(players).length,'max_num':MAX_PLAYERS});
        
        //io.emit('updatePlayers', players)
        }

        // remove the admin
        if(valid_admins.indexOf(socket.id) != -1){
            valid_admins.pop(valid_admins.indexOf(socket.id));
        }
    });
});



process.on('SIGINT', function() {
    console.log('! Server is shutting down [SIGINT]');
    cleanClose();
    process.exit();
});
process.on('SIGTERM', function() {
    console.log('! Server is shutting down [SIGTERM]');
    cleanClose();
    process.exit();
});


process.on('uncaughtException', function(err) {
    console.error('Uncaught Exception:', err);
    // reset the server state
    cleanClose();
    process.exit(1);
});






// stop showing the player's chat message after a timeout
function textTimeout(player,id) {
    if (playerTxtTime[id]) {                    // reset the timeout
         clearTimeout(playerTxtTime[id]);
    }
    
    playerTxtTime[id] = setTimeout(function() {
        player.showText = false;
        player.text = "";
    }, 3000); // text will be shown for 3 seconds
}

function logDat(player, status){
    var log = fs.createWriteStream('./static/data/LOG.txt', { flags: 'a' });
    var dat = {
        'id': player.id,
        'name': player.name,
        'area': player.area,
        'classType': player.classType,
        'raceType': player.raceType,
        'roleType': player.roleType,
        'position': player.position,
        'status': status
    };
    log.write("["+new Date().toISOString() + '] ' + JSON.stringify(dat) + '\n');
    log.end();
}

function isAI(avatar){
    return players[avatar].roleType.includes("AI")
}

function addVote(player,candidate,vote,confidence){
    var voteLog = fs.createWriteStream('./static/data/VOTE_DATA.txt', { flags: 'a'});
    var dat = {
        'correct-vote': (isAI(candidate) && vote=='ai') || (!isAI(candidate) && vote=='human'),
        'ap-id': player,
        'npc-id': candidate,
        'npc-actual': players[candidate].roleType,
        'npc-job': players[candidate].raceType+' '+players[candidate].classType,
        'vote':vote,
        'confidence':confidence,
        'time':"["+new Date().toISOString() + ']'
    }
    voteLog.write(JSON.stringify(dat)+"\n");
    voteLog.end();
}

// saves the AP id to a file for retrieval later
function addAPID(ap_id){
    if (wasAP(ap_id)){
        return; // already recorded
    }
    var apLog = fs.createWriteStream('./static/data/APID_DATA.txt', { flags: 'a'});
    apLog.write(ap_id+"\n");
    apLog.end();
    apid_list.push(ap_id)
}

// returns whether or not this user was previously an AP avatar
function wasAP(id){
    return apid_list.includes(id);
}


// adds the number of current humans with the timestamp
function addHumanCt(){
    var humanLog = fs.createWriteStream('./static/data/humanCt.txt', { flags: 'a'});
    let dat = {
        'time':"["+new Date().toISOString() + ']',
        'total_humans': human_ct,
        'ap': hero_ct,
        'npp': npph_ct
    }
    humanLog.write(JSON.stringify(dat)+"\n");
    humanLog.end();
}

function cleanClose(){
    let ids = Object.keys(players);
    for (var id in ids) {
        if (players[id]) {
            logDat(players[id], '[SERVER CLOSED]');
            delete players[id];
        }
    }
    //io.emit('server_dead', {'reroute': '/static/server_down.html'});
    server.close();
    console.log('Server closed. All players disconnected.');
}


function getRandomElements(array, count) {
  const shuffled = [...array]; // Make a copy to avoid modifying the original
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}



// role and occupation management functions
function getAvailOccs(){
    let avail_occ = [];
    for (let occs in playerjs.AVATAR_CLASS) {
        if (player_role_ct[occs] < MAX_ROLES) {
            for(let i=0;i<MAX_ROLES-player_role_ct[occs];i++)
                avail_occ.push(occs);
        }
    }
    return avail_occ;
}

function freeOcc(id) {
    if( !players[id]) return; // if player does not exist, do nothing
    let occ = players[id].classType; // get the occupation of the player

    if (player_role_ct[occ] && player_role_ct[occ] > 0) {
        player_role_ct[occ]--; // decrement the role count for the occupation
        //console.log("Decremented role count for occupation: " + occ + " to " + player_role_ct[occ]);
    }
}

function recountRoles() {
    console.log("Recounting roles...");
    player_role_ct = {};
    hero_ct = 0;
    human_ct = 0;
    npph_ct = 0;
    chuck_ct = 0;

    for (let occ in playerjs.AVATAR_CLASS) {
        player_role_ct[occ] = 0; // reset the role count to 0
    }
    for (let id in players) {
        if (players[id]) {
            let occ = players[id].classType; // get the occupation of the player
            if (occ == "hero") {
                hero_ct++; 
                human_ct++;
            }
            else if (players[id].roleType == "NPP-Human"){
                npph_ct++;
                human_ct++;
            }
            if (player_role_ct[occ] !== undefined) {
                player_role_ct[occ]++; // increment the role count for the occupation
            }

            if(occ == "chuck"){
                chuck_ct++;
            }
        }
    }
    showNumRoles(); // show the total roles assigned after recounting
}

function totalRoles(){
    let total = 0;
    for (let occ in player_role_ct) {
        total += player_role_ct[occ];
    }
    return total;
}

function showNumRoles(){
    let total = totalRoles();
    console.log("### Total roles: " + total + "/" + (MAX_ROLES * Object.keys(player_role_ct).length) + " (+" + hero_ct + " AP players) ###");
    console.log(`     Humans: ${human_ct} | AI: ${total-npph_ct} -- AP: ${hero_ct} | NPP: ${total}`)
}

// simple text filter to check for bad words
function guardDog(text){
    let lowered = text.toLowerCase();
    let bwords = badWords['bad_words'];
    for(let i=0;i<bwords.length;i++){
        if(lowered.includes(bwords[i])){
            return true;
        }
    }
    return false;
}








// CONSTANTLY update the players
setInterval(function() {
    if(human_ct > 0){	// only update if there are humans playing
	io.emit('updateAvatars', {avatars:players});
    }
}, 1000 / FPS_I); // frames to update the players (e.g., 60 FPS = 1000/60 = 16.67 ms per frame)
