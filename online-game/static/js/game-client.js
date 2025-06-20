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

    if(data === 'reject'){
        alert("Server is full. Try again later.");
        in_game = false;
        retry_conn();
        return;
    }else if(data === 'accept'){
        console.log("Joined successfully!");
        in_game = true;
    }else{
        console.log("Status from server: " + data);
        in_game = false; 
        return;
    }
});


socket.on('role-assigned', function(data) {
    // handle role assignment
    console.log("Role assigned:", data);
    username = data.name; // set the username to the assigned username
    char_dat = data; // store the character data

    updateRole(); // update the role UI with the assigned role

    showPopup('role-ass');

    //role_type = data.role; // set the role type to the assigned role
    //document.getElementById("role-type").innerText = "Role: " + role_type; // update the UI with the assigned role
});

socket.on('updateAvatars', function(data) {
    updateAvatars(data.avatars); // update the avatars with the received data
});