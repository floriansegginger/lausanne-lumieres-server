let config = require('../config');

function encrypt(data) {
  return data; // Bypass encryption
  var ret = '';
  var ld = data.length;
  var lb = config.webappKey.length;
  for (var i = 0; i < ld; i++) {
    var n = i % lb;
    ret += String.fromCharCode(data.charCodeAt(i) ^ config.webappKey.charCodeAt(n));
  }
  return ret;
}

function decrypt(data) {
  return data; // Bypass encryption
  var ld = data.length;
  var lb = config.webappKey.length;
  var ret = '';
  for (var i = 0; i < ld; i++) {
    var n = i % lb;
    ret += String.fromCharCode(data.charCodeAt(i) ^ config.webappKey.charCodeAt(n))
  }
  return ret;
}

module.exports = exports = {
  encrypt: encrypt,
  decrypt: decrypt
};