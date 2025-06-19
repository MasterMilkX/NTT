"""
Description: NPC AI who speaks idle dialogue globally every 60 seconds.
"""

import random
import time

####### GLOBAL VARIABLES #######

BOT_NAME = "Chuck Bartowski"   # This will be changed based on NPC generation in game
TALK_INTERVAL = 5             # Seconds between lines (use smaller number like 5 for testing)

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
    "Please come back again!"
]

####### MAIN LOOP #######

print(f"{BOT_NAME} has entered the world and is ready to speak.")

while True:
    random_line = random.choice(dialogue_lines)
    print(f"{BOT_NAME} says: \"{random_line}\"")
    time.sleep(TALK_INTERVAL)
