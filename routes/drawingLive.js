/*
 * Slide creator
 */
var config = require('../config');
 
var fs = require('fs');

module.exports = exports = function (req, res) {
  res.header("Access-Control-Allow-Origin","*")
  if ( req.body.type ){
    console.log()
  }
  res.send("ok");
};