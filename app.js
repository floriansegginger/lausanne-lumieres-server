'use strict';

let masterServer = require('http').createServer();

let config = require('./config');

let HttpServer = require('./modules/httpServer');
let WallServer = require('./modules/wallServer');
let WebappManager = require('./modules/webappManager');

var mainHttpServer = new HttpServer();
var webappManager = new WebappManager(masterServer, mainHttpServer);
var wallServer = new WallServer();

wallServer.start(() => {
  masterServer.listen(config.port, function onMasterServerStarted() {
    console.log('server listening');
  });
})


masterServer.on('request', mainHttpServer.app);
webappManager.setWallServer(wallServer);
wallServer.setWebappManager(webappManager);

process.on('unhandledRejection', function onUnhandledRejection(err) {
  console.error('Unhandled Rejection Exception');
  console.error(err);
})