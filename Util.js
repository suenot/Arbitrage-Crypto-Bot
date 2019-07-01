const moment = require('moment-timezone'),
      util = (function () {
      	this.timestamp = () => (moment()).tz('America/New_York').format('MMMM Do YY, h:mm:ss a');
      	this.runId = timestamp();
      	this.log = require('simple-node-logger').createSimpleLogger({
              logFilePath: './logs/' + this.runId + '.log',
              timestampFormat:'MM-DD HH:mm:ss',
        });
      
        this.deltaTString = deltaMs => {
          	const days =  Math.floor(deltaMs / 86400000), // hours*minutes*seconds*milliseconds
          	      hours = Math.floor((deltaMs - days * 86400000) / 3600000),
          	      min = Math.round((deltaMs - days * 86400000 - hours * 3600000) / 60000);
          	return (days === 0 ? '' : days + (days === 1 ? ' day ' : ' days ')) + (hours === 0 ? '' : hours + (hours === 1 ? ' hour ' : ' hours ')) + min + (min === 1 ? ' min' : ' mins');
        };
      
      
        return this;
      })();

module.exports = util;

