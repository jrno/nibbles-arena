# Nibbles arena

Simple worm game implemented in 2012 with a purpose to investigate the browser support for various HTML 5 features. __2D drawing canvas__, __localstorage__  etc. apis weren't that widely supported back then. 

Files were moved from dropbox to git in 2017 for safekeeping.

## Game logic

Starting up the server creates the arena and resets all scores. Server is stateless

Player can join the arena by loading the client. After worm color etc. preference selections player can specate then ongoing fight, or join the arena. Events of the arena are broadcasted to all the players.

Worm can be controlled using the keyboard arrow keys. Player grows the worm in length by collecting green apples from the board. With bigger worm it's easier to kill opponents. Worm can kill other worm by

- Having more length than the opponent and colliding head first
- Having opponent collide head first to worms body

## Contents 

There's three main files

```
arena.server.js // game look and websocket handlers
arena.client.js // client to render the game board and worm movements and to capture user inputs
arena.common.js // shared
``` 

## Dependencies

- Node version should be <= 5, newer versions won't work. Server was implemented before node was in version 1.0...
- Some legacy version of socket.io to handle the websocket connections and long polling fallback

## How to run it

```
npm install
node arena.server.js 
```

Open http://localhost:9090/arena.html and start playing

## Author / Contact

2012 / Jarno Pohjonen
jarno.pohjonen@gmail.com

