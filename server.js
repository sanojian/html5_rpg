var WebSocketServer = require('websocket').server;
var http = require('http');

var g_connections = [];
var g_dataQueue = [];
var g_idCount = 0;

var MOB = function(myId, locX, locY) {
	var self = this;
	self.id = myId;
	self.originX = self.x = locX;
	self.originY = self.y = locY;
	self.speed = 1;
	self.direction = { x: 1, y: 1};
	
	self.move = function(framesSpent) {
		self.x = self.x + self.direction.x * self.speed * framesSpent;
		self.y = self.y + self.direction.y * self.speed * framesSpent;
		if (Math.abs(self.x - self.originX) > 100) {
			self.direction.x = 0 - self.direction.x;
			g_dataQueue.push('' + GAME_CONSTANTS.MSG_POSITION + '|' + self.id + '|' + self.x 
				+ '|' + self.y + '|' + self.direction.x + '|' + self.direction.y + '|' + self.speed);
			g_dataQueue.push('' + GAME_CONSTANTS.MSG_SPEECH + '|' + self.id + '|woops... too far');
		}
		if (Math.abs(self.y - self.originY) > 150) {
			self.direction.y = 0 - self.direction.y;
			g_dataQueue.push('' + GAME_CONSTANTS.MSG_POSITION + '|' + self.id + '|' + self.x + '|' + self.y 
				+ '|' + self.direction.x + '|' + self.direction.y + '|' + self.speed);
		}
	};
};

var g_mobs = [];
g_mobs.push(new MOB(g_idCount, 300, 300));
g_mobs.push(new MOB(g_idCount, 300, 500));
g_idCount++;

	
var GAME_CONSTANTS = {
	MSG_GET_ID: 0,
	MSG_PLAYER_INFO: 1,
	MSG_DISCONNECT: 2,
	MSG_SPEECH: 3,
	MSG_POSITION: 4,
	
	IMAGE_PLAYER: 0,
	IMAGE_MOB: 1
}
	

var server = http.createServer(function(request, response) {
    console.log((new Date()) + ' Received request for ' + request.url);
    response.writeHead(404);
    response.end();
});
server.listen(8080, function() {
    console.log((new Date()) + ' Server is listening on port 8080');
});

wsServer = new WebSocketServer({
    httpServer: server,
    // You should not use autoAcceptConnections for production
    // applications, as it defeats all standard cross-origin protection
    // facilities built into the protocol and the browser.  You should
    // *always* verify the connection's origin and decide whether or not
    // to accept it.
    autoAcceptConnections: false
});

function originIsAllowed(origin) {
  // put logic here to detect whether the specified origin is allowed.
  return true;
}

function doGameLoop() {
	// copy data queue	
	var snapShotQueue = g_dataQueue;
	g_dataQueue = [];

	for (var i=0;i<g_mobs.length;i++) {
		g_mobs[i].move(50/4);	// 50FPS * 1/4 second
	}
	
	for (var i=0;i<g_connections.length;i++) {
		for (var j=0;j<snapShotQueue.length;j++) {
			g_connections[i].connection.sendUTF(snapShotQueue[j]);
		}
	}
	setTimeout(function() { doGameLoop(); }, 250);
}

doGameLoop();

wsServer.on('request', function(request) {
    if (!originIsAllowed(request.origin)) {
      // Make sure we only accept requests from an allowed origin
      request.reject();
      console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
      return;
    }

    var connection = request.accept('game-protocol', request.origin);
	var id = g_idCount++;
	g_connections.push({ id: id, connection: connection });
	
	g_dataQueue.push('' + GAME_CONSTANTS.MSG_PLAYER_INFO + '|' + id + '|0|0|0|0|' + GAME_CONSTANTS.IMAGE_PLAYER);
	
    console.log((new Date()) + ' Connection accepted.');
	
	// send id
	connection.sendUTF('' + GAME_CONSTANTS.MSG_GET_ID + '|-1|' + id); 

	for (var i=0;i<g_mobs.length;i++) {
		// send all mobs to new player
		connection.sendUTF('' + GAME_CONSTANTS.MSG_PLAYER_INFO + '|' + g_mobs[i].id + '|' + g_mobs[i].x + '|' + g_mobs[i].y 
			+ '|' + g_mobs[i].direction.x + '|' + g_mobs[i].direction.y + '|' + g_mobs[i].speed + '|' + GAME_CONSTANTS.IMAGE_MOB);
	}

	for (var i=0;i<g_connections.length;i++) {
		// send all current players to new player
		connection.sendUTF('' + GAME_CONSTANTS.MSG_PLAYER_INFO + '|' + g_connections[i].id + '|0|0|0|0|' + GAME_CONSTANTS.IMAGE_PLAYER);
	}
	
    console.log('All data sent');
	
    connection.on('message', function(message) {
        if (message.type === 'utf8') {
            console.log('Received Message: ' + message.utf8Data);
			var parts = message.utf8Data.split('|');
			var type = parts[0];
			if (type == GAME_CONSTANTS.MSG_SPEECH) {
				var msg = parts[1];
				g_dataQueue.push('' + GAME_CONSTANTS.MSG_SPEECH + '|' + id + '|' + msg);
			}
			if (type == GAME_CONSTANTS.MSG_POSITION) {
				var x = parts[1];
				var y = parts[2];
				var dirX = parts[3];
				var dirY = parts[4];
				g_dataQueue.push('' + GAME_CONSTANTS.MSG_POSITION + '|' + id + '|' + x + '|' + y + '|' + dirX + '|' + dirY + '|2');
			}
        }
        else if (message.type === 'binary') {
            console.log('Received Binary Message of ' + message.binaryData.length + ' bytes');
            connection.sendBytes(message.binaryData);
        }
    });
    connection.on('close', function(reasonCode, description) {
		g_connections.splice(g_connections.indexOf(connection), 0);
		g_dataQueue.push('' + GAME_CONSTANTS.MSG_DISCONNECT + '|' + id + '|');
        console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
    });
});