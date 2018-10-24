/**
 * @fileOverview Basic reading of RF tags. This is the main starting point.
 *
 * This file was created at Openovate Labs.
 *
 * @author Billie Dee R. Ang <billieang24@gmail.com>
 * @author Jeriel Mari E. Lopez <jerielmari@gmail.com>
 */


'use strict';

// ====================
// Includes
// ====================

var messageC = require('./LLRPMessagesConstants.js');
var parameterC = require('./LLRPParametersConstants.js');
var LLRPMessage = require('./LLRPMessages.js');
var decode = require('./decode.js');



// ====================
	// PRINCIP Yaroslav Shamatienko BEGIN
	// ====================

var encode = require('./encode.js');

// ====================
// PRINCIP Yaroslav Shamatienko END
// ====================




var net = require('net');
var EventEmitter = require('events').EventEmitter;

var llrpMain = function (config) {

	// ====================
	// Variables
	// ====================

	var ipaddress = config.ipaddress || '192.168.0.1';
	var port = config.port || 5084;
	var log = config.log || false;
	var c = config.console || console;
	var isReaderConfigSet = config.isReaderConfigSet || false;
	var isStartROSpecSent = config.isStartROSpecSent || false;

	var socket = new net.Socket();
	var self = this;
	var client = null;

	//Defined message buffers. Brute force, I know I know.
  // TODO: Change with config.
	//04 03 00 00 00 10 00 00 00 00 00 00 e2 00 05 80
	//04 03 00 00 00 12 00 00 01 dd 00 00 db 00 07 00 01 80

	var bSetReaderConfig_GPO_ON  = new Buffer('040300000012000001dd0000db0007000280', 'hex');
	var bSetReaderConfig_GPO_OFF = new Buffer('040300000012000001dd0000db0007000200', 'hex');

	var bSetReaderConfig = new Buffer('040300000010000000000000e2000580', 'hex');
	var bEnableEventsAndReport = new Buffer('04400000000a00000000', 'hex');
  // Impinj Specific AddRoSpec
  var bAddRoSpec = new Buffer('0414000000500000000400b1004600000001000000b2001200b300050000b60009000000000000b700180001000000b80009000000000000ba000700090100ed001201000100ee000bffc0015c0005c0', 'hex');
	var bEnableRoSpec = new Buffer('04180000000e0000000000000001', 'hex');
	var bStartRoSpec = new Buffer('04160000000e0000000000000001', 'hex');
	var bKeepaliveAck = new Buffer('04480000000a00000000', 'hex');
  var bDeleteRoSpec = new Buffer('04150000000e0000000000000001', 'hex');
  var bCloseConnection = new Buffer('040e0000000a00000000', 'hex');
	var bGetReaderConfig = new Buffer('0402000000110000012e00000900000000','hex');

	// ====================
	// Public Methods
	// ====================

	this.connect = function () {

		// timeout after 60 seconds.
		socket.setTimeout(60000, function () {
			if (log) {
				c('Connection timeout');
			}
			process.nextTick(function () {
				self.emit('timeout', new Error('Connection timeout'));
			});
		});

		// connect with reader
		client = socket.connect(port, ipaddress, function () {
			if (log) {
				c('Connected to: ' + ipaddress + ':' + port);
			}
		});

		// whenever reader sends data.
		client.on('data', function (data) {
			process.nextTick(function () {
				//check if there is data.
				if (data === undefined) {
					if (log) {
						c('Undefined data returned by the rfid.');
					}
				}

				//decoded message(s), passable to LLRPMessage class.
				var messagesKeyValue = decode.message(data);

				//loop through the message.
				for (var index in messagesKeyValue) {
					//possible we have more than 1 message in a reply.
					var message = new LLRPMessage(messagesKeyValue[index]);
					if (log) {
						c('Receiving: ' + message.getTypeName());
					}

					//Check message type and send appropriate response.
					//This send-receive is the most basic form to read a tag in llrp.
					switch (message.getType()) {
					case messageC.GET_READER_CONFIG_RESPONSE:
						handleGetReaderConfig(message);
						//emitMessage(message);
					case messageC.READER_EVENT_NOTIFICATION:
					  handleReaderNotification(message);
						//emitMessage(message);
						break;
					case messageC.SET_READER_CONFIG_RESPONSE:
						//send ADD_ROSPEC
						writeMessage(client, bAddRoSpec);
						break;
					case messageC.ADD_ROSPEC_RESPONSE:
						//send ENABLE_ROSPEC
						writeMessage(client, bEnableRoSpec);
						break;
					case messageC.ENABLE_ROSPEC_RESPONSE:
						//send START_ROSPEC
						sendStartROSpec();
						break;
					case messageC.START_ROSPEC_RESPONSE:
						writeMessage(client, bEnableEventsAndReport);
						break;
					case messageC.RO_ACCESS_REPORT:
						handleROAccessReport(message);
						//emitMessage(message);
						break;
					case messageC.KEEPALIVE:
						//send KEEPALIVE_ACK
						writeMessage(client, bKeepaliveAck);
						break;
          case messageC.DELETE_ROSPEC_RESPONSE:
						writeMessage(client, bCloseConnection);
						break;
					default:
						//Default, doing nothing.
						emitMessage(null);
						if (log) {
							c('default');
						}
					}
				}
			});
		});

		//the reader or client has ended the connection.
		client.on('end', function () {
			//the session has ended
			if (log) {
				c('client disconnected');
			}
			process.nextTick(function () {
				self.emit('disconnect', new Error('Client disconnected.'));
			});
		});

		//cannot connect to the reader other than a timeout.
		client.on('error', function (err) {
			//error on the connection
			if (log) {
				c(err);
			}
			process.nextTick(function () {
				self.emit('error', err);
			});
		});
	};

  this.disconnect = function() {
    process.nextTick(function() {
      writeMessage(client, bDeleteRoSpec);
      resetIsStartROSpecSent();
    });
	};

	// ====================
	// Helper Methods
	// ====================

	function handleReaderNotification(message) {
		var parametersKeyValue = decode.parameter(message.getParameter());

		parametersKeyValue.forEach(function (decodedParameters) {
			if (decodedParameters.type === parameterC.ReaderEventNotificationData) {
				var subParameters = mapSubParameters(decodedParameters);
				if (subParameters[parameterC.ROSpecEvent] !== undefined) {
					//Event type is End of ROSpec
					if (subParameters[parameterC.ROSpecEvent].readUInt8(0) === 1) {
						//We only have 1 ROSpec so obviously it would be that.
						//So we would not care about the ROSpecID and
						//just reset flag for START_ROSPEC.
						resetIsStartROSpecSent();
					}
				}
			}
		});

		//global configuration and enabling reports has not been set.
		if (!isReaderConfigSet) { //set them.
			writeMessage(client, bSetReaderConfig); //send SET_READER_CONFIG, global reader configuration in reading tags.
			isReaderConfigSet = true; //we have set the reader configuration.
		} else {
			sendStartROSpec();
		}
	}


	function handleROAccessReport(message) {
		process.nextTick(function () {
			//reset flag for START_ROSPEC.
			resetIsStartROSpecSent();
			//show current date.

			if (log) {
				c('RO_ACCESS_REPORT at ' + (new Date()).toString());
			}

			//read Parameters
			//this contains the TagReportData
			var parametersKeyValue = decode.parameter(message.getParameter());

			if (parametersKeyValue) {
				parametersKeyValue.forEach(function (decodedParameters) {
					//read TagReportData Parameter only.
					if (decodedParameters.type === parameterC.TagReportData) {

						var subParameters = mapSubParameters(decodedParameters);
						if (log) {
							c(decodedParameters);
						}
						var tag = {};

						if (typeof subParameters[parameterC.GPIPortCurrentState] !== 'undefined') {
							tag.GPIPortCurrentState = subParameters[parameterC.GPIPortCurrentState].toString('hex');
						}

						if (typeof subParameters[parameterC.LastSeenTimestampUTC] !== 'undefined') {
							tag.lastSeenTimestampUTC = subParameters[parameterC.LastSeenTimestampUTC].toString('hex');
						}

						if (typeof subParameters[parameterC.AntennaID] !== 'undefined') {
							tag.antennaID = subParameters[parameterC.AntennaID].readUInt16BE(0);
						}

						if (typeof subParameters[parameterC.EPC96] !== 'undefined') {
							tag.tagID = subParameters[parameterC.EPC96].toString('hex');
						}

						if (typeof subParameters[parameterC.TagSeenCount] !== 'undefined') {
							tag.tagSeenCount = subParameters[parameterC.TagSeenCount].readUInt16BE(0);
						}
						if (typeof subParameters[parameterC.PeakRSSI] !== 'undefined') {
							tag.PeakRSSI = subParameters[parameterC.PeakRSSI].readUInt8(0);
						}

						if (log) {
							c('ID: ' + tag.tagID + '\tRead count: ' + tag.tagSeenCount+'\tAntenna ID: '+tag.antennaID+'\t LastSeenTimestampUTC: '+tag.lastSeenTimestampUTC);
						}

						if (tag.tagID) {
							// process.nextTick(function () {
							// 	self.emit('didSeeTag', tag);
							// });
							emitMessage(tag);
						}
					}
				});
			}
		});
	}

	function handleGetReaderConfig(message) {
		process.nextTick(function () {

			if (log) {
				c('GET_READER_CONFIG at ' + (new Date()).toString());
			}

			//read Parameters
			//this contains the TagReportData
			var parametersKeyValue = decode.parameter(message.getParameter());

			if (parametersKeyValue) {
				parametersKeyValue.forEach(function (decodedParameters) {

					//read TagReportData Parameter only.
					if (decodedParameters.type === parameterC.GPIPortCurrentState) {

						var subParameters = mapSubParameters(decodedParameters);
						var GPI_ID     = decodedParameters.value.readUInt16BE(0);
						var GPI_Status = decodedParameters.value.readUInt16BE(2);

						var GPI = {
							'GPI_ID':GPI_ID,
							'GPI_Status':GPI_Status
						}
						emitMessage(GPI);
						//c(GPI_ID+' '+GPI_Status);
						// if (GPI_ID==1 && GPI_Status == 0){
						// 	writeMessage(client,bSetReaderConfig_GPO_ON);
						// }

						// if (true) {
						// 	process.nextTick(function () {
						// 		self.emit('GPIPortCurrentState', decodedParameters);
						// 	});
						// }
					}
				});
			}
		});
	}

	/**
	 * Send message to rfid and write logs.
	 *
	 * @param  {[type]} client  rfid connection.
	 * @param  {Buffer} buffer  to write.
	 */
	function writeMessage(client, buffer) {
		process.nextTick(function () {
			if (log) {
				c('Sending ' + getMessageName(buffer));
			}
			client.write(buffer);
		});
	}

	/**
	 * Gets the name of the message using the encoded Buffer.
	 *
	 * @param  {Buffer} data
	 * @return {string} name of the message
	 */
	function getMessageName(data) {
		//get the message code
		//get the name from the constants.
		return messageC[getMessage(data)];
	}

	/**
	 * Gets the message type using the encoded Buffer.
	 *
	 * @param  {Buffer} data
	 * @return {int} corresponding message type code.
	 */
	function getMessage(data) {
		//message type resides on the first 2 bits of the first octet
		//and 8 bits of the second octet.
		return (data[0] & 3) << 8 | data[1];
	}

	/**
	 * Sends a START_ROSPEC message if it has not been sent.
	 *
	 * @return {Int} returns the length written or false if there was an error writing.
	 */
	function sendStartROSpec() {
		//START_ROSPEC has not been sent.
		if (!isStartROSpecSent) {
			isStartROSpecSent = true; //change state of flag.
			writeMessage(client, bStartRoSpec); //send START_ROSPEC
		}
	}

	/**
	 * Resets the isStartROSpecSent flag to false.
	 */
	function resetIsStartROSpecSent() {
		isStartROSpecSent = false;
	}

	/**
	 * Simple helper function to map key value pairs using the typeName and value.
	 * Probably should be built in with LLRPParameter class.
	 *
	 * @param  {Object} decodedParameters  object returned from decode.parameter.
	 * @return {Object}  the key value pair.
	 */
	function mapSubParameters(decodedParameters) {
		//create an object that will hold a key value pair.
		var properties = {};
		var subP = decodedParameters.subParameters;
		for (var tag in subP) {
			//where key is the Parameter type.
			//and value is the Parameter value as Buffer object.
			properties[subP[tag].type] = subP[tag].value;
		}

		return properties;
	}

	// ====================
	// PRINCIP Yaroslav Shamatienko BEGIN
	// ====================

	this.on('princip-message', function(message) {
		// const m = new LLRPMessage(message)
		// writeMessage(client, encode.message(m));
		writeMessage(client, message);
	});

	function emitMessage(message) {
		self.emit('princip-answer', message);
	}

	// ====================
	// PRINCIP Yaroslav Shamatienko END
	// ====================

};

llrpMain.prototype = new EventEmitter();

module.exports = llrpMain;
