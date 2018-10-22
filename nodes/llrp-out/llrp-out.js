module.exports = function(RED) {
  function get(config) {
    RED.nodes.createNode(this, config);

    var device = RED.nodes.getNode(config.device);

    var reader = null;

    var globalContext = this.context().global;
    var p = globalContext.get('princip') || {};
    
    if (p.llrp && p.llrp.devices) {
      for (var d of devices) {
        if (d.ipAddress === device.ipAddress && d.port === device.port) {
          reader = d.reader;
          break;
        }
      }
    }

    if (reader) {
      reader.on('answer', function(a) {
        this.send({ payload: a });
      });
    } else {
      this.error(`Can't find device, address:${device.ipAddress}:${device.port}`);
    }
  }

  RED.nodes.registerType('princip-llrp-out', get);
}