$(window).ready(function() {
    /*  settings for different browsers */
    window.requestAnimationFrame = window.requestAnimationFrame || 
        window.mozRequestAnimationFrame ||
        window.webkitRequestAnimationFrame || 
        window.msRequestAnimationFrame;
    document.pointerLockElement = document.pointerLockElement    ||
        document.mozPointerLockElement ||
        document.webkitPointerLockElement;
});
function Game(id) {
    this.paused = false; // pauses the game when true
    this.hooks = []; // a list of objects to update each frame
    this.started = false; // true when game has started
    this.time = 0; // current game time
    this.time_started = 0; // time started
    this.id = id; // the id of the HTML element containing the game

    /* MANAGERS */
    this.constants = {
        FULLSCREEN : false, // a flag to set full screen
        PAN : false, // enable panning
        CURSOR_SPEED: 1, // cursor speed multiplier
        
        MIP_MAPPING : false, // disable or enable mip mapping
        
        GAME_AREA_WIDTH : 3000, // X number of pixels for game area
        GAME_AREA_HEIGHT : 2000, // Y number of pixels for game area
        
        VIEW_WIDTH : 800, // viewport width
        VIEW_HEIGHT : 600, // viewport height

        GAME_SPEED : 1,  // game speed mulitplier
        
        TILE_WIDTH : 32, // tile width
        TILE_HEIGHT : 32, // tile height

        PAN_MARGIN : 16, // margin for panning
        PAN_SPEED : 35, // speed for panning
    };
    this.resources = {
        init: function() {
            this.images = {}
            this.sprites = {};
            this.sounds = {};
            this.images_to_load = {};
        },
        
        /* add an image to be loaded */
        add_image: function(image_name, source) {
            this.images_to_load[image_name] = source;
        },
        
        /* add a sprite to be loaded */
        add_sprite: function(image_name, source, clip_x, clip_y) {
            this.images_to_load[image_name] = source;
            this.sprites[image_name] = new Sprite(image_name, clip_x, clip_y);
        },
        
        /* call when you're ready to load all images */
        load: function(callback) {   
            var loaded = 0;
            var total = 0;
            for (var key in this.images_to_load) {
                total++;
            }
            if (total == 0) {
                if (callback) {
                    callback();
                }
                return;
            }
            for (var key in this.images_to_load) {
                this.images[key] = new Image();
                this.images[key].onload = function() {
                    if(++loaded >= total) {
                        callback();
                    }
                };
                this.images[key].src = this.images_to_load[key];
            }
        }
    };
    this.events = {
        init: function() {
            this.hooks = [];
            this.mouse_x = 0;
            this.mouse_y = 0;
            this.tile_x = 0;
            this.tile_y = 0;
            this.mouse_over = false;
            
            var me = this;
            
            $(window).mousedown(function(e) {
                me.mouse_down(e);
            });
            $(window).mousemove(function(e) {
                me.mouse_move(e);
            });
            $(window).mouseup(function(e) {
                me.mouse_up(e);
            });
            $(window).bind('mousewheel DOMMouseScroll MozMousePixelScroll', function(e) {
                me.mouse_wheel(e);
            });
            $(window).keydown(function(e) {
                me.key_down(e);
            });
            $(window).keyup(function(e) {
                me.key_up(e);
            });
            $(window).resize(function(e) {
                me.resize();
            });
            $(window).click(function(e) {
                me.mouse_click(e);
            });
            
            document.addEventListener('pointerlockchange', function() {
                me.pointerLockChange();
            }, false);        
            document.addEventListener('mozpointerlockchange', function() {
                me.pointerLockChange();
            }, false);       
            document.addEventListener('webkitpointerlockchange', function() {
                me.pointerLockChange();
            }, false);        
            document.addEventListener('pointerlockerror', function() {
                me.pointerLockError();
            }, false);    
            document.addEventListener('mozpointerlockerror', function() {
                me.pointerLockError();
            }, false);   
            document.addEventListener('webkitpointerlockerror', function() {
                me.pointerLockError();
            }, false);
            document.addEventListener('contextmenu', function(e) { 
                if (me.mouse_over) {
                    e.preventDefault();
                }
            }, false);
            
            $(document).on('mouseenter', '#' + this.game.id + '_overlay', function(e) {
                me.mouse_enter(e);
            });
            $(document).on('mouseleave', '#' + this.game.id + '_overlay', function(e) {
                me.mouse_leave(e);
            });
            
        },
        
        mouse_enter: function(e) {
            this.mouse_over = true;
            this.event_fired('mouse_enter', e);
        },
        
        mouse_leave: function(e) {
            this.mouse_over = false;
            this.event_fired('mouse_leave', e);
        },
        
        /* fired when a mouse button is pressed */
        mouse_down: function(e) {
            e.preventDefault();
            this.event_fired('mouse_down', e);
        },
        
        mouse_click: function(e) {
            e.preventDefault();
            this.event_fired('mouse_click', e);
        },
        
        /* fired when a mouse button is let up */
        mouse_up: function(e) {
            e.preventDefault();
            this.event_fired('mouse_up', e);
        },
        
        /* fired when the mouse moves */
        mouse_move: function(e) {
            e.preventDefault();
            this.mouse_to_tile();
            this.update_mouse_pos(e);
            this.event_fired('mouse_move', e);
        },
        
        /* fired when mouse wheel scrolled*/
        mouse_wheel: function(e) {
            e.preventDefault();
        },

        /* fired when a key is pushed */
        key_down: function(e) {
            this.event_fired('key_down', e);
        },
        
        /* fired when a key is let up */
        key_up: function(e) {
            this.event_fired('key_up', e);
        },
        
        /* fired when the window gets resized */
        resize: function(e) {
            this.event_fired('resize', e);
        },
        
        /* add a hook */
        add_hook: function(object) {
            this.hooks.push(object);
        },
        
        /* delegates events to hooks */
        event_fired: function(event_name, e) {
            for (var i = 0; i < this.hooks.length; i++) {
                ob = this.hooks[i];
                if (typeof ob !== "undefined" && ob !== null) {
                    if (typeof ob[event_name] !== "undefined" && ob[event_name] !== null) {
                        ob[event_name](e);
                    }
                }
            }
        },
        
        /* updates the mouse_x and mouse_y coordinates in Game.events */
        update_mouse_pos: function(e) {
            if (this.game.viewport.has_mouse) {
                var movement_x = e.movementX ||
                    e.mozMovementX ||
                    e.webkitMovementX ||
                    0;

                var movement_y = e.movementY ||
                    e.mozMovementY ||
                    e.webkitMovementY ||
                    0;
                    
                this.mouse_x += movement_x;
                this.mouse_y += movement_y;
            } else {
                if (this.game.constants.FULLSCREEN) {
                    this.mouse_x = e.clientX;
                    this.mouse_y = e.clientY;
                }  else {
                    var offset = this.game.viewport.game_ele.offset();
                    this.mouse_x = e.pageX - offset.left;
                    this.mouse_y = e.pageY - offset.top;
                }
            }
            
            if (this.mouse_x < 0) {
                this.mouse_x = 0;
            } else if (this.mouse_x > this.game.constants.VIEW_WIDTH) {
                this.mouse_x = this.game.constants.VIEW_WIDTH;
            }
            
            if (this.mouse_y < 0) {
                this.mouse_y = 0;
            } else if (this.mouse_y > this.game.constants.VIEW_HEIGHT) {
                this.mouse_y = this.game.constants.VIEW_HEIGHT;
            }
        },
        
        /* fired whenever mouselock status changes */
        pointerLockChange: function(e) {
            if (document.mozPointerLockElement === elem ||
                document.webkitPointerLockElement === elem) {
                this.pointer_lock_gained(e);
                this.game.viewport.has_mouse = true;
                this.mouse_x = this.game.constants.VIEW_WIDTH/2;
                this.mouse_y = this.game.constants.VIEW_HEIGHT/2;
                var me = this;
                this.e_funct = function(e) { me.update_mouse_pos(e); }
                var me = this;
                document.addEventListener('mousemove', this.e_funct, false);
            } else {
                this.pointer_lock_lost(e);
                this.game.viewport.has_mouse = false;
                document.removeEventListener('mousemove', this.e_funct, false);
            }
        },
        
        /* fired when there is an error trying to get the mouse pointer */
        pointerLockError: function() {
            console.log('Error while locking pointer.');
        },
        
        /* fired when the game loses control of the mouse pointer */
        pointer_lock_lost: function(e) {
            this.event_fired('pointer_lock_lost', e);
        },
        
        /* fired when the game gains control of the mouse pointer */
        pointer_lock_gained: function(e) {
            this.event_fired('pointer_lock_gained', e);
        },   
        
        /* convert x, y mouse coordinates to tile coordinates */
        mouse_to_tile: function() {
            this.tile_x = -1 * parseInt((this.game.viewport.pan_x - this.mouse_x) / this.game.constants.TILE_WIDTH);
            this.tile_y = -1 * parseInt((this.game.viewport.pan_y - this.mouse_y) / this.game.constants.TILE_HEIGHT);
            if (this.tile_y >= this.game.constants.VIEW_HEIGHT/this.game.constants.TILE_HEIGHT) {
                this.tile_y = this.game.constants.VIEW_HEIGHT/this.game.constants.TILE_HEIGHT -1; 
            }
            if (this.tile_x >= this.game.constants.VIEW_WIDTH/this.game.constants.TILE_WIDTH) {
                this.tile_x = this.game.constants.VIEW_WIDTH/this.game.constants.TILE_WIDTH - 1;
            }
        },
    };
    this.viewport = {
        init: function() {
            /* turns true if the viewport has a mouse lock */
            this.has_mouse = false;
            
            /* how much the viewport has panned */
            this.pan_x = 0;
            this.pan_y = 0;
            
            /* how much the viewport should pan on next update */
            this.panning_x = 0;
            this.panning_y = 0;
            
            /* gather the HTML elements for this game instance */
            this.game_ele = $('#' + this.game.id); 
            this.overlay_ele = $('<div id="' + this.game.id + '_overlay"></div>');
            this.area_ele = $('<div id="' + this.game.id + '_area"></div');
    
            this.game_ele.data('game', this.game);
            
            /* set css */   
            this.overlay_ele.css('overflow', 'hidden');
            this.overlay_ele.css('left', 0);
            this.overlay_ele.css('top', 0);
            
            /* size game area */
            this.area_ele.css('left', 0);
            this.area_ele.css('top', 0);
            this.area_ele.css('position', 'absolute');

            /* add them to the DOM */
            this.overlay_ele.append(this.area_ele);
            this.game_ele.append(this.overlay_ele);
            /* hook into main game loop and event loop */
            this.game.events.add_hook(this);
            this.game.add_hook(this);
        },
        
        /* called when the window gets resized, by game.events*/
        resize: function() {
             /* check FULLSCREEN flag */
            if (this.game.constants.FULLSCREEN) {
                this.overlay_ele.css('position', 'fixed');
                this.game.constants.VIEW_WIDTH = $(window).width();
                this.game.constants.VIEW_HEIGHT = $(window).height();
            } else {
                this.overlay_ele.css('position', 'absolute');
            }

            /* the maximum distance the camera can pan */
            this.max_pan_x = this.game.constants.VIEW_WIDTH - this.game.constants.GAME_AREA_WIDTH;
            this.max_pan_y = this.game.constants.VIEW_HEIGHT - this.game.constants.GAME_AREA_HEIGHT;
            if (this.max_pan_x > 0) {
                this.max_pan_x = 0;
            }
            if (this.max_pan_y > 0) {
                this.max_pan_y = 0;
            }

            /* size game overlay */
            this.overlay_ele.css('width', this.game.constants.VIEW_WIDTH);
            this.overlay_ele.css('height', this.game.constants.VIEW_HEIGHT);    
        },
        
        /* call this when the game area changes size */
        resize_area: function() {
            this.area_ele.css('width', this.game.constants.GAME_AREA_WIDTH);
            this.area_ele.css('height', this.game.constants.GAME_AREA_HEIGHT);
        },
        
        /* change the viewport size */
        set_size: function(width, height) {
            this.game.constants.VIEW_WIDTH = width;
            this.game.constants.VIEW_HEIGHT = height;
            
            this.max_pan_x = this.game.constants.VIEW_WIDTH - this.game.constants.GAME_AREA_WIDTH;
            this.max_pan_y = this.game.constants.VIEW_HEIGHT - this.game.constants.GAME_AREA_HEIGHT;
            if (this.max_pan_x > 0) {
                this.max_pan_x = 0;
            }
            if (this.max_pan_y > 0) {
                this.max_pan_y = 0;
            }
            
            this.overlay_ele.css('width', this.game.constants.VIEW_WIDTH);
            this.overlay_ele.css('height', this.game.constants.VIEW_HEIGHT);        
        },
        
        /* this is called every time the mouse moves */
        mouse_move: function(e) {
            var offset;
            var mouse_x = this.game.events.mouse_x;
            var mouse_y = this.game.events.mouse_y;
            
            var margin = this.game.constants.PAN_MARGIN;
            var s_speed = this.game.constants.PAN_SPEED;
            if (mouse_x <= margin) {
                var diff = parseInt(((margin - mouse_x) / margin) * s_speed);
                if (diff > s_speed) {
                    diff = s_speed;
                }
                this.panning_x = diff;

            } else if (mouse_x >= this.game.constants.VIEW_WIDTH - margin) {
                
                var diff = s_speed - parseInt(((this.game.constants.VIEW_WIDTH - mouse_x)/margin) * s_speed);
                if (diff > s_speed) {
                    diff = s_speed;
                }
                
                this.panning_x = -1 * diff;
                
            } else {
                this.panning_x = 0;
            }
            
            if (mouse_y <= margin) {
                var diff = parseInt(((margin - mouse_y) / margin) * s_speed);
                if (diff > s_speed) {
                    diff = s_speed;
                }
                this.panning_y = diff;
            } else if (mouse_y >= this.game.constants.VIEW_HEIGHT - margin) {
                var diff = s_speed - parseInt(((this.game.constants.VIEW_HEIGHT - mouse_y)/margin) * s_speed)
                
                if (diff > s_speed) {
                    diff = s_speed;
                }
                
                this.panning_y = -1 * diff;

            } else {
                this.panning_y = 0;
            }
        },
        
        /* this is called whenever the screen needs to pan */
        pan: function() {
            this.pan_x += this.panning_x;
            this.pan_y += this.panning_y;
           
           if (this.pan_x > 0) {
                this.pan_x = 0;
            } else if (this.pan_x < this.max_pan_x) {
                this.pan_x = this.max_pan_x;
            }

            if (this.pan_y > 0) {
                this.pan_y = 0;
            } else if (this.pan_y < this.max_pan_y) {
                this.pan_y = this.max_pan_y;
            }
            this.move(this.pan_x, this.pan_y);
        },
        
        /* moves the viewport to x, y */
        move: function(x, y) {
            this.area_ele.css('left', x);
            this.area_ele.css('top', y);
        },
        
        /* this is called every frame from game.update()*/
        update: function(delta) {
            /* check if we need to pan */
            if (this.game.constants.PAN && (this.panning_x != 0 || this.panning_y != 0)) {
                this.pan();
            }
        },
        
        /* call this to request the mouse lock */
        request_lock: function() {
            elem = this.game_ele[0];   
            elem.requestPointerLock = elem.requestPointerLock    ||
                elem.mozRequestPointerLock ||
                elem.webkitRequestPointerLock;             
            if (elem.requestPointerLock) {
                elem.requestPointerLock();
            } else {
                console.log('Pointer lock failed');
            }
        },
        
        /* called when the game starts */
        start: function() {
            this.resize();
            this.resize_area();
        }
    };
    this.draw = {
        init: function() {
            this.layers = {};
            this.animations = [];
            this.game.add_hook(this);
            this.game.events.add_hook(this);
        },
        
        /* create a new canvas layer */
        add_layer: function(name, overlay, persistant) {
            var canvas = $('<canvas id="' + this.game.id + '_can_' + name + '">');
            canvas.css('position', 'absolute');
            canvas.css('left', 0);
            canvas.css('top', 0);
            var ctx = canvas[0].getContext('2d'); 
            
            // set persistance
            if (persistant) {
                canvas.data('persistant', true);
            } else {
                canvas.data('persistant', false);
                canvas.data('cleared', false);
            }
            
            // set canvas size and add it to the document
            if (overlay) {
                canvas.attr('width', this.game.constants.VIEW_WIDTH);
                canvas.attr('height', this.game.constants.VIEW_HEIGHT);
                canvas.data('view', 'overlay');
                this.game.viewport.overlay_ele.append(canvas);
            } else {
                canvas.attr('width', this.game.constants.GAME_AREA_WIDTH);
                canvas.attr('height', this.game.constants.GAME_AREA_HEIGHT);
                canvas.data('view', 'background');
                this.game.viewport.area_ele.append(canvas);
            }
            
            // add the layer to the draw manager
            this.layers[name] = canvas;
            
            // set the mip-maping
            this.set_mip_mapping(name);
        },
        
        /* draw an image to a layer */
        image: function(image_name, layer_name, x, y, w, h, r) {
            var img = this.game.resources.images[image_name];
            var lay = this.layers[layer_name];
            if (img && lay) {
                if (x == null) {
                    x = 0;
                }
                if (y == null) {
                    y = 0;
                }
                if (r == null && h == null && w) {
                    r = w;
                    w = this.game.resources.images[image_name].width;
                    h = this.game.resources.images[image_name].height;
                }
                if (w == null) {
                    w = this.game.resources.images[image_name].width;
                }
                if (h == null) {
                    h = this.game.resources.images[image_name].height;
                }
                if (r == null) {
                    r = 0;
                }

                var ctx = lay[0].getContext('2d');
                
                if (r == 0) {
                    if (this.layers[layer_name].data('persistant') == false) {
                        this.layers[layer_name].data('cleared', false);
                    }
                    return ctx.drawImage(img, x, y, w, h);
                } else {
                    ctx.save();
                    ctx.translate(x + (w/2), y+(h/2));
                    ctx.rotate(r);
                    ctx.drawImage(img, -(w/2), -(h/2), w, h);
                    ctx.restore();
                    if (this.layers[layer_name].data('persistant') == false) {
                        this.layers[layer_name].data('cleared', false);
                    }
                    return true;
                }
            }
            return false;
        },
        
        /* draw just a part of an image */
        sub_image: function(img_name, layer_name, x, y, w, h, offset_x, offset_y, offset_w, offset_h, r) {
            var img = this.game.resources.images[img_name];
            var lay = this.layers[layer_name];
            if (r == null) {
                r = 0;
            }
            if (img && lay) {
                var ctx = this.layers[layer_name][0].getContext('2d');
                
                if (r == 0) {
                    ctx.drawImage(img, offset_x, offset_y, offset_w, offset_h, x, y, w, h);
                    return true;
                } else {
                    ctx.save();
                    ctx.translate(x + (w/2), y+(h/2));
                    ctx.rotate(r);
                    ctx.drawImage(img, offset_x, offset_y, offset_w, offset_h, -(w/2), -(h/2), w, h);
                    ctx.restore();
                    return true;
                }

            }
            return false;
        },
        
        /* draw a sub frame of a sprite */    
        sub_sprite: function(sprite_name, layer_name, sub_sprite, x, y, w, h, r) {
            var sprite = this.game.resources.sprites[sprite_name];
            var img = this.game.resources.images[sprite_name];
            var lay = this.layers[layer_name];
            if (w == null) {
                w = this.game.constants.TILE_WIDTH;
            }
            if (h == null) {
                h = this.game.constants.TILE_HEIGHT;
            }
            if (r == null) {
                r = 0;
            }
            if (sprite && img && lay) {
                var ctx = this.layers[layer_name][0].getContext('2d');
                var off_h = img.height/sprite.clips_y;
                var off_w = img.width/sprite.clips_x;
                var off_x = (sub_sprite % sprite.clips_x) * off_w;
                var off_y = Math.floor(sub_sprite / (sprite.clips_x)) * off_h;
                if (r == 0) {
                    ctx.drawImage(img, off_x, off_y, off_w, off_h, x, y, w, h);
                    return true;
                } else {
                    ctx.save();
                    ctx.translate(x + (w/2), y+(h/2));
                    ctx.rotate(r);
                    ctx.drawImage(img, off_x, off_y, off_w, off_h, -(w/2), -(h/2), w, h);
                    ctx.restore();
                    return true;
                }
            }
            return false;
        },
        
        /* draw a rectangle on the map */
        rectangle: function(layer, x, y, w, h, color, fill, fill_alpha) {
            var ctx = this.layers[layer][0].getContext('2d');
            ctx.save();
            ctx.beginPath();
            ctx.rect(x, y, w, h);
            if (fill) {
                ctx.fillStyle = fill;
                if (fill_alpha) {
                    ctx.globalAlpha = fill_alpha;
                }
                ctx.fillRect(x, y, w, h);
            }
            ctx.globalAlpha = 1;
            ctx.lineWidth = 1;
            ctx.strokeStyle = color;
            ctx.stroke();
            ctx.restore();
            if (this.layers[layer].data('persistant') == false) {
                this.layers[layer].data('cleared', false);
            }
        },
        
        /* draw text to a layer */
        text: function(text, layer, x, y, color, size, font) {
            var ctx = this.layers[layer][0].getContext('2d');
            if (!color) {
                color = 'black'
            }
            if (!size) {
                size = 12;
            }
            if (!font) {
                font = 'Arial';
            }            
            
            ctx.save();
            ctx.fillStyle = color;
            ctx.font =  size + 'px ' + font,
            y = y+size;
            ctx.fillText(text, x, y);
            ctx.restore();
        },
        
        /* clear a rectangle on a layer */
        clear_rectangle: function(layer, x, y, w, h, r) {
            var ctx = this.layers[layer][0].getContext('2d');
            if (r == null || r == 0) {
                return ctx.clearRect(x, y, w, h);
            }
            ctx.save();
            ctx.translate(x + (w/2), y+(h/2));
            ctx.rotate(r);
            ctx.clearRect(-(w/2), -(h/2), w, h);
            ctx.restore();
        },
        
        /* clear a whole layer */
        clear_layer: function(layer) {
            var ctx = this.layers[layer][0].getContext('2d');
            ctx.clearRect(0, 0, this.game.constants.VIEW_WIDTH, this.game.constants.VIEW_HEIGHT);
            this.layers[layer].data('cleared', true);
        },
        
        /* draw a sprite to a layer */
        animation: function(sprite_name, layer, type, speed, x, y, w, h, r) {
            if (this.game.resources.images[sprite_name]) {
                if (this.game.resources.sprites[sprite_name]) {
                    if (type == null) {
                        type = 'loop';
                    }
                     if (x == null) {
                        x = 0;
                    }
                    if (y == null) {
                        y = 0;
                    }
                    if (w == null) {
                        w = this.game.resources.images[sprite_name].width/this.game.resources.sprites[sprite_name].clips_x;
                    }
                    if (h == null) {
                        h = this.game.resources.images[sprite_name].height/this.game.resources.sprites[sprite_name].clips_y;
                    }
                    if (speed == null) {
                        speed = 100;
                    }
                    if (r == null) {
                        r = 0;
                    }
                    var anim = new Animation(this.game, sprite_name, layer, x, y, w, h, speed, r, type);
                    this.animations.push(anim);
                    return anim;
                } else {
                    return false;
                }
            }
            return false
        },
        
        /* called when the window gets resized */
        resize: function() {
            for (layer in this.layers) {
                if (this.layers[layer].data('view') == 'overlay') {
                    this.layers[layer].attr('width', this.game.constants.VIEW_WIDTH);
                    this.layers[layer].attr('height', this.game.constants.VIEW_HEIGHT);
                    this.set_mip_mapping(layer);
                }
            }
        },
        
        resize_area: function() {
            for (layer in this.layers) {
                if (this.layers[layer].data('view') == 'background') {
                    this.layers[layer].attr('width', this.game.constants.GAME_AREA_WIDTH);
                    this.layers[layer].attr('height', this.game.constants.GAME_AREA_HEIGHT);
                    this.set_mip_mapping(layer);
                }
            }
        },
        
        /* set the mip-mapping */
        set_mip_mapping: function(layer) {
            var ctx = this.layers[layer][0].getContext('2d'); 
            ctx.imageSmoothingEnabled = this.game.constants.MIP_MAPPING;
            ctx.mozImageSmoothingEnabled = this.game.constants.MIP_MAPPING;
            ctx.webkitImageSmoothingEnabled = this.game.constants.MIP_MAPPING;
        },
        
        /* this is called every frame from game.update()*/
        update: function(delta) {
            /* update all of the animations */
            for (var i = 0; i < this.animations.length; i++) {
                var anim = this.animations[i];
                anim.frame_update(delta);
                anim.draw();
            }
            
            /* clear all non-persistant layers (if necessary) */
            for (layer in this.layers) {
                if (this.layers[layer].data('persistant') == false) {
                    if (this.layers[layer].data('cleared') == false) {
                        this.clear_layer(layer);
                    }
                }
            }
        },
        
        /* called when the game starts */
        start: function() {
            this.resize();
            this.resize_area();
        }
    };
    this.map = {
        init: function() {
            this.tiles = {};
            this.collision_layers = {};
            this.loaded = false;
            this.map = [];
            
            this.layer = 'background';
            this.sprite = 'colors';
            
            this.width = 0;
            this.height = 0;
        },
        
        /* load a map which corresponds to given sprite */   
        load_sprite_map: function(layer, sprite_name, map) {
            this.sprite = sprite_name;
            this.map = map;
            
            this.width = map.length;
            this.height = map[0].length;

            console.log(this.width);
            
            for (var i = 0; i < map.length; i++) {
                for(var j = 0; j < map[i].length; j++) {
                    this.game.draw.sub_sprite(this.sprite, layer, map[i][j], j * this.game.constants.TILE_WIDTH, i * this.game.constants.TILE_HEIGHT);
                }
            }
        },
    };
  
    /* give managers a parent reference (not all need one) */
    this.events.game = this;
    this.viewport.game = this;
    this.draw.game = this;
    this.map.game = this;
    
    /* initialize the managers*/
    this.resources.init();
    this.events.init();
    this.viewport.init();
    this.draw.init();
    this.map.init();
}

/* starts the game */
Game.prototype.start = function(callback) { 
    /* set time info */
    var d = new Date(); 
    this.time = d.getTime();
    this.time_started = this.time;
    this.started = true;
    this.viewport.start();
    this.draw.start();
    /* handle callbacks and begin update() loop */
    var me = this;
    var cb = callback;
    this.resources.load(function() { 
        me.update(me);
        if (cb) {
            cb();
        }
    });
},

/* pause the game */
Game.prototype.pause = function() {
    if (!this.paused && this.started) {
        this.paused = true;
    }
},

/* unpause the game */
Game.prototype.unpause = function() {
    if (this.paused && this.started) {
        var d = new Date();
        this.time = d.getTime();
        this.paused = false;
        this.update(this);
    }
},

/* change the game speed */
Game.prototype.set_speed = function() {
    this.constants.GAME_SPEED = speed;
},

/* add a hook to the main game loop */
Game.prototype.add_hook = function(hook) {
    if (typeof hook.update === 'function') {
        
        this.hooks.push(hook);
        return true;
    }
    return false;
},

/* the main game loop */
Game.prototype.update = function(me) {
    if (!me.paused && me.started) {
        var now = new Date().getTime();
        var delta = (now - (me.time || now)) * me.constants.GAME_SPEED;
        me.time = now;
        
        if (me.hooks) {
            for (var i = 0; i < me.hooks.length; i++) {
                me.hooks[i].update(delta);
            }
        }
        requestAnimationFrame(function() { me.update(me); });
    }
}
function Sprite(name, clip_size_x, clip_size_y) {
    this.name = name;
    this.clips_x = clip_size_x;
    this.clips_y = clip_size_y;
}
function Animation(game, sprite_name, layer, x, y, w, h, speed, rotation, type) {
    this.game = game;
    this.sprite = this.game.resources.sprites[sprite_name];
    this.layer = layer;
    
    this.x = x;
    this.y = y;
    this.width = w;
    this.height = h;
    this.rotation = rotation;
    
    this.offset_height = this.game.resources.images[sprite_name].height/this.sprite.clips_y;
    this.offset_width = this.game.resources.images[sprite_name].width/this.sprite.clips_x;
    
    this.clips = [this.sprite.clips_x,  this.sprite.clips_y];
    this.clip = [0, 0];
    
    this.total_frames = this.clips[0] * this.clips[1];
    
    this.paused = false;
    this.flip = true;
    this.speed = speed;
    
    this.type = type;
    this.frame = 0;
    this.time = 0;
    this.needs_draw = true;
    this.drawn = false;
}
Animation.prototype.clear = function() {
    this.game.draw.clear_rectangle(this.layer, this.x, this.y, this.width, this.height, this.rotation);
    this.drawn = false;
    this.needs_draw = true;
}
Animation.prototype.clip_increment = function(amount) {
    if (this.type == 'loop') {
        this.frame = ((this.frame + amount) % this.total_frames);
        var x = (this.frame % this.clips[0]);
        var y = Math.floor(this.frame / this.clips[0]);
        this.clip = [x, y];
        this.needs_draw = true;
    } else if (this.type == 'flip') {
        if (this.flip) {
            this.frame = this.frame + amount;
            if (this.frame >= this.total_frames) {
                this.frame = this.total_frames - 1;
            } else {
                this.needs_draw = true;
            }
            var x = (this.frame % this.clips[0]);
            if (this.clips[1] != 1) {
            var y = Math.floor(this.frame / this.clips[1]);
        } else {
            var y = 0;
        }
            this.clip = [x, y];
        } else {
            this.frame = this.frame - amount;
            if (this.frame <= 0) {
                this.frame = 0;
            } else {
                this.needs_draw = true;
        }
        var x = (this.frame % this.clips[0]);
        if (this.clips[1] != 1) {
            var y = Math.floor(this.frame / this.clips[1]);
        } else {
            var y = 0;
        }
        this.clip = [x, y];
        }
    } else if (this.type == 'property') {
        if (this.frame != this.prop['prop']) {
            this.frame = this.prop['prop'];
            if (this.frame >= this.total_frames) {
                this.frame = this.total_frames - 1;
            } else {
                this.needs_draw = true;
            }
            var x = (this.frame % this.clips[0]);
            if (this.clips[1] != 1) {
                var y = Math.floor(this.frame / this.clips[1]);
            } else {
                var y = 0;
            }
            this.clip = [x, y];
        } else {
            this.needs_draw = false;
        }
    }
    return this.frame;
}
Animation.prototype.frame_update = function(delta) {
    this.time += delta;
    var lapse = Math.floor(this.time / this.speed);
    
    if (lapse > 0) {
        this.clip_increment(lapse);
        this.time %= this.speed;
    }
}
Animation.prototype.draw = function() {
    if (this.needs_draw) {
        var offset_x = this.clip[0] * this.offset_width;
        var offset_y = this.clip[1] * this.offset_height;
        if (this.drawn) {
            this.clear();
        }
        this.drawn = this.game.draw.sub_image(this.sprite.name, this.layer, this.x, this.y, this.width, this.height, offset_x, offset_y, this.offset_width, this.offset_height, this.rotation);
        this.needs_draw = !this.drawn;
    }
    return this.needs_draw;
}
Animation.prototype.rotate = function(rotation) {
    if (this.drawn) {
        this.clear();
    }
    this.rotation += rotation;
}
Animation.prototype.move = function(new_x, new_y) {
    if (this.drawn) {
        this.clear();
    }
    this.x += new_x;
    this.y += new_y;
}
