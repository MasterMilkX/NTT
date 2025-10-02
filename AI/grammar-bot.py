'''
    >>>> GRAMMAR BOT <<<<

    A bot that behaves based on a grammar structure of actions.

'''



import socketio
import time
import json
import random

GAME_SERVER = 'http://localhost:4000'

sio = socketio.Client()


# GLOBAL VARIABLES

DEBUG = True
in_game = False
char_dat = None
avatar = None
all_avatars = {}
'''
    Avatar Data:
    {
        "id": "???",
        "name": "???",
        "area": "plaza/tavern/market/blacksmith/apothecary/library/training_ground/butcher/bakery",
        "position": {"x": 000, "y": 000},
        "role": "NPP-AI-[BTree/RAND]",
        "race": "nord/elf/lizard/beastman/orc/chuck",
        "occ": "baker/butcher/blacksmith/general_goods/apothecary/
                knight_trainer/librarian/barmaid/gossip/mercenary/
                drunk/wizard/bard"
    }
'''

# ---- AREA BOUNDARY DEFINITIONS ---- #


FULL_AREA_WIDTH = 800
FULL_AREA_HEIGHT = 450

base_area = 'plaza'   # area to return to when changing area


boundaries = {}
with open('../online-game/static/data/area_boundaries.json', 'r') as f:
    boundaries = json.load(f)

def randomPos():
    ''' Generate a random position within the boundaries '''
    x = random.randint(0, FULL_AREA_WIDTH)
    y = random.randint(0, FULL_AREA_HEIGHT)
    return {'x': x, 'y': y}

def in_zone(pos, boundary):
    ''' Check if a position is inside a polygon defined by the boundary points.'''
    x, y = pos['x'], pos['y']
    inside = False

    for i in range(len(boundary)):
        j = (i - 1) % len(boundary)
        xi, yi = boundary[i]['x'], boundary[i]['y']
        xj, yj = boundary[j]['x'], boundary[j]['y']

        intersect = ((yi > y) != (yj > y)) and \
                    (x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi)

        if intersect:
            inside = not inside

    return inside


def randomAreaPos(area):
    ''' Return a random position within the area boundaries'''
    points = boundaries.get(area)
    if not points:
        return randomPos()

    xs = [p['x'] for p in points]
    ys = [p['y'] for p in points]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)

    for _ in range(100):
        x = random.uniform(min_x, max_x)
        y = random.uniform(min_y, max_y)

        if in_zone({'x': x, 'y': y}, points):
            return {'x': x, 'y': y}

    return randomPos()


def debug_print(msg):
    if DEBUG:
        print(msg)


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
    sio.emit('assign-role', 'NPP-RAND')       # bots are always NPP


@sio.on('role-assigned')
def role_assigned(data):
    global char_dat
    char_dat = data
    print(f"Role assigned: {char_dat}")

    # then ask for the avatar
    sio.emit('join')

@sio.on('message')
def avatar_assigned(data):
    global avatar
    if data['status'] == 'accept':
        avatar = data['avatar']
        print(f"Avatar assigned: {avatar}")

        # goto the game area (center)
        sio.emit('move', {'position': randomAreaPos(avatar['area'])})

    elif data['status'] == 'reject':
        print("Role assignment rejected, retrying...")
        in_game = False


# --- GAME EVENTS --- #

@sio.event
def act():
    # don't act if not available
    if not in_game:
        return

    # test function to show chat
    dialogue_lines = [
        "Sorry, can you repeat that?",
        "I'm not sure.",
        "Hello!",
        "Nice to meet you!",
        "Can I help you?",
        "What was that?",
        "Excuse me...",
        "You see...",
        "Well...",
        "Do you need something?",
        "Haven't seen you around here before.",
        "Are you new to town?",
        "Glad to make your acquaintance.",
        "Hey!",
        "Isn't this town beautiful?",
        "The weather is just divine.",
        "Lovely to chat with you!",
        "Good afternoon. How may I help you?",
        "Thank you for choosing our store. What can I get for you today?",
        "How much would you like?",
        "How many would you like?",
        "I'm sorry, we've run out of that, may I help you choose something different?",
        "Are there any particular items I can help you find?",
        "I am currently engaged and will help you momentarily.",
        "Thank you for visiting!",
        "Please come back again!",
        'pog',
        'lol',
        '...',
        'yo!',
        'lmao',
        'hi!'
    ]
    p = random.random()
    if p < 0.05:
        # idle
        time.sleep(random.randint(5, 10))
    elif p < 0.15:
        # wave or dance
        sio.emit('animate', {'cur_anim': 'wave' if random.random() < 0.5 else 'dance', 'frame': 0})
        time.sleep(random.randint(5, 10))  # wait for a random time before acting again
    elif p < 0.3:
        # emote
        sio.emit('chat', {'text': f':emo-{random.randint(0, 29):02}:'})
        time.sleep(random.randint(5, 10))  # wait for a random time before acting again
    elif p < 0.5:
        # chat
        sio.emit('chat', {'text':random.choice(dialogue_lines)})
        time.sleep(random.randint(5, 15))  # wait for a random time before acting again
    elif p < 0.75:
        # move to a random position in the area
        new_pos = randomAreaPos(avatar['area'])
        sio.emit('move', {'position': new_pos})
        time.sleep(random.randint(1, 5))  # wait for a random time before acting again
    elif p < 0.9:
        # move near another avatar
        if all_avatars:
            target_avatar = random.choice(list(all_avatars.values()))
            if target_avatar['id'] != avatar['id']:
                sio.emit('moveToPlayer', {'targetId': target_avatar['id']})
        time.sleep(random.randint(1, 5))  # wait for a random time before acting again

    else:
        # change location to a different area
        new_area = random.choice(list(boundaries.keys()))
        sio.emit('changeArea', {'area': new_area, 'position': randomAreaPos(new_area)})

    


@sio.on('updateAvatars')
def update_avatars(data):
    # Update the local avatar data with the information from the server
    global all_avatars
    all_avatars = data['avatars']






# --- UPDATE LOOP FOR THE CLIENT --- #


if __name__ == '__main__': 
    while True:
        # retry connecting to the server until successful
        while not in_game:
            try:
                # connect to the server
                sio.connect(GAME_SERVER)
                print("Connected to the game server")
                in_game = True
            except socketio.exceptions.ConnectionError:
                print("Connection failed, retrying in 5 seconds...")
                time.sleep(5)

        
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
            

    
    