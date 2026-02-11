'''
    >>>> LMM BOT <<<<
     - USES MULTIPROCCESING FOR SEPARATED LLM GENERATION 

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
import traceback
from datetime import datetime
import os
import psutil
import traceback
import sys

import multiprocessing as mp
from queue import Empty  # for non-blocking Queue reads



# --- hard cap threadpools (must be before importing torch/transformers) ---
os.environ.setdefault("OMP_NUM_THREADS", "2")
os.environ.setdefault("MKL_NUM_THREADS", "2")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "2")
os.environ.setdefault("VECLIB_MAXIMUM_THREADS", "2")
os.environ.setdefault("NUMEXPR_NUM_THREADS", "2")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")




# GAME_SERVER = 'http://192.168.10.2:4000/' # Flynn's Arcade
# GAME_SERVER = "http://localhost:4000"   # AWS
GAME_SERVER = "http://18.188.51.215:4000/"

DEBUG = True

sio = socketio.Client()


# GLOBAL VARIABLES

variant = 1             # behavior variant (1, 2, 3)
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
MODEL_PATH = "../../llama_npctt-v1/"

llm_request_q = None
llm_response_q = None
llm_proc = None
pending_job_id = None


last_llm_start = 0.0
last_llm_end = 0.0
last_prompt_preview = ""


last_teleport = None
TELEPORT_TIMEOUT = 20

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


    torch.set_num_threads(2)
    torch.set_num_interop_threads(1)

    tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH, use_fast=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    llm_model = AutoModelForCausalLM.from_pretrained(
        MODEL_PATH,
        torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
        device_map="auto"
    )

    


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
        if isinstance(s, str):
            return {"text": s}
        return {"error": "Invalid JSON returned", "raw": s}
    
def simpleName(name):
    names = name.split(" ")
    fname, lname = names[0], names[-1]
    return fname[0].upper() + " " + lname[0].upper()

def transGameData():
    ''' Translates the current game data into LLM parsable info '''
    # this avatar's data
    me_data = {
        "name": simpleName(avatar['name']),
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
            "name": simpleName(a['name']),
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

    # if len(USER_DATA) == 0:
    #     debug_print(f"\tMe: {avatar['area']}\n\tOther locations: {[a['area'] for i, a in all_avatars.items() if i != avatar['id']]}")
    # else:
    #     debug_print("FRIEND!")

    return {
        "me": me_data,
        "others": USER_DATA
    }


def llm_worker_main(request_q, response_q):
    ''' Runs in a separate process; it loads the model then loops, processing prompts from request_q, and sending results back via response_q '''
    print("[LLM PROC] starting up, loading model...")
    importModel()
    print("[LLM PROC] model loaded")

    while True:
        job = request_q.get()
        if job is None:
            print("[LLM PROC] shutdown signal received")
            break

        job_id = job.get("id")
        prompt = job.get("prompt", "")

        try:
            output = generate_npc_response(prompt)
            response_q.put({"id": job_id, "output":output})
        except Exception as e:
            traceback.print_exc()
            response_q.put({"id": job_id, "error": str(e)})



def poll_llm_responses():
    ''' Check if the LLM worker has finished a job then parse it to a game action '''
    global pending_job_id, can_act, last_teleport

    if pending_job_id is None or llm_response_q is None:
        return

    try:
        # non-blocking check for a response
        resp = llm_response_q.get_nowait()
    except Empty:
        return

    job_id = resp.get("id")
    if job_id != pending_job_id:
        # not mine, so don't worry about it
        return

    pending_job_id = None

    if "error" in resp:
        debug_print(f"LLM worker error: {resp['error']}")
        can_act = False
        return

    output = resp.get("output", "")
    extr_out = safe_extract_json(output)
    debug_print(f"Extracted output (mp worker): {extr_out}")

    if "move" in extr_out:
        p = extr_out["move"].split(',')
        try:
            position = {'x': int(p[0]), 'y': int(p[1])}
            if in_zone(position, boundaries.get(avatar['area'])):
                sio.emit('move', {'position': position})    
        except Exception:
            debug_print("Error with moving")
    elif "teleport" in extr_out:
        if (not last_teleport or (time.perf_counter() - last_teleport) >= TELEPORT_TIMEOUT):
            sio.emit('changeArea', {'area': extr_out["teleport"], 'position': randomAreaPos(extr_out["teleport"])})
            last_teleport = time.perf_counter()

        # try again
        else:
            can_act = True
            return
    elif "emote" in extr_out:
        emo = extr_out["emote"]
        if emo in EMOTE_LIST:
            sio.emit('chat', {'text': ":emo-"+emo.split("-")[0]+":"})
    elif "text" in extr_out:
        msg = extr_out['text']
        time.sleep(min(random.random()*min(len(msg)//8,3),1))  # slight delay before talking
        sio.emit('chat', {'text':msg})
        time.sleep(random.random()*2)  # slight delay after talking
    else:
        if 'teleport' not in extr_out:
            debug_print(f"? Unknown LLM output -- {extr_out}")
        else:
            debug_print(f"Can't teleport yet: {(time.perf_counter() - last_teleport)}")


    can_act = False




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

@sio.event
def disconnect(sid):
    global in_game
    print(f"Disconnected from the game server [{sid}]")
    print("Exiting the script...")
    
    # cleanup the LLM worker process and kill everything
    if llm_proc is not None:
        llm_proc.terminate()
    if in_game:
        in_game = False
    if heart is not None:
        heart.terminate()  # terminate heartbeat process
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


act_timeout = 3
last_act_time = 0
can_act = True

@sio.event
def act():
    global avatar, all_avatars, can_act, pending_job_id

    # don't act if not available
    if not in_game or not can_act:
        can_act = False
        return

    # already waiting on a previous LLM job so don't make another
    if pending_job_id is not None:
        return

    game_input = transGameData()
    if len(game_input['others']) == 0:
        #dprint2(" (no one here) ")
        can_act = False
        return
    
 
    prompt = build_prompt(FULL_INSTRUCTIONS(avatar['classType']), game_input)
    
    # create a simple job id using the timestamp
    job_id = time.time()
    pending_job_id = job_id

    # send job to LL worker process
    if llm_request_q is not None:
        llm_request_q.put({"id": job_id, "prompt": prompt})
        debug_print("Queued LLM job")
    else:
        debug_print("LLM request queue is not initialized!")

    # act() doesn't respond yet until able
    can_act = False

    # print for the dashboard
    #print2Dash()


@sio.on('updateAvatars')
def update_avatars(data):
    # Update the local avatar data with the information from the server
    global all_avatars, avatar, can_act, last_act_time
    all_avatars = data['avatars']
    if avatar:
        avatar = data['avatars'][avatar['id']]
    elif game_id:
        avatar = data['avatars'][game_id]
    else:
        print("Warning: avatar not found in updateAvatars")
        print("Disconnecting and retrying...")
        sio.disconnect()
        return


    # act only every 3 seconds
    if time.time() - last_act_time > act_timeout:
        form_time = time.strftime('%Y-%m-%d %H:%M:%S', time.gmtime(time.time()))
        #dprint2(f".")
        # all_avatars = data['avatars']
        # avatar = data['avatars'][avatar['id']]
        last_act_time = time.time()
        can_act = True
    




# --- UPDATE LOOP FOR THE CLIENT --- #


if __name__ == '__main__': 
    # set variant based on random chance
    # lean heavily towards variant 1 but allow 1-4
    variant = random.choices([1, 2, 3], weights=[0.5, 0.25, 0.25], k=1)[0]
    print(f"=== Behavior Variant Set To: {variant} ===")


    # connect to a specific server
    if len(sys.argv) > 1:
        GAME_SERVER = sys.argv[1]
    print(f">> CONNECTING TO: {GAME_SERVER} <<")


    # start the LLM worker process
    llm_request_q = mp.Queue()
    llm_response_q = mp.Queue()
    llm_proc = mp.Process(
        target=llm_worker_main,
        args=(llm_request_q,llm_response_q),
        daemon=True
    )
    llm_proc.start()
    print("[MAIN] LLM worker process started")



    conn_tries = 0

    heart = mp.Process(target=heartbeat_loop, daemon=True)
    heart.start()
    
    while True:
        # retry connecting to the server until successful
        while not in_game:
            try:
                # connect to the server
                sio.connect(GAME_SERVER)
                print("Connected to the game server")
                in_game = True
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
            poll_llm_responses()

        # sleep to keep from using 100% CPU
        time.sleep(0.01)

            

    
    
