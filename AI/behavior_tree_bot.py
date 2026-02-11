'''
    >>>> BEHAVIOR TREE BOT <<<<

    A generic behavior tree bot based on traditional RPG NPC behaviors.
    Based on its role and any keywords detected, it will respond accordingly with an exact line.
    If no keyword is detected, it will go to a random player and say an ambient line.
    If an emote is detected, it will respond with an appropriate emote to match it.

    Variations:
        - 1 : no variation
        - 2 : chance for misspelling in dialogue lines and all lowercase
        - 3 : same as 2 + chance to not respond at all or choose random line

'''


import socketio
import time
import json
import random
import sys
import typo
import multiprocessing as mp

sio = socketio.Client()



# GLOBAL VARIABLES

DEBUG = False
in_game = False
char_dat = None
avatar = None
game_id = None
all_avatars = {}        # socket id: avatar data
'''
    Avatar Data (useful fields only):
    {
        "id": "???",
        "name": "???",
        "area": "plaza/tavern/market/blacksmith/apothecary/library/training_ground/butcher/bakery",
        "position": {"x": 000, "y": 000},
        "roletype": "NPP-AI-[BTree/RAND]",
        "raceType": "nord/elf/lizard/beastman/orc/chuck",
        "classType": "baker/butcher/blacksmith/general_goods/apothecary/
                knight_trainer/librarian/barmaid/gossip/mercenary/
                drunk/wizard/bard",
        "text": "???",
    }
'''

# GAME_SERVER = 'http://192.168.10.2:4000/' # Flynn's Arcade
GAME_SERVER = "http://localhost:4000"   # AWS


last_text = {}   # socket id: last text received within last update check
variant = 1      # behavior variant (1, 2, 3)
last_text_check = time.time()
text_rate = 1
convo_char = None   # current avatar id in conversation with
last_convo_char_msg = ""    # last message said by the current conversing avatar
base_area = 'plaza'   # area to return to when changing area

# ---- AREA BOUNDARY DEFINITIONS ---- #


FULL_AREA_WIDTH = 800
FULL_AREA_HEIGHT = 450

boundaries = {}
with open('../online-game/static/data/area_boundaries.json', 'r') as f:
    boundaries = json.load(f)


# get the role dialogue data
role_dialog = {}
with open('data/dialogue_split.json', 'r') as f:
    role_dialog = json.load(f)


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
def disconnect(*args):
    global in_game
    print("**Disconnected from the game server**")
    print(f"   [REASON] args={args}", flush=True)
    print("Exiting the script...")

    # cleanup and exit
    if in_game:
        in_game = False
    if heart is not None:
        heart.terminate()  # terminate heartbeat process
    raise SystemExit(0)


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
    sio.emit('assign-role', 'NPP-AI-BTree-v' + str(variant))       # bots are always NPP


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

def apply_typo(r):
    rt = typo.StrErrer(r)
    ra = random.random()
    if ra < 0.1:
        return r
    elif ra < 0.25:
        return rt.char_swap().result
    elif ra < 0.55:
        return rt.missing_char().result
    elif ra < 0.85:
        return rt.nearby_char().result
    else:
        return rt.extra_char().result

def modify_response(response):
    # apply variant modifications
    if variant >= 2:
        # chance to misspell or change case
        if random.random() < 0.7:
            response = response.lower() if type(response) == str else [r.lower() for r in response]

        # chance to have typo
        if random.random() < 0.4 and type(response) == str:
            response = apply_typo(response)
        # introduce a random typo
        if type(response) == list:
            response = list(map(apply_typo, response))

    if variant == 3:
        # chance to not respond or choose a random line
        p = random.random()
        if p < 0.3:
            return None # do not respond
        
    return response

@sio.event
def act():
    # don't act if not available
    if not in_game:
        return
    
    global convo_char, last_convo_char_msg

    role_words = role_dialog[avatar['classType']].get('role_keywords', {})
    emote_reacts = role_dialog[avatar['classType']].get('emote_reacts', {})

    # if no keywords defined for the role, just do a random action
    if not role_words and not emote_reacts:
        random_act()
        return

    # maintain a list of valid targets to respond to (id: response)
    valid_targets = []

    for id, text in last_text.items():
        if id == avatar['id']:
            continue  # skip self

        # if the text has a keyword, move to the avatar and respond accordingly
        for keyword, response in role_words.items():
            if keyword.lower() in text.lower():
                # add to the possible targets
                if text != last_convo_char_msg and id != convo_char:  # only respond if new message
                    valid_targets.append((id, response))

            
        # check for emotes
        for emote, response in emote_reacts.items():
            if emote == text:
                valid_targets.append((id, response))

        
    # randomize the valid targets and pick one to respond to
    if valid_targets:
        debug_print(f"Valid targets found: {valid_targets}")
        if convo_char and convo_char in [t[0] for t in valid_targets]:
            # prioritize continuing conversation with current convo_char
            valid_targets = [t for t in valid_targets if t[0] == convo_char]
        else:
            # otherwise pick a random target
            random.shuffle(valid_targets)

        id, response = valid_targets[0]

        # move to the avatar
        sio.emit('moveToPlayer', {'targetId': id})
        convo_char = id  # set current conversation character
        last_convo_char_msg = last_text.get(id, "")
        time.sleep(0.5)
        
        # respond with the appropriate response
        response = modify_response(response)

        # no reply -- do nothing
        if not response:
            time.sleep(random.randint(1,3))
            return

        # list response
        if type(response) == list:
            for r in response:
                sio.emit('chat', {'text':r})
                lr = (len(r)//5)+1
                time.sleep(random.randint(int(lr*1.5), int(lr*3.5)))

        # single string response
        else:
            sio.emit('chat', {'text': response})
            lr = (len(response)//5)+1
            time.sleep(random.randint(int(lr*1.5), int(lr*3.5)))
        return
    else:
        # if no keywords detected or valid targets, do a random action
        random_act()

    
def random_act():
    global avatar

    ''' Perform a random action '''
    if not in_game:
        return

    convo_char = None

    sio.emit('animate', {'cur_anim': 'idle', 'frame': 0})       # reset emote

    p = random.random()
    if p < 0.4:
        # say an ambient line (70% chance) or do an emote (30% chance)
        if random.random() < 0.3:
            if random.random() < 0.5:
                # wave or dance
                sio.emit('animate', {'cur_anim': 'wave' if random.random() < 0.5 else 'dance', 'frame': 0})
            else:
                # emote
                sio.emit('chat', {'text': f':emo-{random.randint(0, 29):02}:'})
            time.sleep(random.randint(5, 10))
        else:
            # ambient line
            ambient_lines = role_dialog[avatar['classType']].get('ambient_lines', role_dialog['all_ambient_lines'])
            if ambient_lines:
                line = random.choice(ambient_lines)
                debug_print("Random action: ambient line - " + line)
                sio.emit('chat', {'text': line})
                time.sleep(random.randint(5, 15))
        return
    elif p < 0.6:
        # move to a random position in the area
        new_pos = randomAreaPos(avatar['area'])
        debug_print(f"Random action: move to random position {new_pos}")
        sio.emit('move', {'position': new_pos})
        time.sleep(random.randint(1, 5))
        return
    elif p < 0.85:
        debug_print("Random action: move to another avatar")
        # move near another avatar
        if all_avatars:
            target_avatar = random.choice(list(all_avatars.values()))
            if target_avatar['id'] != avatar['id']:
                debug_print(f"Random action: move to another avatar - {target_avatar['id']}")
                sio.emit('moveToPlayer', {'targetId': target_avatar['id']})
        time.sleep(random.randint(1, 5))
        return
    else:
        # change location to a different area (go to random if in base area, otherwise go to base area)
        if avatar['area'] == base_area:
            new_area = random.choice(list(boundaries.keys()))
            debug_print(f"Random action: change area to {new_area}")
            avatar['area'] = new_area
            sio.emit('changeArea', {'area': new_area, 'position': randomAreaPos(new_area)})
        else:
            debug_print(f"Random action: return to base area {base_area}")
            avatar['area'] = base_area
            sio.emit('changeArea', {'area': base_area, 'position': randomAreaPos(base_area)})

        # print for the dashboard
        print2Dash()


@sio.on('updateAvatars')
def update_avatars(data):
    # Update the local avatar data with the information from the server
    global all_avatars, last_text, last_text_check, convo_char, last_convo_char_msg, avatar
    all_avatars = data['avatars']
    if avatar:
        avatar = data['avatars'][avatar['id']]
    elif game_id:
        avatar = data['avatars'][game_id]
    else:
        print("Warning: avatar not found in updateAvatars")
        print("Waiting...")
        return



    # Check for new messages from other avatars every x seconds
    if time.time() - last_text_check > text_rate:
        last_text_check = time.time()
        for avatar_id, avatar_data in all_avatars.items():
            if avatar_id == avatar['id']:
                continue  # skip self

            if avatar_data['area'] != avatar['area']:
                # remove last text if avatar is in a different area
                if avatar_id in last_text:
                    del last_text[avatar_id]
                continue

            
            # if the last convo character has moved away or kept the same text, reset convo_char
            if convo_char and convo_char == avatar_id:
                if avatar_data['text'] == last_convo_char_msg or avatar_data['area'] != avatar['area']:
                    convo_char = None
                    last_convo_char_msg = ""

            # if new text received, update last_text
            if avatar_data['text'] != last_text.get(avatar_id) and avatar_data['text']:
                last_text[avatar_id] = avatar_data['text']

                debug_print(f"New text from {avatar_data['name']} ({avatar_id}): {avatar_data['text']}")

        if last_text:
            debug_print(f"TEXT: {last_text}")





# --- UPDATE LOOP FOR THE CLIENT --- #


if __name__ == '__main__': 
    # set variant based on random chance
    variant = 1 + min(2, max(0, int(random.gauss(1.5, 0.75))))
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
                sio.connect(GAME_SERVER, transports=["websocket"], wait_timeout=30)
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

        if avatar:
            act()
            

    
    