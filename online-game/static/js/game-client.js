// GAME SOCKET CLIENT CODE

var socket = io();
var in_game = false; // flag to check if the user is in the game

// error on connection
socket.on('connect_error', function(err) {
    console.error('Connection error:', err);
    console.log("Server disconnected!")
    in_game = false;
    socket.disconnect(); // disconnect the socket
    alert("Connection error. Please try again later.");
});

// connect to the server and reception
socket.on('connect', function() {
    console.log('Connected to the server');
    if (!in_game) {
        in_game = true; // set in_game to true
        console.log("Joining game...");
    }
});

socket.on('message', function(data) {
    //console.log(data);

    if(data.status === 'reject'){
        alert("Server is full. Try again later.");
        in_game = false;
        return;
    }else if(data.status === 'accept'){
        console.log("Joined successfully!");
        socket_avatar = data.avatar; // store the avatar data

        socket.emit('move',{'position':{x:canvas.width/2, y:canvas.height*0.75}}); // set a random position for the avatar in the area
        in_game = true;
        startGame(socket_avatar.area); // start the game with the avatar's area
    }else{
        console.log("Status from server: " + data.status);
        in_game = false; 
        return;
    }
});


socket.on('role-assigned', function(data) {
    // handle role assignment
    console.log("Role assigned:", data);
    avatar_name = data.name; // set the username to the assigned username
    char_dat = data; // store the character data

    updateRole(); // update the role UI with the assigned role

    showPopup('role-ass');

    //role_type = data.role; // set the role type to the assigned role
    //document.getElementById("role-type").innerText = "Role: " + role_type; // update the UI with the assigned role
});


socket.on('role-reject', function(nessage){
    // handle role rejection
    showPopup('role-rej')
})



socket.on('updateAvatars', function(data) {
    if(!in_game)
        return;
    
    all_avatars = data.avatars;
    socket_avatar = data.avatars[socket.id]
    updateGame(data.avatars); // update the avatars with the received data
});