'''
    >>>> RANDOM BOT <<<<

    A simple random bot that connects to the game server,
    requests a role assignment, and then moves and chats randomly.

    Variations:
        - 1 : chat, emote, move
        - 2 : chat only
        - 3 : move only
        - 4 : emote only

'''



import socketio
import time
import json
import random
import sys
import multiprocessing as mp


# GAME_SERVER = 'http://192.168.10.2:4000/' # Flynn's Arcade
GAME_SERVER = "http://localhost:4000"   # AWS

sio = socketio.Client()


# GLOBAL VARIABLES

variant = 1             # behavior variant (1, 2, 3. 4)
in_game = False
char_dat = None
avatar = None
game_id = None
all_avatars = {}
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

# ---- AREA BOUNDARY DEFINITIONS ---- #


FULL_AREA_WIDTH = 800
FULL_AREA_HEIGHT = 450

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
    global in_game
    print("Disconnected from the game server")
    print("Exiting the script...")

    # cleanup and exit
    if in_game:
        in_game = False
    if heart is not None:
        heart.terminate()  # terminate heartbeat process
    exit(0)  # exit the script when disconnected


heart = None  # global variable for the heartbeat process

@sio.event
def heartbeat_loop():
    """Send a lightweight event every 10 seconds so the server sees us as alive."""
    while True:
        try:
            # Use an event name your server either handles or harmlessly ignores
            sio.emit('bot_heartbeat', {'ts': time.time()})
        except Exception as e:
            print(f"heartbeat error: {e}")
            # if we're disconnected, just break; main loop will reconnect
            break
        time.sleep(10)


# --- ROLE ASSIGNMENTS --- #

@sio.event
def getAvatar():
    # request the server to assign an avatar
    sio.emit('assign-role', {'role': 'NPP-AI-RAND-v' + str(variant)})       # bots are always NPP


@sio.on('role-assigned')
def role_assigned(data):
    global char_dat
    char_dat = data
    print(f"Role assigned: {char_dat}")

    # then ask for the avatar
    sio.emit('join')

@sio.on('message')
def avatar_assigned(data):
    global avatar, base_area, in_game, game_id
    if data['status'] == 'accept':
        avatar = data['avatar']
        game_id = data['avatar']['id']
        print("=== Avatar Successfully Assigned ===")
        print(f"Avatar assigned: {avatar}")
        print(f"BASE AREA: {char_dat.get('area', 'plaza')}")
        print("====================================")

        

        base_area = char_dat.get('area', 'plaza')

        # print for the dashboard
        print2Dash()

        # goto the game area (center)
        sio.emit('move', {'position': randomAreaPos(avatar['area'])})

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

    if variant == 1:            # all random
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
            sio.emit('animate', {'cur_anim': 'idle', 'frame': 0})
            new_pos = randomAreaPos(avatar['area'])
            sio.emit('move', {'position': new_pos})
            time.sleep(random.randint(1, 5))  # wait for a random time before acting again
        elif p < 0.9:
            # move near another avatar
            sio.emit('animate', {'cur_anim': 'idle', 'frame': 0})
            if all_avatars:
                target_avatar = random.choice(list(all_avatars.values()))
                if target_avatar['id'] != avatar['id']:
                    sio.emit('moveToPlayer', {'targetId': target_avatar['id']})
            time.sleep(random.randint(1, 5))  # wait for a random time before acting again

        else:
            # change location to a different area
            sio.emit('animate', {'cur_anim': 'idle', 'frame': 0})
            new_area = random.choice(list(boundaries.keys()))
            avatar['area'] = new_area
            sio.emit('changeArea', {'area': new_area, 'position': randomAreaPos(new_area)})

            # print for the dashboard
            print2Dash()

    elif variant == 2:          # chat only
        sio.emit('chat', {'text':random.choice(dialogue_lines)})
        time.sleep(random.randint(5, 15))  # wait for a random time before acting again

    elif variant == 3:          # move only
        p = random.random()
        if p < 0.5:
            # move to a random position in the area
            sio.emit('animate', {'cur_anim': 'idle', 'frame': 0})
            new_pos = randomAreaPos(avatar['area'])
            sio.emit('move', {'position': new_pos})
            time.sleep(random.randint(1, 10))  # wait for a random time before acting again
        elif p < 0.75:
            # move near another avatar
            sio.emit('animate', {'cur_anim': 'idle', 'frame': 0})
            if all_avatars:
                target_avatar = random.choice(list(all_avatars.values()))
                if target_avatar['id'] != avatar['id']:
                    sio.emit('moveToPlayer', {'targetId': target_avatar['id']})
            time.sleep(random.randint(1, 10))  # wait for a random time before acting again

        else:
            # change location to a different area
            sio.emit('animate', {'cur_anim': 'idle', 'frame': 0})
            new_area = random.choice(list(boundaries.keys()))
            avatar['area'] = new_area
            sio.emit('changeArea', {'area': new_area, 'position': randomAreaPos(new_area)})

            # print for the dashboard
            print2Dash()
            
            time.sleep(random.randint(3, 7))  # wait for a random time before acting again

    elif variant == 4:          # emote only
        p = random.random()
        if p < 0.2:
            # idle
            time.sleep(random.randint(3, 10))
        elif p < 0.5:
            # wave or dance
            sio.emit('animate', {'cur_anim': 'wave' if random.random() < 0.5 else 'dance', 'frame': 0})
            time.sleep(random.randint(3, 10))  # wait for a random time before acting again
        else:
            # emote
            sio.emit('chat', {'text': f':emo-{random.randint(0, 29):02}:'})
            time.sleep(random.randint(3, 10))  # wait for a random time before acting again
    


@sio.on('updateAvatars')
def update_avatars(data):
    # Update the local avatar data with the information from the server
    global all_avatars, avatar, in_game
    all_avatars = data['avatars']
    if avatar:
        avatar = data['avatars'][avatar['id']]
    elif game_id:
        avatar = data['avatars'][game_id]
    elif in_game:
        print("Warning: avatar not found in updateAvatars")
        print("Disconnecting and retrying...")
        sio.disconnect()
        return





# --- UPDATE LOOP FOR THE CLIENT --- #


if __name__ == '__main__': 
    # set variant based on random chance
    # lean heavily towards variant 1 but allow 1-4
    variant = random.choices([1, 2, 3, 4], weights=[0.5, 0.2, 0.15, 0.15], k=1)[0]
    print(f"=== Behavior Variant Set To: {variant} ===")


    # connect to a specific server
    if len(sys.argv) > 1:
        GAME_SERVER = sys.argv[1]
    print(f">> CONNECTING TO: {GAME_SERVER} <<")


    conn_tries = 0
    
    while True:
        # retry connecting to the server until successful
        while not in_game:
            try:
                # connect to the server
                sio.connect(GAME_SERVER)
                print("Connected to the game server")
                in_game = True

                # start the heartbeat process
                if heart:
                    heart.terminate()  # terminate existing heartbeat if it exists
                heart = mp.Process(target=heartbeat_loop, daemon=True)
                heart.start()
            except socketio.exceptions.ConnectionError:
                conn_tries += 1
                if conn_tries > 3:
                    print("Failed to connect after 3 attempts, exiting...")
                    exit(1)
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

        if avatar and in_game:
            act()
            

    
    
