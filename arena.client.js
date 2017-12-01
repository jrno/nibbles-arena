/** 
 * HTML 5 Nibbles Arena client
 * 
 * (c) Jarno Pohjonen 2012/2013
 *
 * @module arena.client
 * @class arena.client
 */

/** Arena variables */

var username,
color,
bg_color,
border_color,
ctx,
gradient,
apples = 0,
players = [],
spectators = [],
apples_xy = [],
worm_direction = ARENA.RIGHT,
connection_status = ARENA.CONNECTION.NOT_CONNECTED,
socket = io.connect(window.location.hostname);

/**
 * Initialize the arena client for use
 * @method initialize
 */
function initialize() {	

    var $username_input = $('input#username'),
    $color_input = $('input#color'),
    $bg_color_input = $('input#bg_color'),
    $border_color_input = $('input#border_color');
            
    // check that client supports required features
    if(!has_html5_feature_support()) {
        $('#browser_not_supported_dialog').dialog({
            title: 'Unsupported browser',
            width: 500,
            height: 400,
            resizable: false,
            draggable: false
        });

        return;
    }

    // lookup username and color preferences from local storage
    if(localStorage["username"] != undefined) {
        $username_input.val(localStorage["username"]);
    }

    if(localStorage["color"] != undefined) {
        $color_input.val(localStorage["color"]);
    }

    if(localStorage["bg_color"] != undefined) {
        $bg_color_input.val(localStorage["bg_color"]);
    }
        
    if(localStorage["border_color"] != undefined) {
        $border_color_input.val(localStorage["border_color"]);
    }
        
    $('#welcome_dialog').dialog({
        closeOnEscape: false,
        title: 'Welcome to Nibbles Arena',
        width: 600,
        height: 500,
        modal: true,
        resizable: false,
        draggable: false,
        buttons: {
            'Continue': function() {

                var poll_response;

                // TODO: Validate input selections 
                username = $username_input.val().trim();

                if(!username || username.length > 10 || username.length < 1) {
                    $username_input.addClass("error");
                    $username_input.tooltip();
                    return;
                }

                color = "#" + $color_input.val().trim();
                bg_color = "#" + $bg_color_input.val().trim();
                border_color = "#" + $border_color_input.val().trim();
                
                // poll response from the server every 20ms
                connect(username, color);
                connection_status = ARENA.CONNECTION.AWAITING_RESPONSE;
                poll_response = setInterval(function() {

                    // no response yet
                    if (connection_status == ARENA.CONNECTION.AWAITING_RESPONSE) {
                        return;
                    }

                    // response received
                    clearInterval(poll_response);

                    // username is taken
                    if (connection_status == ARENA.CONNECTION.RESERVED_USERNAME) {
                        $('div.ui-dialog-buttonpane').find('.dialog-error').remove();
                        $('div.ui-dialog-buttonpane').append('<div class="dialog-error"><img src="img/attention.png"/><p>Username is already taken, choose another username.</p></div>');
                        return; 
                    }

                    // color is taken or is too close to a similiar color
                    if (connection_status == ARENA.CONNECTION.RESERVED_COLOR) {
                        $('div.ui-dialog-buttonpane').find('.dialog-error').remove();
                        $('div.ui-dialog-buttonpane').append('<div class="dialog-error"><img src="img/attention.png"/><p>Worm color is already reserved, or is too close to another worms color, choose another color. </p></div>');
                        return; 
                    }

                    // server full
                    if (connection_status == ARENA.CONNECTION.SERVER_FULL) {
                        $('div.ui-dialog-buttonpane').find('.dialog-error').remove();
                        $('div.ui-dialog-buttonpane').append('<div class="dialog-error"><img src="img/attention.png"/><p>Server is currently full. Try again soon</p></div>');
                        return; 
                    }

                    // username and color ok
                    if (connection_status == ARENA.CONNECTION.USER_COLOR_OK) {
                        $('#welcome_dialog').dialog('close');
                                                
                        localStorage["username"] = username;
                        localStorage["color"] = color;
                        localStorage["bg_color"] = bg_color;
                        localStorage["border_color"] = border_color;                                       
                        startGame();
                    }

                }, 20);
            }
        }
    });
}

/** 
 * Bind keys and initialize ui and start canvas rendering. 
 * @method startGame
 */ 
function startGame() {

    // draw and display canvas 
    var $canvas = $('<canvas id="nibbles"></canvas>')
    .attr("width", ARENA.WIDTH)
    .attr("height", ARENA.HEIGHT);

    $("#game_container")
    .css("width", ARENA.WIDTH+"px")
    .css("height", ARENA.HEIGHT+"px")
    .prepend($canvas);

    canvas = document.getElementById("nibbles");
    ctx = canvas.getContext("2d");
    $('#game_elements').fadeIn('fast');

    // bind controls and buttons
    bindKeys();

    // create and bind 'Enter Arena' -button
    createJoinButton();

    // request for full world data
    synchronize();
}

/* Server -> Clients events and handlers */

function createJoinButton() {
    $('div#personalized')
        .empty()
        .append('<button id="join" class="hidden">Enter Arena!</button>');

    $('button#join')
        .button()
        .click(function(e) {
            join();
        });
}

function updatePersonalized(player) {

    $personalized = $('div#personalized');

    if($personalized.find('h3').length == 0) {
        $personalized
            .empty()
            .append($('#personalized_tmpl').tmpl(player));
    }
    else {

        var $score_span = $personalized.find('span.score');
        var score_award = player.score - parseInt($score_span.html());

        $personalized.find('span.kills').html(player.kills);

        if(score_award > 0) {
            $score_span.html(player.score);
            $('#award')
                .html("+" + score_award + "p")
                .fadeIn('fast')
                .fadeOut(1000);
        }
    }
}

/** 
 * Handle world refresh event. Locally stored player information is updated with the new position 
 * information. 
 * 
 * @method handleWr 
 */
socket.on('wr', function(data) {

    // ignore world refresh events before connection status is ok.
    if(connection_status != ARENA.CONNECTION.USER_COLOR_OK) {
        return;
    }

    // if there's different amount of players in local and sent data, ignore this packet.
    // full sync is following soon.
    if(data.p.length != players.length) {
        return;
    }

    var remote_player, local_player;

    // update local player information with remote player position information
    for(var i=0; i < data.p.length; ++i) {
        remote_player = data.p[i];
        local_player = players[i];

        if(remote_player.n == username) {
            worm_direction = remote_player.wd;
        }

        // Set new head, crop tail if not growing
        players[i].worm_xy.push({
            x: remote_player.x, 
            y: remote_player.y
        });

        if(!remote_player.g) {
            local_player.worm_xy.splice(0,1);
        }

        // request for full synchronization if worm has moved more than one block 
        // this means that packets have been lost.
        if((remote_player.x - local_player.worm_xy[local_player.worm_xy.length-1].x > ARENA.BLOCK_SIZE) || 
           (remote_player.y - local_player.worm_xy[local_player.worm_xy.length-1].y > ARENA.BLOCK_SIZE)) {
            synchronize();
        } 
    }
    
    render();
});

/** 
 * Handle world synchronization event. Locally stored player information is replaced with the player
 * information from server. 
 * 
 * @method handleWs 
 */
socket.on('ws', function(data) {

    console.log("event: ws, data: " + JSON.stringify(data));
    
    var $spectators_list = $('#spectators_list').empty(),
        $players_list = $('#players_list').empty(),
        $player_template = $('#player_tmpl');

    // replace local information with server sent information
    players = data.players;
    spectators = data.spectators;
    apples_xy = data.apples_xy;

    // update user interface
    $.each(spectators, function(key, spectator) {
        $spectators_list.append($player_template.tmpl(spectator));
    });

    $.each(players, function(key, player) {
        $players_list.append($player_template.tmpl(player));

        if(player.username == username) {
            updatePersonalized(player);
        }
    });
});

/** 
 * Handle game over -event. Dialog is displayed to the user containing the 
 * statistics for the session. 
 * @method handleGo
 */
socket.on('go', function(data) {

    console.log("event: go, data: " + JSON.stringify(data));

    if(data.pixel_length < 200) {
        data.fill1 = "Pathetic"; data.fill2 = "You're a disappoinment...";
    }
    else if(data.pixel_length < 500) {
        data.fill1 = "Moderate"; data.fill2 = "Pretty good job!";
    }
    else if(data.pixel_length < 1000) {
        data.fill1 = "Impressive"; data.fill2 = "Great job!";
    }
    else {
        data.fill1 = "Astonishing"; data.fill2 = "Hail the worm lord!";
    }

    $('#gameover_dialog')
        .empty()
        .append($('#gameover_tmpl').tmpl(data))
        .dialog({
            closeOnEscape: false,
            title: 'You lose!',
            width: 500,
            height: 400,
            modal: true,
            resizable: false,
            draggable: false,
            buttons: {
                'Re-join arena' : function() {
                    $('#gameover_dialog').dialog('close');
                    $('div#personalized').empty();
                    join();
                },
                'Spectate' : function() {
                    $('#gameover_dialog').dialog('close');
                    createJoinButton();
                },
                'Enough of this' : function() {
                    window.location.href = window.location.href;
                }
            }
        });
});

/** 
 * Handle server sent message.
 * @method handleMsg 
 */
socket.on('msg', function(data) {
    
    console.log("event: msg, data: " + JSON.stringify(data));
    
    $('ul#events').prepend('<li class="event"><span class="timestamp">' + ARENA.timestamp() 
        + '</span><span class="message">' + data + '</span></li>').fadeIn();
    
    if( $('#events li').length > ARENA.MAX_VISIBLE_EVENTS) {
        $('ul#events li:last').fadeOut().remove();
    }
});

/** 
 * Handle connect_response -event
 * @method handleConnectResponse 
 */
socket.on('connect_response', function(data) {
    console.log("event: connect_response, data: " + JSON.stringify(data));
    connection_status = data;
});

/** 
 * Handle ping -event. Reply instantly with 'pong' event.
 * @method handlePing 
 */
socket.on('ping', function(data) {
    socket.emit('pong');
});


/* Client -> Server events */


/** 
 * Send synchronization request to server
 * @method synchronize
 */ 
function synchronize() {
    socket.emit('sync_request');
}

/** 
 * Send connection request to server
 * @method connect
 */
function connect(username, color) {
    socket.emit('connect', username, color);
}

/** 
 * Join the arena game.
 * @method join
 */
function join() {
    socket.emit('join');
    
    // TODO: Remove the join button and initialize score and apple counters.
}

/** 
 * Send a keypress from client to server. 
 * @method keypress
 */
function keypress(keycode) {
    socket.emit('keypress', keycode);
}


/* Client utility functions */ 


/** 
 * Bind left, up, down and right arrows to control the worm movement. 
 * @method bindKeys
 */
function bindKeys() {

    // Arrow keys
    $('body').keydown( function(e) {	
        
        if(e.keyCode == ARENA.LEFT) {
            
            if(worm_direction != ARENA.RIGHT) {
                keypress(ARENA.LEFT);
            }

            e.preventDefault();
            return;
        }

        if(e.keyCode == ARENA.UP) {
            if(worm_direction != ARENA.DOWN) {
                keypress(ARENA.UP);
            }

            e.preventDefault();
            return;
        }

        if(e.keyCode == ARENA.RIGHT) {
            if(worm_direction != ARENA.LEFT) {
                keypress(ARENA.RIGHT);
            } 

            e.preventDefault();
            return;
        }

        if(e.keyCode == ARENA.DOWN) {
            if(worm_direction != ARENA.UP) {
                keypress(ARENA.DOWN);
            } 

            e.preventDefault();
            return;
        }
    });
}

function render() {

    // draw background
    ctx.fillStyle = bg_color;
    ctx.fillRect(0, 0, ARENA.WIDTH, ARENA.HEIGHT);

    // draw borders
    ctx.fillStyle = border_color;
    ctx.fillRect(0, 0, ARENA.WIDTH, ARENA.BLOCK_SIZE);
    ctx.fillRect(0, 0, ARENA.BLOCK_SIZE, ARENA.HEIGHT);
    ctx.fillRect(ARENA.WIDTH - ARENA.BLOCK_SIZE, 0, ARENA.BLOCK_SIZE, ARENA.HEIGHT);
    ctx.fillRect(0, ARENA.HEIGHT - ARENA.BLOCK_SIZE, ARENA.WIDTH, ARENA.BLOCK_SIZE);

    // draw apples
    ctx.fillStyle= ARENA.APPLE_COLOR;
    for(var d=0; d < apples_xy.length; ++d) {
        ctx.fillRect(apples_xy[d].x, apples_xy[d].y, ARENA.BLOCK_SIZE, ARENA.BLOCK_SIZE);
    }

    // draw all worms
    for(var z = 0; z < players.length; ++z) {
        for(var i = 0; i < players[z].worm_xy.length; ++i ) {
            ctx.fillStyle = players[z].worm_color;
            ctx.fillRect(players[z].worm_xy[i].x, players[z].worm_xy[i].y, ARENA.BLOCK_SIZE, ARENA.BLOCK_SIZE);
        }
    }
}

/** 
 * Check that browser has support for local storage and basic canvas features
 * @method has_html5_feature_support
 * @return true if browser is suitable, false otherwise
 */
function has_html5_feature_support() {

    // local storage
    try {
        return 'localStorage' in window && window['localStorage'] !== null;
    } catch (e) {
        return false;
    }

    // canvas
    var elem = document.createElement('canvas');
    return !!(elem.getContext && elem.getContext('2d'));

    // websockets support not required but preferred (socket.io fallbacks to long poll).
}