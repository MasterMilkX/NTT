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
for(let occ in playerjs.AVATAR_OCC) {
    player_role_ct[occ] = 0; // initialize the role count to 0
}




// handle player game state
var players = {};
var playerTxtTime = {};
//const MAX_PLAYERS = 25;


// creates a player with a random role (as needed) and class
// gives a description and list of tasks
function newRole(){
    let race = playerjs.getRandomRace();

    // get a random occupation based on need
    let avail_occ = [];
    for (let occ in playerjs.AVATAR_OCC) {
        if (player_role_ct[occ] < MAX_ROLES) {
            for(let i=0;i<MAX_ROLES-player_role_ct[occ];i++)
                avail_occ.push(occ);
        }
    }
    let occ = avail_occ[Math.floor(Math.random() * avail_occ.length)]; // pick a random occupation from the available ones
    player_role_ct[occ]++; // increment the role count for the occupation


}


io.on('connection', function(socket) {
    socket.on('assign-role', function(){
        let char_dat = newRole();
        socket.emit('role-assigned', char_dat); // send the assigned role to the client
    })

    /*
    socket.on('join', function(name) {
        if (Object.keys(players).length >= MAX_PLAYERS) {
            socket.emit('message', 'reject');
            io.emit('playerNum', {'cur_num':Object.keys(players).length,'max_num':MAX_PLAYERS});
            return;
        }
        players[socket.id] = new playerjs.Player(name, socket.id);
        console.log(name + '(' + players[socket.id].race + ' ' + players[socket.id].pclass + ') joined! [ID: ' + socket.id + ']'); ;
        socket.emit('message', 'accept');
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
    */
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





// CONSTANTLY update the players
setInterval(function() {
    io.emit('updatePlayers', players);
}, 1000 / 60); // 60 FPS