'use strict';

class Notifier {
  constructor() {
    this._listeners = [];
  }

  /**
   * Registers an object to receive notifications. 
   * @param {object} listener The object to add. Must have a onNotify function
   */
  addListener(listener) {
    this._listeners.push(listener);
  }

  /**
   * Unregisters an object so it stops receiving notifications.
   * @param  {object} listener The object to remove. Must be in the list
   * @return {boolean} True if it was found or false if it wasn't
   */
  removeListener(listener) {
    var pos = this._listeners.indexOf(listener);
    if (pos !== -1) {
      this._listeners.splice(pos, 1);
      return true;
    }
    return false;
  }

  _notifyListeners(type, content) {
    for (var i in this._listeners) {
      this._listeners[i].onNotify.call(this._listeners[i], type, content);
    }
  }
}

module.exports = exports = Notifier;