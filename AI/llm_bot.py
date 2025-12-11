'''
    >>>> LMM BOT <<<<

    A LMM-based bot using a finetuned TinyLlama (TinyLlama-1.1B-intermediate-step-1431k-3T)
    Parses local player actions every 3-5 seconds
    Can output actions as a JSON to be parsed by this Python script
    Variations:
        - 1 : no variation
        - 2 : chance for misspelling in dialogue lines and all lowercase
        - 3 : same as 2 + chance to not react at all
'''



import socketio
import time
import json
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM
import random
import threading
import traceback
from datetime import datetime
import os
import psutil

GAME_SERVER = 'http://localhost:4000'
DEBUG = True

sio = socketio.Client()


# GLOBAL VARIABLES

variant = 1             # behavior variant (1, 2, 3)
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
        "role": "NPP-AI-[BTree/RAND/GRAMMAR/LLM]",
        "race": "nord/elf/lizard/beastman/orc/chuck",
        "occ": "baker/butcher/blacksmith/general_goods/apothecary/
                knight_trainer/librarian/barmaid/gossip/mercenary/
                drunk/wizard/bard"
    }
'''


# ---- LLM MODEL SETUP ---- #

tokenizer = None
llm_model = None
MODEL_PATH = "../../../tiny_llama_npc/llama_npctt-v1/"


# LLM threading control
llm_lock = threading.Lock()
llm_busy = False   # prevent overlapping generations


last_llm_start = 0.0
last_llm_end = 0.0
last_prompt_preview = ""

def log_llm(msg):
    now = datetime.now().strftime("%H:%M:%S")
    tname = threading.current_thread().name
    print(f"[{now}][{tname}][LLM] {msg}", flush=True)


proc = psutil.Process(os.getpid())
def log_resources(tag: str):
    # CPU percent is "since last call", so the first call may show 0.0
    cpu = proc.cpu_percent(interval=None)
    mem = proc.memory_info().rss / (1024 * 1024) # MB
    thr = proc.num_threads()
    tname = threading.current_thread().name
    print(f"[RES][{tname}] {tag}: CPU={cpu:.1f}%  MEM={mem:.1f}MB  threads={thr}", flush=True)


# ----- OTHER GAME DETAILS ----- #


EMOTE_LIST = [
    "001-cry",
    "002-frightened",
    "003-laugh",
    "004-big-smile",
    "005-angry",
    "006-numb",
    "007-sweat",
    "008-tongue-out",
    "009-numb-1",
    "010-kissing",
    "011-heart",
    "012-star",
    "013-happy",
    "014-like",
    "015-beer",
    "016-daisy",
    "017-surprise",
    "018-gift",
    "019-bored",
    "020-money-bag",
    "021-close",
    "022-help",
    "023-chicken-leg",
    "024-axe",
    "025-star-1",
    "026-tomato",
    "027-mushroom",
    "028-sleeping",
    "029-intelligent-emoji",
    "030-chemical-free"
]

# import the instructions for each role
ROLE_INSTRUCTIONS = {}
with open("data/role_instructions.json", "r") as f:
    jdat = json.load(f)
    for role, instr in jdat.items():
        ROLE_INSTRUCTIONS[role] = {}
        ROLE_INSTRUCTIONS[role]['descr'] = instr['description']
        ROLE_INSTRUCTIONS[role]['tasks'] = [t for t in instr['tasks']]


FULL_INSTRUCTIONS = lambda npc_role: ("Pretend you are human player role-playing as an NPC character with a job in a medieval fantasy world. "
    f"Your job is a '{npc_role.upper()}' character. "
    f"These are the {npc_role.upper()} character instructions: "
    f"{ROLE_INSTRUCTIONS[npc_role]['descr']} "
    f"The {npc_role.upper()} role's tasks are: {', '.join(ROLE_INSTRUCTIONS[npc_role]['tasks'])}. "
    "You can either talk to another player or perform an action. "
    "You have the following actions available: [talk, move, emote, teleport]. "
    "If you want to talk, respond in normal text in the following form {'talk': '(your message)'}. For example, {'talk': 'Hello there!'}. "
    "You can only respond in one sentence with a maximum of 100 characters for the text. "
    "For emotes, you have the following icon choices available: [wave, dance, happy,big,laugh,intelligent,sleeping,bored,surprise,frightened,cry,angry,numb,sweat,tongue,numb,kissing,heart,star,star,like,close,help,daisy,gift,money,axe,chicken,tomato,mushroom,chemical,beer]. "
    "If you want to emote, respond in the following form {'emote': '(your emote choice)'}. For example, {'emote': 'wave'}. "
    "For movements, you can move to any (x,y) coordinate in the range of (0,0) to (800,400). "
    "If you want to move, respond in the following form {'move': '(x,y)'}. For example, {'move': '30,100'}. "
    "For teleportation, you can teleport to the following locations: ['plaza','library','blacksmith','training_ground','bakery','butcher','market','apothecary','tavern']. "
    "If you want to teleport, respond in the following form {'teleport': '(location)'}. For example, {'teleport': 'plaza'}. "
    "Only give your response in one of these four forms as a JSON format with the action chosen and the value. For example: {'talk': 'Hello there!'} or {'move': '30,100'}. "
    f"Try to stay in character as a '{npc_role.upper()}' role and respond appropriately based on your role and the context of the interaction. "
    "Respond more often with text or emotes, and only move or teleport when necessary. "
    "\n")


# ------------------------------
# Build prompt for inference
# ------------------------------
def importModel():
    global llm_model, tokenizer
    ''' Loads in the LLM llm_model for prompting '''

    tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH, use_fast=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    llm_model = AutoModelForCausalLM.from_pretrained(
        MODEL_PATH,
        torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
        device_map="auto"
    )


    torch.set_num_threads(2)
    torch.set_num_interop_threads(1)


# ------------------------------
# Build prompt for inference
# ------------------------------
def build_prompt(system_message: str, user_json: dict) -> str:
    """
    Matches the training style:
    [SYSTEM] ...text...
    [USER] ...text...
    [ASSISTANT]
    """
    return (
        "[SYSTEM]\n" + system_message + "\n\n" +
        "[USER]\n" + json.dumps(user_json, ensure_ascii=False) + "\n\n" +
        "[ASSISTANT]\n"
    )


# ------------------------------
# Generate a response
#  -> use multiprocessing to keep the connection live
# ------------------------------
def generate_npc_response(prompt: str, max_new_tokens: int = 128) -> str:
    global last_llm_start, last_llm_end

    last_llm_start = time.time()
    log_llm(f"CALL START (len(prompt)={len(prompt)})")

    enc = tokenizer(prompt, return_tensors="pt").to(llm_model.device)
    with torch.no_grad():
        out = llm_model.generate(
            **enc,
            max_new_tokens=max_new_tokens,
            do_sample=True,
            temperature=0.7,
            top_p=0.9,
            eos_token_id=tokenizer.eos_token_id,
        )

    last_llm_end = time.time()
    log_llm(f"CALL END, duration={last_llm_end - last_llm_start:.2f}s")


    text = tokenizer.decode(out[0], skip_special_tokens=True)
    return text[len(prompt):].strip()   # return ONLY the assistant completion


# ------------------------------
# Extract JSON from llm_model output
# ------------------------------
def safe_extract_json(s: str):
    """
    The llm_model *should* output only JSON, but to be safe,
    we search for the first {...} block.
    """
    try:
        start = s.index("{")
        end = s.rindex("}") + 1
        return json.loads(s[start:end])
    except Exception:
        return {"error": "Invalid JSON returned", "raw": s}

def transGameData():
    ''' Translates the current game data into LLM parsable info '''
    # this avatar's data
    me_data = {
        "name": avatar['name'],
        "pos": [avatar['position']['x'], avatar['position']['y']],
        "role": avatar['classType'],
        "loc": avatar['area']
    }
    
    # parse avatar data into code for the LLM
    USER_DATA = []

    for a in all_avatars.values():
        if a['area'] != avatar['area'] or a['id'] == avatar['id']:
            continue

        new_avatar = {
            "name": a['name'],
            "pos": [a['position']['x'], a['position']['y']]
        }

        # determine if said an emote or just regular text
        if ':emo' in a['text']:
            try:
                emo_index = int(a['text'].replace('emo-','').replace(':',''))
                new_avatar['emote'] = EMOTE_LIST[emo_index+1]
            except Exception:
                pass
        elif '/wave' == a['text'] or '/dance' == a['text']:
            new_avatar['emote'] = a['text'].replace('/','')
        else:
            new_avatar['text'] = a['text']

        # add to the overall user data
        USER_DATA.append(new_avatar)

    return {
        "me": me_data,
        "others": USER_DATA
    }


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


def debug_print(msg):
    if DEBUG:
        print(msg)

def dprint2(msg):
    if DEBUG:
        print(msg, end='', flush=True)

def print2Dash():
    d = {
        'bot_name':avatar['name'],
        'role':avatar['raceType'] + "-" + avatar['classType'],
        'location':avatar['area']
    }
    print("DASHBOARD "+json.dumps(d)+"\n",flush=True)

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

# --- SOCKET.IO EVENTS --- #

@sio.event
def connect():
    print("Connected to the game server")
    
    # start a background heartbeat so server knows we're still around
    threading.Thread(target=heartbeat_loop, daemon=True).start()

@sio.event
def disconnect(sid):
    print(f"Disconnected from the game server [{sid}]")
    print("Exiting the script...")
    exit(0)  # exit the script when disconnected


# --- ROLE ASSIGNMENTS --- #

@sio.event
def getAvatar():
    # request the server to assign an avatar
    sio.emit('assign-role', {'role': 'NPP-AI-LLM-v' + str(variant)})       # bots are always NPP


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

        # print for the dashboard
        print2Dash()

        # goto the game area (center)
        sio.emit('move', {'position': randomAreaPos(avatar['area'])})

    elif data['status'] == 'reject':
        print("Role assignment rejected, retrying...")
        in_game = False


# --- GAME EVENTS --- #


act_timeout = 3
last_act_time = 0
can_act = True


def llm_act_worker(prompt: str):
    ''' Worker function to handle LLM response generation and action emission '''
    global can_act, llm_busy

    log_llm("Worker: starting generation")
    log_resources("before generate")

    try:
        t0 = time.time()
        output = generate_npc_response(prompt)
        dt = time.time() - t0
        log_llm("Worker: generation finished")

        log_resources("after generate")
        extr_out = safe_extract_json(output)


        debug_print(f"Extracted output (llm worker act): {extr_out}")

        if "move" in extr_out:
            p = extr_out["move"].split(',')
            position = {'x': int(p[0]), 'y': int(p[1])}
            sio.emit('move', {'position': position})    
        elif "teleport" in extr_out:
            sio.emit('changeArea', {'area': extr_out["teleport"], 'position': randomAreaPos(extr_out["teleport"])})
        elif "emote" in extr_out:
            emo = extr_out["emote"]
            if emo in EMOTE_LIST:
                sio.emit('chat', {'text': extr_out["emote"]})

    except Exception as e:
        log_llm(f"Worker: EXCEPTION: {e}")
        debug_print(f"Error in llm_act_worker: {e}")
        traceback.print_exc()
    finally:
        # Allow future actions
        with llm_lock:
            llm_busy = False
        can_act = False
        log_llm("Worker: cleared llm_busy and can_act")


@sio.event
def act():
    global avatar, all_avatars, can_act, llm_busy

    # don't act if not available
    if not in_game or not can_act:
        can_act = False
        return

    game_input = transGameData()
    if len(game_input['others']) == 0:
        dprint2(" (no one here) ")
        can_act = False
        return
 
    # Only start a new LLM job if one isn't already running
    with llm_lock:
        if llm_busy:
            # inspect how long it's been busy for
            if last_llm_start > 0:
                busy_for = time.time() - last_llm_start
                log_llm(f"act(): LLM already busy for {busy_for:.1f}s, skipping")
            else:
                log_llm("act(): LLM already busy (no timestamp), skipping")
            can_act = False
            return
        llm_busy = True
        log_llm("act(): marked llm_busy=True, starting worker")

    
    prompt = build_prompt(FULL_INSTRUCTIONS(avatar['classType']), game_input)

    # Spin up worker thread so we don't block socket.io
    t = threading.Thread(target=llm_act_worker, args=(prompt,), daemon=True)
    t.start()

    # Let the main thread keep running; can_act reset happens in worker
    debug_print("Started LLM worker thread")


    

@sio.on('updateAvatars')
def update_avatars(data):
    # Update the local avatar data with the information from the server
    global all_avatars, can_act, last_act_time

    # act only every 3 seconds
    if time.time() - last_act_time > act_timeout:
        form_time = time.strftime('%Y-%m-%d %H:%M:%S', time.gmtime(time.time()))
        dprint2(f".")
        all_avatars = data['avatars']
        last_act_time = time.time()
        can_act = True
    




# --- UPDATE LOOP FOR THE CLIENT --- #


if __name__ == '__main__': 
    # set variant based on random chance
    # lean heavily towards variant 1 but allow 1-4
    variant = random.choices([1, 2, 3], weights=[0.5, 0.25, 0.25], k=1)[0]
    print(f"=== Behavior Variant Set To: {variant} ===")

    conn_tries = 0
    
    while True:
        # retry connecting to the server until successful
        while not in_game:
            try:
                # connect to the server
                sio.connect(GAME_SERVER)
                print("Connected to the game server")
                in_game = True
                importModel()  # load the llm_model after connecting
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

        # TODO: check for disconnection

            

    
    
