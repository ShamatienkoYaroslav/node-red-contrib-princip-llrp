module.exports = function(RED) {
  function InputNode(config) {
    RED.nodes.createNode(this, config);

    this.status({ fill: "red", shape: "ring", text: "disconnected" });

    var device = RED.nodes.getNode(config.device);

    if (!device.ipAddress) {
      node.error('Provide LLRP-device IP address!')
    }

    if (!device.port) {
      node.error('Provide LLRP-device port!')
    }

    var reader = null;

    var globalContext = this.context().global;
    var p = globalContext.get('princip') || {};
    var llrp = p.llrp || {};
    var devices = llrp.devices || [];

    for (var d of devices) {
      if (d.ipAddress === device.ipAddress && d.port === device.port) {
        reader = d.reader;
      }
    }

    if (!reader) {
      var Reader = require('../../lib/llrp/LLRPMain');
      try {
        var reader = new Reader({
          ipaddress: device.ipAddress,
          port: device.port,
          log: device.log,
          console: this.warn
        });

        reader.connect();

        devices.push({
          ipAddress: device.ipAddress,
          port: device.port,
          reader: reader
        });

        p.llrp = llrp;
        p.llrp.devices = devices;

        globalContext.set('princip', p);
      } catch (error) {
        reader = null;
        node.error(error);
      }
    }

    if (reader) {
      this.status({ fill: "green", shape: "dot", text: "connected" });
    }

    var node = this;
    this.on('input', function(msg) {
      try {
        reader.emit('princip-message', msg.payload);
      } catch (error) {
        node.error(error);
      }
    });
  }

  RED.nodes.registerType('princip-llrp-in', InputNode);
}
