var WebSocketServer = require('websocket').server;
var http = require('http');

var g_connections = [];
var g_dataQueue = [];
var g_idCount = 0;

var i = 1;
var g_game = {

	MESSAGE_TYPES: {
		CLIENT: {
			GET_ENTITIES: i++,
			GET_INVENTORY: i++,
			INVENTORY_UPDATE: i++
		},
		SERVER: {
			PRESENCE: i++,
			STATUS: i++,
			INVENTORY: i++,
			EFFECTS: i++
		},
		SHARED: {
			GET_ID: i++,
			LOCATION: i++,
			ACTION: i++,
			SPELL: i++,
			SPEECH: i++
		}
	}
};
i = undefined;


/*var MOB = function(myId, locX, locY) {
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
//g_mobs.push(new MOB(g_idCount, 300, 300));
//g_mobs.push(new MOB(g_idCount, 300, 500));
*/
g_idCount++;

	
var GAME_CONSTANTS = {
	MSG_DISCONNECT: 2,
	
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
	// copy data queue at this point in time
	var snapShotQueue = g_dataQueue;
	g_dataQueue = [];

	/*for (var i=0;i<g_mobs.length;i++) {
		g_mobs[i].move(50/4);	// 50FPS * 1/4 second
	}*/
	
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
	
	// send id
	connection.sendUTF(JSON.stringify({
		type: g_game.MESSAGE_TYPES.SHARED.GET_ID,
		entityId: id
	}));

	g_dataQueue.push(JSON.stringify( {
		type: g_game.MESSAGE_TYPES.SERVER.PRESENCE,
		entityId: id,
		x: 0,
		y: 0,
		dirX: 0,
		dirY: 0,
		speed: 2
	}));
	
    console.log((new Date()) + ' Connection accepted.');

	/*for (var i=0;i<g_mobs.length;i++) {
		// send all mobs to new player
		connection.sendUTF('' + GAME_CONSTANTS.MSG_PLAYER_INFO + '|' + g_mobs[i].id + '|' + g_mobs[i].x + '|' + g_mobs[i].y 
			+ '|' + g_mobs[i].direction.x + '|' + g_mobs[i].direction.y + '|' + g_mobs[i].speed + '|' + GAME_CONSTANTS.IMAGE_MOB);
	}*/

    console.log('All data sent');
	
    connection.on('message', function(origMessage) {
        if (origMessage.type === 'utf8') {
            console.log('Received Message: ' + origMessage.utf8Data);
			var message = JSON.parse(origMessage.utf8Data);
			if (message.type == g_game.MESSAGE_TYPES.SHARED.SPEECH) {
				g_dataQueue.push(JSON.stringify({
					type: g_game.MESSAGE_TYPES.SHARED.SPEECH,
					entityId: id,
					text: message.text
				}));
			}
			else if (message.type == g_game.MESSAGE_TYPES.SHARED.LOCATION) {
				g_dataQueue.push(JSON.stringify({
					type: g_game.MESSAGE_TYPES.SHARED.LOCATION,
					entityId: id,
					x: message.x,
					y: message.y,
					dirX: message.dirX,
					dirY: message.dirY,
					speed: message.speed
				}));
			}
			else if (message.type == g_game.MESSAGE_TYPES.CLIENT.GET_ENTITIES) {
				// send all current players to new player
				for (var i=0;i<g_connections.length;i++) {
					if (g_connections[i].id != id) {
						connection.sendUTF(JSON.stringify({
							type: g_game.MESSAGE_TYPES.SERVER.PRESENCE,
							entityId: g_connections[i].id,
							x: 0,
							y: 0,
							dirX: 0,
							dirY: 0
						}));
					}
				}
			}
        }
        else if (origMessage.type === 'binary') {
            console.log('Received Binary Message of ' + origMessage.binaryData.length + ' bytes');
            connection.sendBytes(origMessage.binaryData);
        }
    });
    connection.on('close', function(reasonCode, description) {
		g_connections.splice(g_connections.indexOf(connection), 0);
		g_dataQueue.push('' + GAME_CONSTANTS.MSG_DISCONNECT + '|' + id + '|');
        console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
    });
});