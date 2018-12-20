var Reader = require('../lib/llrp/LLRPMain');

module.exports = {
  disconnectReader: function(node, device, reader) {
    if (reader && reader.connected) {
      reader.disconnect();
    }

    var globalContext = node.context().global;
    var p = globalContext.get('princip') || {};
    var llrp = p.llrp || {};
    var devices = llrp.devices || [];

    var deviceToRemove = null;
    for (var i in devices) {
      var d = devices[i];
      if (!d) continue;
      if (d.ipAddress === device.ipAddress && d.port === device.port && d.id === device.id) {
        deviceToRemove = i;
        delete devices[i];
        break;
      }
    }

    if (deviceToRemove) {
      devices.slice(deviceToRemove, 1);
    }

    p.llrp = llrp;
    p.llrp.devices = devices;

    globalContext.set('princip', p);
  },
  reconnectReader: function(reader) {
    if (!reader) return;

    if (!reader.connected) {
      reader.connect();
    }
  },
  getReader: function(node, device) {
    var id = device.id;

    var reader = null;

    var globalContext = node.context().global;
    var p = globalContext.get('princip') || {};
    var llrp = p.llrp || {};
    var devices = llrp.devices || [];

    for (var d of devices) {
      if (!d) continue;
      if (d.ipAddress === device.ipAddress && d.port === device.port && d.id === id) {
        reader = d.reader;
        break;
      }
    }

    if (!reader) {
      try {
        var reader = new Reader({
          ipaddress: device.ipAddress,
          port: device.port,
          log: device.log,
          console: node.warn
        });

        reader.connect();

        devices.push({
          ipAddress: device.ipAddress,
          port: device.port,
          reader: reader,
          id: id
        });

        p.llrp = llrp;
        p.llrp.devices = devices;

        globalContext.set('princip', p);
      } catch (error) {
        reader = null;
        node.error(error);
        node.status({ fill: "red", shape: "ring", text: "init error" });
      }
    }

    return reader;
  }
}
