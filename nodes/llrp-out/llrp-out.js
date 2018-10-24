module.exports = function(RED) {
  function OutputNode(config) {
    RED.nodes.createNode(this, config);

    var device = RED.nodes.getNode(config.device);

    var reader = null;

    var globalContext = this.context().global;
    var p = globalContext.get('princip') || {};
    var llrp = p.llrp || {};
    var devices = llrp.devices || [];

    for (var d of devices) {
      if (d.ipAddress === device.ipAddress && d.port === device.port) {
        reader = d.reader;
        break;
      }
    }

    if (!reader) {
      var Reader = require('../../lib/llrp/LLRPMain');
      try {
          reader = new Reader({
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
        this.error(error);
      }
    }

    if (reader) {
      this.status({ fill: "green", shape: "dot", text: "connected" });

      var node = this;
      reader.on('princip-answer', function(a) {
        node.send({ payload: a });
      });

      reader.on('disconnect',function(b){
        node.status({ fill: "red", shape: "ring", text: "client disconnected" });
      });

      reader.on('timeout',function(c){
        node.status({ fill: "red", shape: "ring", text: "timeout" });
      });

      reader.on('error',function(d){
        node.status({ fill: "yellow", shape: "ring", text: "error" });
      });


    } else {
      this.status({ fill: "red", shape: "ring", text: "disconnected" });
    }
  }

  RED.nodes.registerType('princip-llrp-out', OutputNode);
}
