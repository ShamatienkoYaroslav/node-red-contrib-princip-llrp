module.exports = function(RED) {
  function send(config) {
    RED.nodes.createNode(this, config);

    var node = this;
    this.on('input', function(msg) {
      var device = RED.nodes.getNode(config.device);

      var validDevice = true;

      if (!device.ipAddress) {
        node.error('Provide LLRP-device IP address!')
      }

      if (!device.port) {
        node.error('Provide LLRP-device port!')
      }

      if (validDevice) {
        var reader = null;

        var globalContext = this.context().global;
        var p = globalContext.get('princip') || {};
        var llrp = p.llrp || {};
        var devices = llrp.devices || [];

        var deviceExists = false;
        for (var d of devices) {
          if (d.ipAddress === device.ipAddress && d.port === device.port) {
            reader = d.reader;
            deviceExists = true;
          }
        }
        
        if (!deviceExists) {
          var Reader = require('../../lib/llrp/LLRPMain');
          var reader = new Reader({
            ipaddress: device.ipAddress,
            port: device.port,
            log: false
          });
          try {
            reader.connect();

            devices.push({
              ipAddress: device.ipAddress,
              port: device.port,
              reader: reader
            });
          } catch (error) {
            node.error(error);
          }
        }

        p.llrp = llrp;
        p.llrp.devices = devices;

        globalContext.set('princip', p);

        try {
          reader.emit('message', msg.payload);
        } catch (error) {
          node.error(error);
        }
      }
    });
  }

  RED.nodes.registerType('princip-llrp-in', send);
}