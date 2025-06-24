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
var MAX_ROLES = 3;
var player_role_ct = {};
for(let occ in playerjs.AVATAR_CLASS) {
    player_role_ct[occ] = 0; // initialize the role count to 0
}

// import class/role data
var nameDat = require('./static/data/names.json');
var roleDat = require('./static/data/roles.json');

// handle player game state
var players = {};
var playerRoles = {};
var playerTxtTime = {};
const MAX_PLAYERS = 25;
const FPS_I = 1000;


// creates a player with a random role (as needed) and class
// gives a description and list of tasks
function newChar(role){
    let race = playerjs.randomRace();

    // get a random occupation based on need
    let occ = "";
    if(role === 'AP'){
        occ = "hero"  // all players in AP are heroes
    }else{
        let avail_occ = [];
        for (let occs in playerjs.AVATAR_CLASS) {
            if (player_role_ct[occs] < MAX_ROLES) {
                for(let i=0;i<MAX_ROLES-player_role_ct[occs];i++)
                    avail_occ.push(occs);
            }
        }
        if(avail_occ.length === 0) {
            console.error("No available occupations left for role: " + role);
            return null; // no available occupations, return null
        }
        occ = avail_occ[Math.floor(Math.random() * avail_occ.length)]; // pick a random occupation from the available ones
        player_role_ct[occ]++; // increment the role count for the occupation
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

newChar('NPP')


io.on('connection', function(socket) {
    socket.on('assign-role', function(play_type){
        if (Object.keys(players).length >= MAX_PLAYERS) {
            socket.emit('message', {'status':'reject','avatar':null});
            return;
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

    
    socket.on('join', function() {
        let char_data = playerRoles[socket.id]; // get the character data for the player

        players[socket.id] = new playerjs.Avatar(
            char_data.name, socket.id,
            char_data.occ, char_data.race,
            char_data.role
        );
        players[socket.id].position = { x: 0, y: 0 }; // set the initial position of the player
        players[socket.id].area = "plaza";  // set the initial area of the player
        console.log(players[socket.id].name + '(' + players[socket.id].raceType + ' ' + players[socket.id].classType + ') joined! [ID: ' + socket.id + ']'); ;
        socket.emit('message', {'status':'accept','avatar': players[socket.id]}); // send the player data to the client
        io.emit('playerNum', {'cur_num':Object.keys(players).length,'max_num':MAX_PLAYERS});
        addPlayerDat(players[socket.id], 'joined');  
        // send the updated player list to all clients
        //io.emit('updatePlayers', players);
    });

    
    // handle player movement
    socket.on('move', function(data) {
        if (players[socket.id]) {
            players[socket.id].position = data.position;
            addPlayerDat(players[socket.id], 'moved');
            //io.emit('updatePlayers', players);
        }
    });

    socket.on('chat', function(data) {
        if (players[socket.id]) {
            var txt = data.text.trim();
            if (txt.length === 0) return; // ignore empty messages
            txt = txt.substring(0, 50); // limit text length to 50 characters
            players[socket.id].setText(txt);
            textTimeout(players[socket.id], socket.id);
            addChat({'id': socket.id, 'name': players[socket.id].name, 'text': txt});
            //io.emit('updatePlayers', players);
        }
    });

    
    // handle disconnection
    socket.on('disconnect', function() {
        console.log('User disconnected: ' + socket.id);
        if(players[socket.id]) // if player does not exist, do nothing
            addPlayerDat(players[socket.id], 'disconnected');
            delete players[socket.id];
            delete playerTxtTime[socket.id]; // remove the text timeout
            console.log('Current players: ' + Object.keys(players).length);
            io.emit('playerNum', {'cur_num':Object.keys(players).length,'max_num':MAX_PLAYERS});
        
        //io.emit('updatePlayers', players);
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

// write to the chatlog
function addChat(dat){
    var log = fs.createWriteStream('chatlog.txt', { flags: 'a' });
    log.write("["+new Date().toISOString() + '] ' + JSON.stringify(dat) + '\n');
    log.end();
}

function addPlayerDat(player, status){
    var log = fs.createWriteStream('playerlog.txt', { flags: 'a' });
    var dat = {
        'id': player.id,
        'name': player.name,
        'position': player.position,
        'status': status
    };
    log.write("["+new Date().toISOString() + '] ' + JSON.stringify(dat) + '\n');
    log.end();
}

function cleanClose(){
    let ids = Object.keys(players);
    for (var id in ids) {
        if (players[id]) {
            addPlayerDat(players[id], 'disconnected [server closed]');
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


// CONSTANTLY update the players
setInterval(function() {
    io.emit('updateAvatars', {avatars:players});
}, 1000 / FPS_I); // frames to update the players (e.g., 60 FPS = 1000/60 = 16.67 ms per frame)