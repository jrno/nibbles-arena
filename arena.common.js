/** 
 * HTML 5 Nibbles Arena common 
 * 
 * Shared variables across client/server. 
 * 
 * (c) Jarno Pohjonen 2012/2013
 *
 * @module arena.common
 * @class arena.common
 */

(function(exports) {

    /** 
     * Port that is used to listen incoming http requests
     * @property PORT 
     */
    exports.PORT = 9090;

    /** 
     * Mimetypes handled by the simple node web server
     * @property MIMETYPES 
     */
    exports.MIMETYPES = {
        "html": "text/html",
        "jpeg": "image/jpeg",
        "jpg": "image/jpeg",
        "png": "image/png",
        "js": "text/javascript",
        "css": "text/css",
        "mp3": "audio/mpeg"
    };

    /** 
     * This value is used to store client state. 
     * @property STATE 
     */
    exports.STATE = {
        NOT_CONNECTED: 0,
        SPECTATOR: 2,
        ACTIVE: 3,
        GAME_OVER: 4
    }

    /** 
     * This value is used to store connection state. 
     * @property CONNECTION 
     */
    exports.CONNECTION = {
        NOT_CONNECTED : 0,
        AWAITING_RESPONSE : 1,
        USER_COLOR_OK: 2,
        RESERVED_COLOR : 3,
        RESERVED_USERNAME : 4,
        SERVER_FULL : 5
    };

    /** 
     * Default background color for arena (= Black) 
     * @property BACKGROUND_COLOR 
     */ 
    exports.BACKGROUND_COLOR = "#000000";

    /** 
     * Default border color for arena (= Yellow) 
     * @property BORDER_COLOR 
     */ 
    exports.BORDER_COLOR = "#FFFF00";

    /** 
     * Apple color for arena (= Green) cannot be overriden
     * @property APPLE_COLOR 
     */ 
    exports.APPLE_COLOR = "#7FFF00";

    /** 
     * Blocks are groups of pixels. Block size of 10 means a 10x10 pixel block. Block size defines 
     * the size of these pixel groups. 
     * @property BLOCK_SIZE 
     */
    exports.BLOCK_SIZE = 10;

    /** 
     * Arena width in pixels. This must be a multiple of the defined block size. 
     * @property WIDTH 
     */
    exports.WIDTH = 1000;

    /** 
     * Arena height in pixels. This must be a multiple of the defined block size. 
     * @property HEIGHT 
     */
    exports.HEIGHT = 600;

    /** 
     * World refresh time in milliseconds. World refresh is an event where all the worms in the
     * field perform movement action.
     * @property WORLD_REFRESH_TIME_MS 
     */
    exports.WORLD_REFRESH_TIME_MS = 45;
    
    /** 
     * Worm growth time in milliseconds. Each world refresh grows the worm with one block. 
     * Growth in blocks = WORM_GROWTH_TIME_MS / WORLD_REFRESH_TIME_MS;
     * @property WORM_GROWTH_TIME_MS 
     */
    exports.WORM_GROWTH_TIME_MS = 500;
 
    /**
     * Maximum number of players that the arena can support
     * @property MAX_PLAYERS
     */
    exports.MAX_PLAYERS = 8; 

     /** 
      * Smallest arena x-coordinate.
      * @property X_MIN 
      */
    exports.X_MIN = 0 + exports.BLOCK_SIZE;

     /** 
      * Biggest arena x-coordinate.
      * @property X_MAX 
      */
    exports.X_MAX = exports.WIDTH - (exports.BLOCK_SIZE*2);

     /** 
      * Smallest arena y-coordinate.
      * @property Y_MIN 
      */
    exports.Y_MIN = 0 + exports.BLOCK_SIZE;

     /** 
      * Biggest arena y-coordinate.
      * @property Y_MAX 
      */
    exports.Y_MAX = exports.HEIGHT - (exports.BLOCK_SIZE*2);

     /** 
      * Identifier for direction 'left'
      * @property LEFT 
      */
    exports.LEFT = 37;

     /** 
      * Identifier for direction 'up'
      * @property UP 
      */
    exports.UP = 38;

     /** 
      * Identifier for direction 'right'
      * @property RIGHT 
      */
    exports.RIGHT = 39;

     /** 
      * Identifier for direction 'down'
      * @property DOWN 
      */
    exports.DOWN = 40;

     /** 
      * Amount of visible notifications at a time
      * @property MAX_VISIBLE_EVENTS 
      */
    exports.MAX_VISIBLE_EVENTS = 5;

     /** 
      * RGB treshold factor. The factor determines how much each worm color needs to 
      * differentiate from other colors (in R, G and B)
      * @property COLOR_RGB_TRESHOLD 
      */
    exports.COLOR_RGB_TRESHOLD = 5;

     /** 
      * Score awarded per apple 
      * @property SCORE_PER_APPLE 
      */
    exports.SCORE_PER_APPLE = 20;

     /** 
      * Score awarded per kill 
      * @property SCORE_PER_KILL 
      */
     // exports.SCORE_PER_KILL = 50;

     /** 
      * Score that is taken away from player on game over
      * @property SCORE_LOSS_PER_DEATH 
      */
    exports.SCORE_LOSS_PER_DEATH = 20;

     /** 
      * Score that is taken away from player on suicide (collision with own worm)
      * @property SCORE_LOSS_PER_DEATH 
      */
    exports.SCORE_LOSS_PER_SUICIDE = 50;

    /** 
     * Convert a hex string to object with r,g and b values
     * @method hex_to_rgb
     */
    exports.hex_to_rgb = function(hex) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    /** 
     * Return the absolute difference of two numbers 
     * @method diff
     */
    exports.diff = function(a,b) {
        return Math.abs(a-b);
    }

    /** 
     * Zero pad input number to a length of two. Numbers needs to be between 0-99
     * @method padToTwo
     */
    exports.padToTwo = function (number) {
        if (number<=99) {
            number = ("0"+number).slice(-2);
        }
        return number;
    }

    /** 
     * Get current timestamp as formatted string.
     * @method timestamp
     */
    exports.timestamp  = function() {
        var dNow = new Date();
        var dString = exports.padToTwo(dNow.getHours()) + ':' + exports.padToTwo(dNow.getMinutes()) + ':' + exports.padToTwo(dNow.getSeconds());
        return dString;
    }

}) (typeof exports === 'undefined' ? this['ARENA']={}: exports);
