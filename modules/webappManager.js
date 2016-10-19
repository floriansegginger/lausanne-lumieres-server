let config = require('../config');
let WebSocketServer = require('ws').Server;
let fs = require('fs');
let shortid = require('shortid');
let bodyParser = require('body-parser');

let Notifier = require('./notifier')

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
    res.header('Access-Control-Allow-Origin','*');
    res.header('Content-Type', 'application/json');
    this.handleMessage({
      ipAddress: req.connection.remoteAddress,
      send: res.send.bind(res),
      error: function (data) {
        this.status(400).send(data)
      }.bind(res)
    }, (req.body.type)?req.body:req.query);
    res.end();
  }

  handleMessage(connector, message) {
    var userId = '';
    if (typeof message.data !== 'object'){
      this.sendError(connector, 'Data must be an objet.');
      return;
    }
    if (typeof message.userId === 'undefined'){
      userId = this.constructor.generateUserId();
      this.sendMessage(connector, 'userId', userId);
    } else {
      userId = message.userId;
    }

    if (this.bannedUsers.indexOf(userId) !== -1) {
      // Block some users
      console.error(`[${connector.ipAddress}][${userId}] Request has been blocked by ban`);
      return;
    }
    console.log(`[${connector.ipAddress}][${userId}] Got: ${JSON.stringify(message)})`);
    message.data.userId = userId;
    this._notifyListeners(message.type, message.data);
  }

  onConnection(ws) {
    ws.on('message', function onMessage(message) {
      var connector = {
          send: ws.send.bind(ws), 
          error: ws.send.bind(ws),
          ipAddress: ws.upgradeReq.connection.remoteAddress
        };
      try {
        var parsedMessage = JSON.parse(message);
        this.handleMessage(connector, parsedMessage);
      } catch (e) {
        this.sendError(connector, "Cannot parse your message - invalid JSON.");
        console.error(`[${ws.upgradeReq.connection.remoteAddress}][???] Cannot parse message: ${message}`);
      }
    }.bind(this));

    ws.on('close', function() {});
  }

  setWallServer(wallServer) {
    wallServer.addListener(this);
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
      connector.send(JSON.stringify({
        type: type,
        data: data
      }));
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
      console.error(`[${connector.ipAddress}][???] Failed to send message`);
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
