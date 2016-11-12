let config = require('../config');
let WebSocketServer = require('ws').Server;
let fs = require('fs');
let shortid = require('shortid');
let bodyParser = require('body-parser');
var base64 = require('base-64');

let Notifier = require('./notifier')
let pmwCrypt = require('./pmwCrypt');

const RELOAD_INTERVAL = 10 * 1000;

class LiveDrawingManager extends Notifier{
  constructor(nodeHttpServer, appHttpServer) {
    super();
    this.server = new WebSocketServer({
      server: nodeHttpServer
    });
    this.server.on('connection', this.onConnection.bind(this));
    this.reloadBansInterval = setInterval(this.reloadBans.bind(this), RELOAD_INTERVAL);
    this.bannedUsers = [];
    appHttpServer.app.all('/webapp-request', this.onGetOrPost.bind(this));
  }

  onGetOrPost(req, res) {
    this.handleMessage({
      ipAddress: req.connection.remoteAddress,
      send: function (data) {
        this.header('Access-Control-Allow-Origin','*');
        this.header('Content-Type', 'application/octet-stream');
        this.send(data);
      }.bind(res),
      error: function (data) {
        this.header('Access-Control-Allow-Origin','*');
        this.header('Content-Type', 'application/octet-stream');
        this.status(400).send(data);
      }.bind(res)
    }, (req.body.data)?JSON.parse(pmwCrypt.decrypt(req.body.data)):JSON.parse(pmwCrypt.decrypt(req.query.data)));
  }

  handleMessage(connector, message) {
    var userId = '';
    if (typeof message.data !== 'object'){
      this.sendError(connector, 'Data must be an objet.');
      return;
    }
    if (typeof message.userId === 'undefined'){
      userId = this.constructor.generateUserId();
      this.sendMessage(connector, 'userId', {userId: userId});
      return;
    } else {
      userId = message.userId;
    }

    if (message.type === 'get-state') {
      if (!this.wallServer) {
        this.sendError(connector, 'No wall server');
        return;
      }
      if (!message.data.game) {
        this.sendError(connector, 'No game specified');
        return;
      }
      this.wallServer.getState(message.data.game, (error, state) => {
        if (error) {
          console.log('[WebappManager] State not found');
          this.sendError(connector, error);
          return;
        }
        this.sendMessage(connector, 'state', state);
      })
      return;
    }

    if (this.bannedUsers.indexOf(userId) !== -1) {
      // Block some users
      this.sendError(connector, `Vous êtes banni! Contactez info@pimp-my-wall.ch si vous pensez qu'il s'agit d'une erreur.`);
      console.error(`[${connector.ipAddress}][${userId}] Request has been blocked by ban`);
      return;
    }
    // console.log(`[${(new Date()).getTime()}][${connector.ipAddress}][${userId}] Got: ${JSON.stringify(message)})`);
    message.data.userId = userId;
    this._notifyListeners(message.type, message.data);
    this.sendMessage(connector, 'ok', {})
  }

  onConnection(ws) {
    ws.on('message', function onMessage(message) {
      var connector = {
          send: ws.send.bind(ws), 
          error: ws.send.bind(ws),
          ipAddress: ws.upgradeReq.connection.remoteAddress
        };
      try {
        var parsedMessage = JSON.parse(pmwCrypt.decrypt(message));
        this.handleMessage(connector, parsedMessage);
      } catch (e) {
        this.sendError(connector, "Cannot parse your message - invalid JSON.");
        console.error(`[${ws.upgradeReq.connection.remoteAddress}][???] Cannot parse message: ${base64.encode(message)}`);
      }
    }.bind(this));

    ws.on('close', function() {});
  }

  setWallServer(wallServer) {
    this.wallServer = wallServer;
    this.wallServer.addListener(this);
  }

  reloadBans() {
    fs.readFile(__dirname + '/../bannedUsers.json', (err, data) => {
      if (!err) {
        try {
          this.bannedUsers = JSON.parse(data);
        } catch (e) {
          //TODO maybe don't fail silently?
        }
      }
    });
  }

  sendMessage(connector, type, data) {
    try {
      connector.send(pmwCrypt.encrypt(JSON.stringify({
        type: type,
        sessionId: Math.random(),
        data: data
      })));
    } catch (e) {
      console.error(`[${connector.ipAddress}][???] Failed to send message`);
    }
  }

  sendError(connector, message) {
    try {
      connector.error(JSON.stringify({
        error: message
      }));
    } catch (e) {
      console.error(`[${connector.ipAddress}][???] Failed to send error`);
    }
  }

  onNotify(type, data) {
    if (type === 'stateChange') {
      this.server.clients.forEach((client) => {
        this.sendMessage(ws, 'stateChange', data);
      });
    }
  }

  static generateUserId() {
    return shortid.generate();
  }
}

module.exports = exports = LiveDrawingManager;
