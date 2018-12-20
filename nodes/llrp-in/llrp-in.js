var utils = require('../../utils');

module.exports = function(RED) {
  function InputNode(config) {
    RED.nodes.createNode(this, config);

    this.status({ fill: "grey", shape: "ring", text: "initialize" });

    var device = RED.nodes.getNode(config.device);

    if (!device.ipAddress) {
      node.error('Provide LLRP-device IP address!')
    }

    if (!device.port) {
      node.error('Provide LLRP-device port!')
    }

    // var reader = null;

    // var globalContext = this.context().global;
    // var p = globalContext.get('princip') || {};
    // var llrp = p.llrp || {};
    // var devices = llrp.devices || [];

    // for (var d of devices) {
    //   if (d.ipAddress === device.ipAddress && d.port === device.port) {
    //     reader = d.reader;
    //   }
    // }

    // if (!reader) {
    //   var Reader = require('../../lib/llrp/LLRPMain');
    //   try {
    //     var reader = new Reader({
    //       ipaddress: device.ipAddress,
    //       port: device.port,
    //       log: device.log,
    //       console: this.warn
    //     });

    //     reader.connect();

    //     devices.push({
    //       ipAddress: device.ipAddress,
    //       port: device.port,
    //       reader: reader
    //     });

    //     p.llrp = llrp;
    //     p.llrp.devices = devices;

    //     globalContext.set('princip', p);
    //   } catch (error) {
    //     reader = null;
    //     node.error(error);
    //   }
    // }

    var reader = utils.getReader(this, device);

    var node = this;
    // if (reader) {
    //   reader.e.on('princip-answer', function(a) {
    //     if (a) {
    //       node.status({ fill: "blue", shape: "dot", text: "receiving data" });
    //     }
    //   });
    // }

    this.on('input', function(msg) {
      try {
        utils.reconnectReader(reader);
        reader.e.emit('princip-message', msg.payload);
        node.status({ fill: "blue", shape: "dot", text: "node sending data" });
      } catch (error) {
        node.error(error);
        node.status({ fill: "yellow", shape: "dot", text: "error on sending data" });
      }
    });

    reader.e.on('disconnect',function(b){
      node.status({ fill: "red", shape: "ring", text: "client disconnected" });
    });

    reader.e.on('timeout',function(c){
      node.status({ fill: "red", shape: "ring", text: "timeout" });
    });

    reader.e.on('error',function(d){
      node.status({ fill: "yellow", shape: "ring", text: "error" });
    });

    this.on('close', function() {
      node.status({ fill: "red", shape: "ring", text: "node closed connection" });
      utils.disconnectReader(node, device, reader);
    });
  }

  RED.nodes.registerType('princip-llrp-in', InputNode);
}
