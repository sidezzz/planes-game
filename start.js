var borderX = 800;
var borderY = 800;
var SpeedLimit = 350;
var PlayerName = "noname";
function rnd(min, max) {
    var ret = Math.random() * (max - min) + min;
    return ret ? ret : 1;
}
function rotatePoint(x, y, angle) { 
    var newX = x * Math.cos(angle) - y * Math.sin(angle);
    var newY = y * Math.cos(angle) + x * Math.sin(angle);
    return { x: newX, y: newY };
}
var planeImage = new Image();
planeImage.src = "plane2.png";
function addActor(lvl) {
    var RndX = 0;
    var RndY = 0;
    var xSpeed = 0;
    var ySpeed = 0;
    var Xaxis = Math.random() < 0.5;
    //spawn on x or y axis
    if (Xaxis) {
        //spawn on x axis
        RndX = Math.floor(Math.random() * borderX);
        xSpeed = rnd(-SpeedLimit, SpeedLimit);
        var r = Math.random() < 0.5;
        if (r) {
            RndY = borderY;
            ySpeed = rnd(-1, -SpeedLimit);
        }
        else {
            RndY = 0;
            ySpeed = rnd(1, SpeedLimit);
        }
    }
    else {
        //spawn on y axis
        RndY = Math.floor(Math.random() * borderY);
        ySpeed = rnd(-SpeedLimit, SpeedLimit);
        var r = Math.random() < 0.5;
        if (r) {
            RndX = borderX;
            xSpeed = rnd(-1, -SpeedLimit);
        }
        else {
            RndX = 0;
            xSpeed = rnd(1, SpeedLimit);
        }
    }
    var ang = Math.atan(1 / (xSpeed / ySpeed));
    if (xSpeed < 0)
        ang += Math.PI;
    var rndSize=rnd(2,30)*0.1;
    var Actr = {
        x: RndX, y: RndY, xspd: xSpeed, yspd: ySpeed, sizeX: planeImage.width*rndSize, 
        sizeY: planeImage.height*rndSize, angle: ang, reward:10/rndSize,
        draw: function (lvl) {
            lvl.ctx.setTransform(1, 0, 0, 1, this.x, this.y);
            lvl.ctx.rotate(ang);
            lvl.ctx.drawImage(planeImage, -this.sizeX / 2, -this.sizeY / 2, this.sizeX, this.sizeY);
            lvl.ctx.rotate(-ang);
        },
        process: function (lvl, frameTime) {
            //update plane coords
            this.x += this.xspd * frameTime / 1000;
            this.y += this.yspd * frameTime / 1000;
            //console.log("Process actor");
            if (this.x > borderX || this.y > borderY || this.x < 0 || this.y < 0) {

                //console.log("Delete actor");
                return 1;
            }
            return 0;
        },
        isInMouse: function (x, y) {
            var point = rotatePoint(x - this.x, y - this.y, -this.angle);
            //translate mouse coords to plane space
            //console.log("Translated: "+point.x+" "+point.y+" "+this.angle);
            x = point.x;
            y = point.y;
            return (x < this.sizeX / 2 && x > -this.sizeX / 2 && y < this.sizeY / 2 && y > -this.sizeY / 2)?this.reward:0;
        }
    };

    lvl.actors.push(Actr);
}

var level = {
    ctx: null, canvas: null, actors: [], score: 0, time: 0,
    process: function (frameTime) {
        //console.log("Processing");
        if (this.time > 60)
            menu.enable();
        if (!menu.enabled) {
            this.time += frameTime / 1000;
            if (this.actors.length < 10 && Math.floor(Math.random() * borderX) % 33 == 0) {
                //generate plane
                addActor(this);
            }
            for (var a = 0; a < this.actors.length; a++) {
                if (this.actors[a].process(this, frameTime)) {
                    this.actors.splice(a, 1);
                    //delete plane that out of bound
                    a--;
                }
            }
        }
    },
    draw: function () {
        //console.log("Drawing");

        if (!menu.enabled || !menu.alreadyDrawen) {
            //not redraw planes if they already drawen
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            for (var a = 0; a < this.actors.length; a++) {
                this.actors[a].draw(this);
            }
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            //restore transform
            this.ctx.font = '48px serif';
            var score = "Score: " + this.score + " Time: " + parseInt(this.time);
            this.ctx.fillText(score, borderX / 2 - this.ctx.measureText(score).width / 2, borderY - 20);
        }
        menu.draw();
    }
};

function mouseDown(event) {
    console.log("Мышь нажата: " + event.layerX + " " + event.layerY);
    //console.log(event);
    menu.process(event.layerX, event.layerY);
    if (!menu.enabled) {
        for (var a = 0; a < level.actors.length; a++) {
            if (level.actors[a].isInMouse(event.layerX, event.layerY)) {
                console.log("Delete actor in  Mouse");
                level.score += parseInt(level.actors[a].reward);//10;
                level.actors.splice(a, 1);
                a--;
            }
        }
    }
}

function keyDown(keyEvent) {
    /*console.log(keyEvent);
    if (keyEvent.key.length == 1) {
        console.log(keyEvent.key);
    }*/
    if (keyEvent.keyCode == 27) {//(keyEvent.key == "Escape") {
        //menu opens on Escape
        if (menu.enabled) {
            menu.disable();
        }
        else if (!menu.enabled) {
            menu.enable();
        }
    }
}

function addButton(menu, txt, click) {
    if (!click)
        click = function () { };
    var element = {
        text: txt, x: 0, y: 0, sizeX: 0, sizeY: 0, onclick: click,
        draw: function (x, y, sizeX, sizeY) {
            //button drawing
            this.x = x;
            this.y = y;
            this.sizeX = sizeX;
            this.sizeY = sizeY;
            var size = level.ctx.measureText(this.text);

            level.ctx.beginPath();
            level.ctx.rect(x, y, sizeX, sizeY);
            level.ctx.fillStyle = "#FF0000";
            level.ctx.fill();//Rect(this.x + 1, this.y + 1, this.sizeX - 1, this.sizeY - 1);
            level.ctx.fillStyle = "#000000";
            level.ctx.stroke();
            level.ctx.closePath();
            level.ctx.fillText(this.text, x + sizeX / 2 - size.width / 2, y + sizeY / 2);
        },
        isInMouse: function (x, y) {
            return (x < this.x + this.sizeX && x > this.x && y < this.y + this.sizeY && y > this.y);
        }
    };
    menu.sizeY += 50;
    menu.elements.push(element);
    return element;
}

var menu = {
    elements: [], sizeY: 50, enabled: 0, alreadyDrawen: 0,
    draw: function () {
        if (this.enabled && !this.alreadyDrawen) {
            //drawing optimization
            level.ctx.font = '20px serif';
            var x = borderX * 0.2;
            var y = borderY * 0.15;
            var sizeX = borderX * 0.6;
            var sizeY = borderY * 0.1;
            if (this.drawingOverride) {
                //if u need to draw smth another in menu(for example to draw leaderboard)
                this.drawingOverride(x, y, sizeX, sizeY);
            }
            else {
                for (var a = 0; a < this.elements.length; a++) {
                    this.elements[a].draw(x, y, sizeX, sizeY);
                    y += sizeY;
                }
            }
            this.alreadyDrawen = 1;
        }
    },
    process: function (x, y) {

        if (this.enabled) {
            if (this.processOverride) {
                //if u need to process smth another in menu(for example to hide leaderboard on click)
                this.processOverride(x, y);
            }
            else {
                for (var a = 0; a < this.elements.length; a++) {
                    if (this.elements[a].isInMouse(x, y)) {
                        this.elements[a].onclick();
                        return;
                    }
                }
            }
        }
    },
    enable: function () {
        this.enabled = 1;
    },
    disable: function () {
        this.alreadyDrawen = 0;
        this.enabled = 0;
        this.processOverride = null;
        this.drawingOverride = null;
    },
    drawingOverride: null,
    processOverride: null
};

addButton(menu, "Restart", function () {
    for (var a = level.actors.length; a != -1; a--) {
        level.actors.pop();
    }
    level.score = 0;
    level.time = 0;
    menu.disable();
});
addButton(menu, "Show leaderbords", function () {
    var req = new XMLHttpRequest();
    req.open("POST", "http://127.0.0.1:8000/", false);
    req.send("GIVE ME LEADERBOARD");
    var leaderboard = JSON.parse(req.responseText);
    console.log(leaderboard);
    menu.alreadyDrawen = 0;
    menu.drawingOverride = function (x, y, sizeX, sizeY) {
        sizeY = 30;
        level.ctx.clearRect(x, y, sizeX, sizeY * (leaderboard.length + 1));
        level.ctx.beginPath();
        level.ctx.rect(x, y, sizeX, sizeY);
        level.ctx.stroke();
        level.ctx.closePath();

        level.ctx.fillText("Place", x + 10, y + 20);
        level.ctx.fillText("Name", x + sizeX / 2 - 15, y + 20);
        var sz = level.ctx.measureText("Score").width;
        level.ctx.fillText("Score", x + sizeX - 10 - sz, y + 20);
        y += sizeY;
        for (var a = 0; a < leaderboard.length; a++) {
            level.ctx.beginPath();
            level.ctx.rect(x, y, sizeX, sizeY);
            level.ctx.stroke();
            level.ctx.closePath();
            level.ctx.fillText(a + 1, x + 10, y + 20);
            level.ctx.fillText(leaderboard[a].name, x + sizeX / 2 - 15, y + 20);
            sz = level.ctx.measureText(leaderboard[a].score).width;
            level.ctx.fillText(leaderboard[a].score, x + sizeX - 10 - sz, y + 20);
            y += sizeY;
        }
    }
    menu.processOverride = function (x, y) {
        this.alreadyDrawen = 0;
        this.processOverride = null;
        if (this.drawingOverride)
            this.drawingOverride = null;
    }

});
addButton(menu, "Your name: " + PlayerName, function () {
    PlayerName = prompt("Please enter your name", PlayerName);
    if (PlayerName.length > 20)
        PlayerName = PlayerName.substr(0, 19);
    PlayerName = PlayerName.replace(/ /g, "_");
    this.text = "Your name: " + PlayerName;
    menu.alreadyDrawen = 0;
});
addButton(menu, "Save result", function () {
    var req = new XMLHttpRequest();
    req.open("POST", "http://127.0.0.1:8000/", false);
    req.send("SAVE RESULT " + "playername: " + PlayerName + " score: " + level.score + " \n");
    console.log(req.responseText);

});


level.canvas = document.getElementById("canvasId");
level.ctx = level.canvas.getContext("2d");
resizeCanvas();
level.canvas.addEventListener("mousedown", mouseDown);
document.body.addEventListener("keydown", keyDown);
window.addEventListener('resize', resizeCanvas, false);
window.requestAnimationFrame(loop);


function resizeCanvas() {
    level.canvas.width = window.innerWidth - 25;
    level.canvas.height = window.innerHeight - 25;
    borderX = level.canvas.width;
    borderY = level.canvas.height;
    menu.alreadyDrawen = 0;
}
function loop(timestamp) {
    var frameTime = timestamp - lastRender;
    lastRender = timestamp;
    //console.log(frameTime);
    level.process(frameTime);
    level.draw();
    window.requestAnimationFrame(loop);
}
var lastRender = 0;

