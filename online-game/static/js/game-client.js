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
});

socket.on('message', function(data) {
    //console.log(data);

    if(data.status === 'reject'){
        if(data.msg){
            alert(data.msg)
        }else{
            alert("Server is full. Try again later.");
        }
        showPopup('role-rej')
        in_game = false;
        return;
    }else if(data.status === 'accept'){
        console.log("Joined successfully!");

        // admin mode
        if(data.admin){
            in_game = true;
            startGame('plaza');
            cur_location = 'plaza';
            socket_avatar = null;
            IS_ADMIN = true;
            return;
        }

        socket_avatar = data.avatar; // store the avatar data
        cur_location = data.avatar.area; // set the current location to the avatar's area
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

    updateRole(data); // update the role UI with the assigned role
    updateInfo();

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

socket.on('vote-accepted', function(data){
    document.getElementById("vote-confirm").innerHTML = "Vote submitted!"
    setTimeout(function() {
        document.getElementById("vote-confirm").innerHTML = "";
    },5000); // clear the confirmation message after 2 seconds

    // disable vote buttons then re-enable after 3 seconds
    document.getElementById('vote-yea').disabled = true;
    document.getElementById('vote-nay').disabled = true;
    setTimeout(function(){
        document.getElementById('vote-yea').disabled = false;
        document.getElementById('vote-nay').disabled = false;
    }, 3000);
})

socket.on('kick', function(){
    alert("YOU'VE BEEN KICKED FROM THE GAME!");
    in_game = false;
    showPopup('goodbye');
})

socket.on('alert', function(data){
    alert(data.msg);
})