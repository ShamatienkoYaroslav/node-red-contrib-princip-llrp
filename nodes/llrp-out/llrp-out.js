var utils = require('../../utils');

module.exports = function(RED) {
  function OutputNode(config) {
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
    //     break;
    //   }
    // }

    // if (!reader) {
    //   var Reader = require('../../lib/llrp/LLRPMain');
    //   try {
    //       reader = new Reader({
    //         ipaddress: device.ipAddress,
    //         port: device.port,
    //         log: device.log,
    //         console: this.warn
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
    //     this.error(error);
    //   }
    // }

    var reader = utils.getReader(this, device);

    if (reader) {
      var node = this;
      reader.e.on('princip-answer', function(a) {
        if (a) {
          node.status({ fill: "green", shape: "dot", text: "connected" });
        }
        node.send({ payload: a });
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


    } else {
      this.status({ fill: "grey", shape: "ring", text: "notinitialized" });
    }

    this.on('close', function() {
      node.status({ fill: "red", shape: "ring", text: "closed connection" });
      utils.disconnectReader(node, device, reader);
    });
  }

  RED.nodes.registerType('princip-llrp-out', OutputNode);
}
