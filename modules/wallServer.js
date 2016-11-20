'use strict';

let ws = require('ws');
let fs = require('fs');

let Notifier = require('./notifier')
let config = require('../config');

const urlRegexp = /^https?\:\/\//;

// TODO : make states persista(e?)nt!
var states = {};

class WallServer extends Notifier{
  constructor() {
    super();
    this._handlers = [];

    var wss = new ws.Server({
      port: config.wallServerPort
    });

    wss.on('connection', (ws) => {
      console.log(`[${new Date().toISOString()}][WallServer] New websocket connection from ${ws.upgradeReq.connection.remoteAddress}`);
      ws.on('message', this.onMessage.bind(this, ws));
    });
  }

  start(callback) {
    fs.readdir(__dirname + '/../states', (error, files) => {
      var numFiles = files.length;
      files.forEach(file => {
        fs.readFile(__dirname + '/../states/' + file, (error, data) => {
          numFiles--;
          try {
            if (error) {
              console.error(`[${new Date().toISOString()}][ERR][${new Date().toISOString()}][WallServer] Could not load game state ${file}`);
            } else if (file.indexOf('.json') >= 0) {
              states[file.replace('.json', '')] = JSON.parse(data);
            }
          } catch (e) {
            console.error(`[${new Date().toISOString()}][ERR][${new Date().toISOString()}][WallServer] Could not parse game state ${file}`);
          } finally {
            if (numFiles === 0) {
              callback();
            }
          }
        });
      });
    })
  }

  onMessage(ws, message) {
    try {
      var jsonMessage = JSON.parse(message);
    } catch(e) {
      console.error(`[${new Date().toISOString()}][ERR][WallServer] Impossible to parse receieved message ${message}`);
      return;
    }
    if (jsonMessage.type === 'hello') {
      console.log(`[${new Date().toISOString()}][WallServer] Got a hello message - new handler created`);
      this.createHandler(ws, message);
    }
  }

  createHandler(ws, message) {
    ws.removeListener('message', this.onMessage);
    var handler = new WallHandler(this, ws);
    handler.onMessage(message);
    this._handlers.push(handler);
    console.log(`[${new Date().toISOString()}][WallServer] There are now ${this._handlers.length} handlers.`);
  }

  removeHandler(handler) {
    for (var i = 0; i < this._handlers.length; i++) {
      if (this._handlers[i] === handler) {
        this._handlers.splice(i, 1);
        return;
      }
    }
  }

  getState(gameName, callback) {
    process.nextTick(function () {
      if (states[gameName]) {
        callback(null, states[gameName]);
      } else {
        console.error(`[${new Date().toISOString()}][ERR][WallServer] Could not find game '${gameName} - sending empty state`);
        callback(null, {});
      }
    })
  }

  setWebappManager(manager) {
    manager.addListener(this);
  }

  onNotify(type, data) {
    for (var i in this._handlers) {
      this._handlers[i].sendMessage(type, data);
    }
  }
}

const MAX_ID = 1000000000;
let lastId = Math.floor(Math.random() * MAX_ID);

class WallHandler {
  constructor(server, ws) {
    this._server = server;
    this._ws = ws;
    this.game = null;

    this._lastActivity = null;
    this._pingInterval = setInterval(this.ping.bind(this), config.pingInterval * 1000);

    this._ws.on('message', this.onMessage.bind(this));
    this._ws.on('close', this.onClose.bind(this));
  }

  ping() {
    this.sendMessage('ping', {});
  }

  onTimeout() {
    console.log(`[${new Date().toISOString()}][WallServer] Connection to game ${this.game} seems to be lost. Cleaning up...`);
    this.cleanClose();
  }

  cleanClose() {
    this._ws.close();
  }

  onClose() {
    console.log(`[${new Date().toISOString()}][WallServer] socket closed for ${this.game}`);
    if (this._timeout) {
      clearTimeout(this._timeout);
    }
    if (this._pingInterval) {
      clearInterval(this._pingInterval);
    }
    this._server.removeHandler(this);
  }

  onMessage(message) {
    this._lastActivity = new Date();
    try {
      var jsonMessage = JSON.parse(message);
    } catch(e) {
      console.error(`[${new Date().toISOString()}][ERR][${new Date().toISOString()}][WallServer] Impossible to parse receieved message ${message}`);
      this.sendError('Badly formatted JSON data');
      return;
    }
    if (jsonMessage.secret != config.secret) {
      console.log(`[${new Date().toISOString()}][ERR][HACK][WallServer] Wrong or missing secret on IP [${this._ws.upgradeReq.connection.remoteAddress}]!`);
      return;
    }
    if (jsonMessage.type == 'hello') {
      if (!jsonMessage.data.game) {
        this.sendError('data.game is not defined - I do not know who you are!');
        return;
      }
      this.game = jsonMessage.data.game;
      this.sendMessage('hello', {
        state: states[this.game]
      });
    } else if (jsonMessage.type == 'requestState') {
      if (this.game === null) {
        this.sendError('Never said hello - I do not know who you are!');
        return;
      }
      this.sendMessage('state', states[this.game]);
    } else if (jsonMessage.type == 'saveState') {
      if (this.game === null) {
        this.sendError('Never said hello - I do not know who you are!');
        return;
      }
      states[this.game] = jsonMessage.data;
      fs.writeFile(__dirname + '/../states/' + this.game + '.json', JSON.stringify(jsonMessage.data), (error, data) => {
        if (error) {
          console.error(`[${new Date().toISOString()}][ERR][${new Date().toISOString()}][WallServer] Error saving state to file.`, error);
          return;
        }
      });
    } else if (jsonMessage.type === 'ping') {
      // Do nothing
    } else if (jsonMessage.type === 'goodbye') {
      this.cleanClose();
    }
    if (this._timeout) {
      clearTimeout(this._timeout);
    }
    this._timeout = setTimeout(this.onTimeout.bind(this), config.inactivityTimeout * 1000);
  }

  sendError(message) {
    var sendObject = {
      type: 'error',
      data: message
    }
    try {
      this._ws.send(JSON.stringify(sendObject));
    } catch (e) {
      this.cleanClose();
    }
  }

  sendMessage(type, data) {
    var sendObject = {
      type: type,
      data: data
    }
    try {
      this._ws.send(JSON.stringify(sendObject));
    } catch (e) {
      this.cleanClose();
    }
  }

  revive(ws) {
    this._ws.close();
    this._ws = ws;
  }
}

module.exports = exports = WallServer;