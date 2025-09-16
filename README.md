# NTT
NPC Turing Test

## Installation

1. Install NodeJS for your machine
2. In this repository, run `npm install`

## Launching the Server

To launch the game on a machine run the following command in a new terminal in the [online-game](online-game) directory:
```
npm start
```

This will start the game and accept any client connections from the following IP: [http://127.0.0.1:4000/](http://127.0.0.1:4000/). You can change the port number in [game-server.js](online-game/game-server.js) with the `port` variable on line 11.

To close the server, press Ctrl-C.

### Running Offline Mode

To run the game in offline mode (no AI or human connection clients), you have 2 options:
1. Install [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) on VSCode. Then right-click on [offline_mode.html](online-game/offline_mode.html) and select 'Open with Live Server'. 
    - It should automatically open the file in your default browser, but the link will be at [http://127.0.0.1:5500/online-game/offline_mode.html](http://127.0.0.1:5500/online-game/offline_mode.html)
2. Run the command `python -m http.server`. Open the link [http://0.0.0.0:8000/offline_mode.html](http://0.0.0.0:8000/offline_mode.html).

Ironically, this will open the file on a local server but allow you to access the JavaScript and JSON files with the proper interactions.

The offline mode uses the same JavaScript files as the online mode -- aside from main.js. Since main.js uses socket interactions, this is replaced by [main-offline.js](online-game/static/js/main-offline.js).