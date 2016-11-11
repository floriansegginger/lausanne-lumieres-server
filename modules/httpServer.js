'use strict';

let express = require('express');
let bodyParser = require('body-parser');

let config = require('../config.js');

class HttpServer {
  constructor() {
    this.app = express();

    this.app.use(function (req, res, next) {
      res.header('Access-Control-Allow-Origin','*');
      next();
    });

    this.app.use(bodyParser.urlencoded({
      extended: true
    }));
    this.app.use(bodyParser.json());

    this._addRoutes();
  }

  _addRoutes() {
    // this.app.get('/drawingLive', routes.drawingLive);
  }

  static renderError(res, message, status = 500) {
    res.status(status).render('error', {error: message, location: {category:'error', name: 'Erreur'}});
  }

  static jsonError(res, message) {
    res.status(500).json({error: message});
  }
}

module.exports = exports = HttpServer;

const __routes = __dirname + '/../routes/';
let routes = {
  // drawingLive: require(__routes + 'drawingLive')
}
