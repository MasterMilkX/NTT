import random
import time
import threading

# Basic generic dialogue available for all roles
generic_dialogue = [
    "Sorry, can you repeat that?",
    "I'm not sure.",
    "Can I help you?",
    "What was that?",
    "Do you need something?",
    "Good afternoon. How may I help you?",
    "Thank you for choosing our store. What can I get for you today?",
    "Are there any particular items I can help you find?",
    "I am currently engaged and will help you momentarily.",
    "Thank you for visiting!",
    "Please come back again!"
]

# Role-specific dialogue data
roles_data = {
    "Apothecary": {
        "role_keywords": {
            "fire": "Ah, searching for fire resistance? I’d recommend fire salts, bone meal, and a touch of snowberry.",
            "health": "For vitality, try vampire dust, juniper berries, and luna moth wings — just a pinch!",
            "invisibility": "Interested in something... more elusive? Our invisibility tonic lasts up to ten minutes, if brewed properly.",
            "herbs": "Looking to mend the body or cloud the mind?",
            "potion": "What ailment brings you to my shop today?",
            "last": "The duration depends on the strength of your will… and the purity of the reagents."
        },
        "ambient_lines": [
            "You’d be surprised what secrets lie within common herbs.",
            "I’m in the middle of a delicate infusion — speak quickly.",
            "The right mixture can heal… or harm. Choose wisely."
        ]
    },
    "Baker": {
        "role_keywords": {
            "bread": "Freshly baked bread coming right up!",
            "cake": "Looking for a special cake? I can make anything from chocolate to fruit-filled delights.",
            "sweet": "Try our honey-glazed pastries, they're sweet and perfect with tea.",
            "pie": "Ah, our berry pies are famous throughout the town!",
            "cookie": "Freshly baked cookies? Yes, we have those today.",
            "flour": "Quality flour is key to all my baking secrets.",
            "to go": "Would you like a loaf of bread with that?"
        },
        "ambient_lines": [
            "Would you like something sweet? I recommend the honey tarts.",
            "All our pastries are made fresh every morning.",
            "The chocolate cake is a favorite around here.",
            "Oops! I think I burnt the muffins again...",
            "My secret? A pinch of cinnamon in everything.",
            "We're running low on flour; might need to grind more soon.",
            "Careful! The oven's still hot.",
            "Need help choosing something? Just ask!"
        ]
    },
    "Barmaid": {
        "role_keywords": {
            "drink": "What'll it be? Ale, cider, or something stronger?.",
            "ale": "Our ale is brewed locally and has a rich, smooth flavor.",
            "mead": "Sweet mead, made with the finest honey, is perfect after a long day.",
            "music": "Our bard starts playing at sundown!",
            "fight": "Break it up, you two! Not in my tavern!",
            "food": "We serve hearty stews and fresh bread with every meal.",
            "more": "Another round? Coming right up!"
        },
        "ambient_lines": [
            "Looking for a room? We’ve got one available upstairs.",
            "You’d be surprised what you hear working behind the bar...",
            "Hear any good rumors lately?",
            "Keep your wits about you—sometimes taverns get rowdy.",
            "One moment, love, I’ll be right with you.",
            "No coin, no drink. That's the rule."
            
        ]
    },
    "Blacksmith": {
        "role_keywords": {
            "sword": "Looking for a new sword? I just finished forging one.",
            "armor": "Quality armor saves lives; I can forge the best in town.",
            "repair": "Bring me your broken weapons; I’ll make them as good as new.",
            "fix": "Armor needs mending? Let me take a look.",
            "hammer": "The ring of my hammer means a new weapon is born.",
            "metal": "Strong metals like steel and mithril are my specialty.",
            "shield": "A sturdy shield can block even the fiercest blow.",
            "forge": "The forge is always hot, ready for the next creation."
        },
        "ambient_lines": [
            "Careful with that sword! It’s freshly sharpened.",
            "I’ve got plenty of iron, but good steel’s harder to come by.",
            "This forge’s been in my family for generations.",
            "I can repair that — give me a few hours.",
            "Careful! That blade’s still red hot.",
            "I lost my favorite hammer again...",
            "Got a special commission? I’ll need a down payment.",
            "Blades dull with time. Always keep them sharp."
        ]
    },
    "Butcher": {
        "role_keywords": {
            "meat": "Fresh cuts of meat, perfect for your stew or roasting.",
            "beef": "Our beef is from local farms, top quality guaranteed.",
            "pork": "Looking for pork? We have the best cuts around.",
            "sausage": "Homemade sausages, seasoned just right.",
            "fresh": "Only the freshest meat makes it to my counter.",
            "order": "Let me know if you want a special cut or quantity.",
            "bone": "Bones are great for broth and soups."
        },
        "ambient_lines": [
            "Fresh meat! Just butchered this morning.",
            "Try the spiced sausages — they’re my specialty.",
            "The smell of blood doesn’t bother me anymore.",
            "Never work without your cleaver. Rule number one.",
            "New deer in today, caught it myself.",
            "I keep the good stuff in the cold cellar.",
            "Perfect roast starts with the right cut."
        ]
    },
    "General Goods Shopkeeper": {
        "role_keywords": {
            "item": "I have all sorts of items — from ropes to lanterns.",
            "price": "If you’re curious about the price, just look.",
            "tool": "Need tools? I’ve got hammers, nails, and more.",
            "supplies": "Stocked up on supplies for travelers and townsfolk alike.",
            "sale": "There’s a special sale today, don’t miss out!",
            "trade": "I’m always open to trades, if you have something interesting.",
            "stock": "My stock changes frequently, so come back often.",
            "return": "Yes, you can return that if it’s unused.",
            "potion": "We don’t sell potions — try the apothecary."
        },
        "ambient_lines": [
            "Need anything? Just let me know.",
            "I keep the shelves well stocked and ready.",
            "New stock just came in from the capital.",
            "Some items are on sale — take a look.",
            "Buying in bulk? I’ll give you a discount.",
            "Looking for something special?"
        ]
    },
    "Knight Trainer": {
        "role_keywords": {
            "training": "Training makes perfect — practice your sword swings daily.",
            "fight": "A good fighter knows when to strike and when to defend.",
            "armor": "Make sure your armor fits well before battle.",
            "strategy": "Tactics win wars more than brute strength.",
            "sword": "Master your swordsmanship to become a true knight.",
            "discipline": "Discipline and honor go hand in hand.",
            "challenge": "Care for a sparring match? Let’s test your skills.",
            "duel": "You want a duel? Prove you're worthy."
        },
        "ambient_lines": [
            "Focus on your stance, it’s the foundation of all combat.",
            "Every knight was once a beginner — keep practicing.",
            "Discipline and repetition — that’s the key.",
            "Hold your sword with both hands. Tight, but not stiff.",
            "You can’t fight if you can’t move — find armor that fits.",
            "Shield up! Always keep your guard!",
            "Training reflexes takes time. Start with drills.",
            "A knight’s strength is his honor, not his sword.",
            "Your stance is sloppy. Start over.",
            "Earn your rank. Don’t ask for it."
        ]
    },
    "Librarian": {
        "role_keywords": {
            "book": "I can help you find any book you seek.",
            "history": "Our history section is down the hall to the left.",
            "magic": "Books on magic are restricted — special permission required.",
            "story": "Would you like to hear a tale from our collection?",
            "knowledge": "Knowledge is the greatest treasure one can have.",
            "research": "If you have questions, I can assist with research.",
            "scroll": "Ancient scrolls are kept in the restricted section."
        },
        "ambient_lines": [
            "This is a house of learning, be quiet.",
            "Have you returned your books on time?",
            "Ancient scrolls must be handled with gloves.",
            "No loud talking, please.",
            "Use the catalog to search by title or author.",
            "We offer copying services for a small fee.",
            "That book is rare — please don’t damage it."
        ]
    }
}

# Time interval for ambient dialogue (in seconds)
AMBIENT_INTERVAL = 60

# Flag to control the ambient dialogue thread
running = True

def ambient_speech(role):
    while running:
        time.sleep(AMBIENT_INTERVAL)
        role_data = roles_data.get(role, None)
        if role_data:
            # Combine role ambient lines with generic dialogue
            lines_pool = role_data["ambient_lines"] + generic_dialogue
            line = random.choice(lines_pool)
            print(f"{role} says: \"{line}\"")

def get_response(role, user_input):
    user_input_lower = user_input.lower()
    role_data = roles_data.get(role, None)
    
    if role_data:
        for keyword, response in role_data["role_keywords"].items():
            if keyword in user_input_lower:
                return response
    # fallback to generic dialogue randomly
    return random.choice(generic_dialogue)

def main():
    global running
    # You can adjust this to the assigned role
    role = input("Choose an NPC role (Apothecary, Baker, Barmaid, Blacksmith, Butcher, General Goods Shopkeeper, Knight Trainer, Librarian): ")
    if role not in roles_data:
        print("Role not found.")
        role = None

    # Start the ambient speech in a separate thread
    thread = threading.Thread(target=ambient_speech, args=(role,), daemon=True)
    thread.start()

    while True:
        user_input = input("> ")
        if user_input.lower() == "goodbye":
            running = False
            print(f"Goodbye! Have a lovely day.")
            break

        response = get_response(role, user_input)
        print(f"{role} says: \"{response}\"")

if __name__ == "__main__":
    main()
