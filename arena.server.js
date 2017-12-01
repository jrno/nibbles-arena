/** 
 * HTML 5 Nibbles Arena server 
 * 
 * (c) Jarno Pohjonen 2012/2013
 *
 * @module arena.server
 */

/* Required modules */
var application = require('http').createServer(handler),
    io = require('socket.io').listen(application),
    fs = require('fs'),
    path = require('path'),
    url = require('url'),
    ARENA = require('./arena.common');

// start accepting incoming http requests
application.listen(ARENA.PORT);

// set socket.io logging level
io.set('log level', 1);

/* Simple handling of HTTP requests */
function handler(req,res) {

    var uri = url.parse(req.url).pathname,
        filename = path.join(process.cwd(), uri);

    // return 404 if resource not found
    fs.exists(filename, function(exists) {
        if(!exists) {
            res.writeHead('404', {
                'Content-Type': 'text/plain'
            });
            res.write('404 Not Found\n');
            res.end();
            return;
        }

        var mimeType = ARENA.MIMETYPES[path.extname(filename).split(".")[1]];

        // serve the requested file
        fs.readFile(filename,
            function (err, data) {
                if(err) {
                    res.writeHead('500');
                    return res.end('Error loading arena.html');
                }

                res.writeHead('200', {
                    'Content-Type': mimeType
                });
                
                res.end(data);
            });
    });
}

/**
 * Model for single player with helper functions and properties 
 * @class Player
 * */

function Player(username, worm_color, socketId) {

    // player general information
    this.username = username;
    this.socketId = socketId;
    this.state = ARENA.STATE.SPECTATOR;

    // player statistics
    // this.apples = 0;
    this.kills = 0;
    this.score = 0;
    this.deaths = 0;
    this.suicides = 0;
    this.score_session_start = 0;
    this.kills_session_start = 0;
    
    // this.tscore = 0;
    // this.tkills = 0;
    // this.tapples = 0;

    // worm
    this.worm_direction = ARENA.RIGHT;
    this.worm_xy = {};
    this.worm_color = worm_color;
    this.growing = false;

    // latency 
    this.ping_start = new Date();
    this.latency_ms = 0; 
}

/** 
 * Create a new worm for player and reset player state  
 * @method reset
 */
Player.prototype.reset = function() {

    this.worm_direction = ARENA.RIGHT;
    this.worm_xy = createWorm();
    this.growing = false;
    this.score_session_start = this.score;
    this.kills_session_start = this.kills;
    this.state = ARENA.STATE.SPECTATOR;
};

/** 
 * Kills another player. 
 * @method kill
 * @param other - Other Player -object
 */
Player.prototype.kill = function(other) {
 
    this.kills++;
    this.score  = this.score + (2 * other.worm_xy.length);

    other.deaths++;
    other.state = ARENA.STATE.GAME_OVER;
    other.score = (ARENA.SCORE_LOSS_PER_DEATH > other.score) ? 0 : (other.score - ARENA.SCORE_LOSS_PER_DEATH);

    publish("Buujaa! The bulky frame of " + this.username + " DESTROYS " + other.username);
};

/** 
 * Messages and logic related to player colliding with own worm.
 * @method suicide
 */
Player.prototype.suicide = function() {

    this.suicides++;
    this.state = ARENA.STATE.GAME_OVER;
    this.score = (ARENA.SCORE_LOSS_PER_SUICIDE > this.score) ? 0 : (this.score - ARENA.SCORE_LOSS_PER_SUICIDE);

    publish("Shame, " + this.username + " is suicidal");
};

/** 
 * Eat an apple 
 * @method eat
 */ 
Player.prototype.eat = function() {
    
    var base = this;
    this.growing = true;
    this.score  = this.score + ARENA.SCORE_PER_APPLE;

    setTimeout(function() {
        base.growing = false;
    }, ARENA.WORM_GROWTH_TIME_MS);
    
    publish(this.username + " obtains an apple!");
};

/** 
 * Returns true if player has a worm in given x,y
 * @method occupies 
 */ 
Player.prototype.occupies = function(x,y) {
    return (this.worm_xy.index(x,y) != -1);
};

/** 
 * Returns the player worms head coodinates in format {x:<x>, y:<y>}
 * @method getHead 
 */
Player.prototype.getHead = function() {
    return this.worm_xy[this.worm_xy.length-1];
};

/** 
 * Returns a copy of the players worm x,y -array without head.
 * @method getBody 
 */
Player.prototype.getBody = function() {
    return this.worm_xy.slice(0, this.worm_xy.length-1);
};

/** 
 * Add a new head to players worm
 * @method setHead 
 */
Player.prototype.setHead = function(x, y) {
    this.worm_xy.push({
        x: x, 
        y: y
    });
};

/** 
 * Send game over event to player
 * @method gameOver 
 */
Player.prototype.gameOver = function() {
    
    this.state = ARENA.STATE.SPECTATOR;

    io.sockets.socket(this.socketId).emit('go', {
        username: this.username,
        pixel_length: (this.worm_xy.length * ARENA.BLOCK_SIZE),
        session_kills: (this.kills - this.kills_session_start),
        session_score: (this.score - this.score_session_start),
        total_score: this.score,
        total_kills: this.kills,
        total_deaths: this.deaths,
        total_suicides: this.suicides
    });
};

/** 
 * Send world information to palyer ('ws')
 * @method synchronize 
 */
Player.prototype.synchronize = function() {
    io.sockets.socket(this.socketId).emit('ws', createWorldSynchronizePacket());
};

/** 
 * Send 'ping' event to player. Log the event timestamp for later use.
 * @method ping 
 */
Player.prototype.ping = function() {
    this.ping_start = new Date();
    io.sockets.socket(this.socketId).emit('ping');
}

/**
 * Send refresh packet ('wr') with a delay. This method can be used with the
 * estimated client latency to send refresh packets almost simultaneously to clients
 * 
 * @method refreshWithDelay 
 */
Player.prototype.refreshWithDelay = function(ms, data) {
    var base = this;
    wait_before_send_ms = (ms > this.latency) ? ms - this.latency : ms;
    setTimeout(function() {
        base.refresh(data);
    }, wait_before_send_ms);
}

/**
 * Send refresh packet ('wr') immediately to player. 
 * @method refresh 
 */
Player.prototype.refresh = function(data) {
    io.sockets.socket(this.socketId).emit('wr', data);
}

/** 
 * Helper methods for standard js -array 
 * @class Array
 */

/**
 * Returns the index of coordinate-object({x:<x>,y:<y>}) in array. 
 * Returns -1 if given coordinate object is not found. 
 * @method index 
 */
Array.prototype.index = function(x,y) {
    for(var i=0; i < this.length; ++i) {
        if(this[i].x == x && this[i].y == y) {
            return i;
        }
    }

    return -1;
};

/**
 * Creates a copy of this array. 
 * @method clone 
 */
Array.prototype.clone = function()  {
    return this.slice(0);
};

/**
 * Removes element at index <index> in from this array.
 * @method remove 
 */
Array.prototype.remove = function(index) {
    this.splice(index,1);
};


/** 
 *  Game logic 
 *  @class arena.server
 */

var players = [],
    spectators = [], 
    apples_xy = [];

io.sockets.on('connection', function(socket) {

    console.info("Socket connection opened");

    socket.on('connect', function(username, color) {
        
        console.info("New user connects to the server and negotiates username/color");
        
        var rgb1 = ARENA.hex_to_rgb(color),
            rgb2,
            players_and_spectators = players.concat(spectators),
            player;
   
        // check that the server isn't full
        if((players.length+spectators.length) > ARENA.MAX_PLAYERS) {
            console.info("Server full");
            io.sockets.socket(socket.id).emit('connect_response', ARENA.CONNECTION.SERVER_FULL);
            return;
        }

        // check that username is not reserved among players or spectators
        // check that requested color is in the allowed range. Too similiar colors are not accepted.
        for(var i=0; i < players_and_spectators.length; ++i) {
            if(players_and_spectators[i].username == username) {
                console.info("Username " + username + " already reserved for another player - sending error");
                io.sockets.socket(socket.id).emit('connect_response', ARENA.CONNECTION.RESERVED_USERNAME);
                return;
            }
            
            rgb2 = ARENA.hex_to_rgb(players_and_spectators[i].worm_color);

            if( ARENA.diff(rgb1.r, rgb2.r) < ARENA.COLOR_RGB_TRESHOLD ||
                ARENA.diff(rgb1.g, rgb2.g) < ARENA.COLOR_RGB_TRESHOLD ||
                ARENA.diff(rgb1.b, rgb2.b) < ARENA.COLOR_RGB_TRESHOLD) {
            
                console.info("Worm color " + color + " is too close to the color " + players_and_spectators[i].worm_color + " - sending error");
                io.sockets.socket(socket.id).emit('connect_response', ARENA.CONNECTION.RESERVED_COLOR);
                return;
            }
        }

        console.info("Username and color OK");

        // OK - Create the new player as spectator
        spectators.push(new Player(username, color, socket.id));
        socket.username = username;
        io.sockets.socket(socket.id).emit('connect_response', ARENA.CONNECTION.USER_COLOR_OK);    
        publish(username + " connects to server");
        synchronize_all();
    });

    socket.on('disconnect', function() {
        
        console.info("User " + socket.username + " disconnects");
        
        for(var i=0; i < players.length; ++i) {
            if(players[i].socketId == socket.id) {
                publish(players[i].username + " is a coward and flees the fight by closing the browser");
                players.splice(i,1);
                synchronize_all();
                return;
            }
        }

        for(var d=0; d < spectators.length; ++d) {
            if(spectators[d].socketId == socket.id) {
                publish(spectators[d].username + " gets bored of watching the fight and disconnects");
                spectators.splice(d,1);
                synchronize_all();
                return;
            }
        }
    });

    socket.on('join', function () {
        
        console.info("User " + socket.username + " joins the arena");
        
        for(var i=0; i < spectators.length; ++i) {
            if(spectators[i].socketId == socket.id) {
                publish(spectators[i].username + " enters the fight!");
                spectators[i].reset();
                spectators[i].state = ARENA.STATE.ACTIVE;
                players.push(spectators[i]);
                spectators.splice(i,1);    
                synchronize_all();
                break;
            }
        }
    });
      
    socket.on('sync_request', function() {
        
        console.info("User " + socket.username + " requests a full synchronization");
        
        for(var i=0; i < players.length; ++i) {
            if(socket.username == players[i].username) {
                players[i].synchronize();
                return;
            }
        }
    });

    socket.on('keypress', function(key_code) {
        for(var i=0; i < players.length; ++i) {
            if(socket.username == players[i].username) {
                players[i].worm_direction = key_code;
                return;
            }
        }
    });

    socket.on('pong', function() {
        for(var i=0; i < players.length; ++i) {
            if(socket.username == players[i].username) {
                players[i].latency = (new Date() - players[i].ping_start) / 2;
                console.log("Latency for player: " + players[i].username + " is " + players[i].latency + " ms");
            }
        }
    });
});


// start server game logic when server starts
startArena(ARENA.WORLD_REFRESH_TIME_MS);

/** 
 * Start running the world refresh loop and perform movement on in game players
 * @method startArena
 * @param ms - world refresh rate in milliseconds.
 */
function startArena(ms) {

    // spawn initial apple
    create_apple();

    // client latency estimation loo
    // every 5 seconds estimate the latency for each in game player (not spectator) 
    setInterval(function() {
        for(var i=0; i < players.length; ++i) {
            players[i].ping();
        }
    }, 5000);

    // world refresh loop
    // in-game players latency is noted, for spectators that's not too important.
    setInterval(function(){
        perform_movement();
        var data = createWorldRefreshPacket();

        for(var i=0; i < players.length; ++i) {
            players[i].refreshWithDelay(ms, data);
        }

        for(var d=0; d < spectators.length; ++d) {
            spectators[d].refresh(data);
        }
    }, ms);
}

/** 
 * Create 'wr' event packet that is broadcasted often. See documentation on 'wr' 
 * @method createWorldRefreshPacket
 */
function createWorldRefreshPacket() {

    var data = {}, plr;
    data.p = [];

    for(var i=0; i < players.length; ++i) {
        plr = {},
        head = players[i].getHead();
        plr.g = players[i].growing;
        plr.n = players[i].username;
        plr.x = head.x;
        plr.y = head.y;
        plr.wd = players[i].worm_direction;
        data.p.push(plr);
    }

    return data;
}

/** 
 * Create 'ws' event packet that is sent rarely. See documentation on 'ws' 
 * @method createWorldSynchronizePacket
 */
function createWorldSynchronizePacket() {
	
    var data = {}
    data.players = players;
    data.spectators = spectators;
    data.apples_xy = apples_xy; 

    return data;
}

/** 
 * Get next x,y -coordinate for player depending on worm direction.
 * @method calculate_next_xy 
 */
function calculate_next_xy(player) {

    var xy = player.getHead(),
        new_xy;

    switch(player.worm_direction) {

        case ARENA.LEFT:
            new_xy = (xy.x == ARENA.X_MIN) ? {
                    x: ARENA.X_MAX, 
                    y: xy.y
                } : {
                    x: xy.x - ARENA.BLOCK_SIZE, 
                    y: xy.y
                };
            break;

        case ARENA.UP:
            new_xy = (xy.y == ARENA.Y_MIN) ? {
                    x: xy.x, 
                    y: ARENA.Y_MAX
                } : {
                    x: xy.x, 
                    y: xy.y - ARENA.BLOCK_SIZE
                };
            break;

        case ARENA.RIGHT:
            new_xy = (xy.x == ARENA.X_MAX) ? {
                    x: ARENA.X_MIN,
                    y: xy.y
                } : {
                    x: xy.x + ARENA.BLOCK_SIZE,
                    y: xy.y
                };
            break;

        case ARENA.DOWN:
            new_xy = (xy.y == ARENA.Y_MAX) ? {
                    x: xy.x,
                    y: ARENA.Y_MIN
                } : {
                    x: xy.x,
                    y: xy.y + ARENA.BLOCK_SIZE
                };
            break;
    }

    return new_xy;
}

/** 
 * Perform worm movement on arena. Detect collisions and handle apple eating
 * @method perform_movement 
 */ 
function perform_movement() {

    var my_player, my_nextXY, my_headXY, my_bodyXY, my_length,
    other_player, other_headXY, other_bodyXY, other_length,
    full_sync_required = false;

    // move every worm in state ACTIVE
    for(var i = 0; i < players.length; ++i) {		
        my_player = players[i];
        my_nextXY = calculate_next_xy(my_player);
		
        if (my_player.state == ARENA.STATE.ACTIVE) {
            my_headXY = my_player.getHead();
            my_bodyXY = my_player.getBody();
            my_length = my_player.worm_xy.length;

            // collision with own body
            if(my_bodyXY.index(my_nextXY.x, my_nextXY.y) != -1) {
                my_player.suicide();
            }

            // check collisions against other worms that are in state active
            for(var d = 0; d < players.length; ++d) {
                other_player = players[d];

                if(other_player.username != my_player.username &&
                    players[d].state == ARENA.STATE.ACTIVE) {

                    other_headXY = other_player.getHead();
                    other_bodyXY = other_player.getBody();
                    other_length = other_player.worm_xy.length;

                    // collision with other worms body
                    if(other_bodyXY.index(my_headXY.x, my_headXY.y) != -1) {
                        other_player.kill(my_player);
                        break;
                    }

                    // collision with other worms head
                    if(other_headXY.x == my_headXY.x && other_headXY.y == my_headXY.y) {

                        if(my_length > other_length) {
                            my_player.kill(other_player);
                            break;
                        }
                        else if(other_length > my_length) {
                            other_player.kill(my_player);
                            break;
                        }
                        else {
                            publish(my_player.username + " and " + other_player.username + " are equally strong and both perish");
                            my_player.state = ARENA.STATE.GAME_OVER;
                            other_player.state = ARENA.STATE.GAME_OVER;
                        }
                    }
                }
            }
        }

        // after collision detection if player is still alive and well - perform movememnt 
        if(my_player.state == ARENA.STATE.ACTIVE) {

            // add a new x,y on top of the worm array.
            my_player.setHead(my_nextXY.x, my_nextXY.y);

            // don't crop the tail away if worm is growing.
            if(!my_player.growing) {
                my_player.worm_xy.splice(0,1);
            }

            // check if worm has secured an apple with this move.
            var index = apples_xy.index(my_nextXY.x, my_nextXY.y);

            if(index != -1) {
                my_player.eat();
                create_apple();
                apples_xy.splice(index,1);
                full_sync_required = true;
            }
        }
    }

    // handle game overs that were triggered by this movement
    for(var z = 0; z < players.length; ++z) {
        if(players[z].state == ARENA.STATE.GAME_OVER) {

            // send 'go' event and move player from active players to spectators
            players[z].gameOver();
            spectators.push(players[z]);
            players.splice(z,1);
            full_sync_required = true;
        }
    }

    // if one of the movements triggered a full synchronization perform it now.
    if(full_sync_required) {
        players.sort(compare_players);
        spectators.sort(compare_players);
        synchronize_all();
    }
}

/** 
 * Comparator for array sort to sort players based on score
 * @method compare_players
 */
function compare_players(a, b) {

    if(a.score > b.score) {
        return -1;
    }

    if(a.score < b.score) {
        return 1;
    }

    return 0;
}

/** 
 * Send full synchronization to all players and spectators
 * @method synchronize_all 
 */
function synchronize_all() {
	
    console.info("Synchronizing all connected clients");

    for(var i=0; i < players.length; ++i) {
        players[i].synchronize();	
    }

    for(var d=0; d < spectators.length; ++d) {
        spectators[d].synchronize();	
    }
};

/** 
 * Create a new apple to random location in game.
 * @method create_apple 
 */ 
function create_apple() {
    var x, y;

    do {
        x = Math.floor(Math.random()*48+1) * ARENA.BLOCK_SIZE;
        y = Math.floor(Math.random()*38+1) * ARENA.BLOCK_SIZE;
    } 
    while(!(isFreeLocation(x,y))); 

    console.info("Spawned apple to " + x + "," + y );
    
    apples_xy.push({
        x: x, 
        y: y
    });
};

/** Returns true if x,y is free and contains enough space on front,back,top and bottom */
function is_available_xy(x, y, th_front, th_back, th_top, th_bottom) {

    // Model the "square" as array of x,y points
    var xy_array = [];
    for(var d = (x - th_back); d <= (x + 50 + th_front); d = d + ARENA.BLOCK_SIZE) {
        for(var z = (y - th_top); z <= (y + th_bottom); z = z + ARENA.BLOCK_SIZE) {
            xy_array.push({
                x: d, 
                y: z
            });
        }
    }

    // Test that none of the other worms are in the created square
    for(var i = 0; i < players.length; ++i) {
        for(var c = 0; c < xy_array.length; ++c) {
            if(players[i].occupies(xy_array[c].x, xy_array[c].y)) {
                return false;
            }
        }
    }

    return true;
}

/** Returns true if given x,y is empty position (no worms or apples) */
function isFreeLocation(x, y) {

    // Check worms
    for(var i=0; i < players.length; ++i) {
        if(players[i].occupies(x,y)) {
            return false;
        }
    }

    // Check apples 
    for (var i=0; i< apples_xy.length; ++i) {
        if(apples_xy.x == x && 
            applex_xy.y == y ) {
            return false;
        }
    }

    return true;
};

/** Handle new worm creation. */ 
function createWorm() {

    var worm_xy = [],
    multiplier = 3,
    th_front,
    th_back,
    th_y;

    /** 
	 * Start searching for spawn location for worm. Locations are scanned first horizontally, and then vertically.
	 * Possible starting location is modelled as an square of x,y -points. On the first round the square is larger 
	 * than on the next rounds thus minimizing the possiblity that a starting location is not found at all.
	 */ 
    while(multiplier >= 1) {

        th_front = multiplier * 6 * ARENA.BLOCK_SIZE;	// 'blocks' of space required in front of the worm
        th_back = multiplier * 2 * ARENA.BLOCK_SIZE;	// 'blocks' of space required behind the worm
        th_y = multiplier * 1 * ARENA.BLOCK_SIZE;		// 'blocks' of space required top & bottom for y

        for(var y = (ARENA.BLOCK_SIZE*6); y < ARENA.HEIGHT; y = y + (2*ARENA.BLOCK_SIZE)) {
            for (var x = (ARENA.BLOCK_SIZE*6); x < ARENA.WIDTH; x = x + (2*ARENA.BLOCK_SIZE)) {

                /* x,y and the space required around the worm is tested against other worms locations */
                if(is_available_xy(x, y, th_front, th_back, th_y, th_y)) {
                    worm_xy.push({
                        x:x, 
                        y: y
                    });
                    worm_xy.push({
                        x:x+10, 
                        y: y
                    });
                    worm_xy.push({
                        x:x+20, 
                        y: y
                    });
                    worm_xy.push({
                        x:x+30, 
                        y: y
                    });
                    worm_xy.push({
                        x:x+40, 
                        y: y
                    });
                    worm_xy.push({
                        x:x+50, 
                        y: y
                    });
                    return worm_xy;
                }
            }
        }

        --multiplier; 
    }

// TODO: No available location to spawn? 
};

function publish(message) {
    console.info(message);
    io.sockets.emit('msg', message);
};
