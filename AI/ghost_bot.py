'''
    >>>> GHOST BOT <<<<

    A bot that repeats the actions of a real player that was previously on the server.
    Parses the log for only the actions of the player and does them in time

'''



import socketio
import time
import json
import random

GAME_SERVER = 'http://localhost:4000'

sio = socketio.Client()


# GLOBAL VARIABLES

in_game = False

'''
    Avatar Data:
    {
        "id": "???",
        "name": "???",
        "area": "plaza/tavern/market/blacksmith/apothecary/library/training_ground/butcher/bakery",
        "position": {"x": 000, "y": 000},
        "role": "NPP-AI-[BTree/RAND/GRAMMAR]",
        "race": "nord/elf/lizard/beastman/orc/chuck",
        "occ": "baker/butcher/blacksmith/general_goods/apothecary/
                knight_trainer/librarian/barmaid/gossip/mercenary/
                drunk/wizard/bard"
    }
'''



def print2Dash():
    d = {
        'bot_name':avatar['name'],
        'role':avatar['raceType'] + "-" + avatar['classType'],
        'location':avatar['area']
    }
    print("DASHBOARD "+json.dumps(d)+"\n",flush=True)

# --- SOCKET.IO EVENTS --- #

@sio.event
def connect():
    print("Connected to the game server")

@sio.event
def disconnect():
    print("Disconnected from the game server")
    print("Exiting the script...")
    exit(0)  # exit the script when disconnected


# --- ROLE ASSIGNMENTS --- #

@sio.event
def getAvatar():
    # request the server to assign an avatar
    sio.emit('assign-role', 'NPP-AI-GHOST')       # bots are always NPP


@sio.on('role-assigned')
def role_assigned(data):
    global char_dat
    char_dat = data
    print(f"Role assigned: {char_dat}")

    # then ask for the avatar
    sio.emit('join')

@sio.on('message')
def avatar_assigned(data):
    global avatar, in_game
    if data['status'] == 'accept':
        avatar = data['avatar']
        print(f"Avatar assigned: {avatar}")

        # print for the dashboard
        print2Dash()

    elif data['status'] == 'reject':
        print("Role assignment rejected, retrying...")
        in_game = False


# --- GAME EVENTS --- #

@sio.event
def act():
    global avatar

    # don't act if not available
    if not in_game:
        return

    

# --- UPDATE LOOP FOR THE CLIENT --- #


if __name__ == '__main__': 
    # set variant based on random chance
    
    while True:
        # retry connecting to the server until successful
        while not in_game:
            try:
                # connect to the server
                sio.connect(GAME_SERVER)
                print("Connected to the game server")
                in_game = True
            except socketio.exceptions.ConnectionError:
                print("Connection failed, retrying in 15 seconds...")
                time.sleep(15)

        
        # request a role assignment
        if char_dat is None and avatar is None:
            print("Requesting role assignment...")
            getAvatar()

        # wait for the role assignment
        while (char_dat is None or avatar is None) and in_game:
            try:
                print("Waiting for role assignment...")
                time.sleep(1)  # wait for events to be processed
            except socketio.exceptions.ConnectionError:
                print("Connection lost, retrying...")
                in_game = False
                break

        if avatar:
            act()
            

    
    