# outputs a list of emojis from a text file in the order they appear
# as a new image html object

with open("emoji.txt", "r") as file:
    lines = file.readlines()
    emoji_list = [line.strip() for line in lines if line.strip()]

for i, emoji in enumerate(emoji_list, start=1):
    print(f'<img id="emo-{i:02}" src="./static/assets/emoticons/{emoji}" style="display:none;">')