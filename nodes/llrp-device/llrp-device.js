'use strict';

module.exports = function(RED) {
  function Device(config) {
    RED.nodes.createNode(this, config);

    this.ipAddress = config.ipAddress || '';
    this.port = config.port || 5000;
    this.log = config.log;
  }

  RED.nodes.registerType('princip-llrp-device', Device)
}