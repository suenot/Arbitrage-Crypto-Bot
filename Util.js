const moment = require('moment-timezone'),
      timeFormat = 'MMMM Do YY, h:mm:ss a',
      timezone = 'America/New_York',
      util = (function () {
      	this.timestamp = () => (moment()).tz(timezone).format(timeFormat);
      	this.runId = timestamp();
      	this.getPriceId = (symbol, exchangeId, startIsBase) => symbol + ':' + exchangeId + '|' + (startIsBase ? 'bid' : 'ask');
      	this.log = require('simple-node-logger').createSimpleLogger({
              logFilePath: './logs/' + this.runId + '.log',
              timestampFormat:'MM-DD HH:mm:ss',
        });
      
        this.deltaTString = function () {
          	const deltaT = arguments.length <= 1 ? moment.duration(arguments[0]) : moment.duration(moment(arguments[0], timeFormat).tz(timezone).diff(moment(arguments[1], timeFormat).tz(timezone))),
          	      days =  deltaT.days(), // hours*minutes*seconds*milliseconds
          	      hours = deltaT.hours(),
          	      min = deltaT.minutes();
          	return (days === 0 ? '' : days + (days === 1 ? ' day ' : ' days ')) + (hours === 0 ? '' : hours + (hours === 1 ? ' hour ' : ' hours ')) + min + (min === 1 ? ' min' : ' mins');
        };

        return this;
      })();

module.exports = util;

