var Promise = require('pinky-promise');

function parseHaproxyState(stateStr) {
  var keyValRe = /([^;= ]*)=([^;=]*)(?:;|$)?/
  var parts = /(UP|DOWN|NOLB)(?: (\d+)\/(\d+))?;(.*)/.exec(stateStr);
  var status = parts[1];
  var theRest = parts[4];
  var data = {};

  var match;
  while ((match = keyValRe.exec(theRest)) !== null) {
    data[match[1]] = match[2];
  }

  return {
    status: status,
    data: data
  };
}

function defaultGetStatus(lastHaproxyState) {
  return {
    status: 'NO STATUS'
  };
};

module.exports = function (statusFn) {
  var lastHaproxyStatus;
  var resolve;
  var shutdownPromise;
  var shuttingDown = false;

  var getStatus = statusFn || defaultGetStatus;

  function middleWare(req, res) {
    var shutdown = middleWare.shutdown;
    var haproxyState = req.get('X-Haproxy-Server-State');
    var parsedState;

    if (haproxyState) {
      parsedState = parseHaproxyState(haproxyState);
      lastHaproxyStatus = parsedState.status;
    }

    res.status(shuttingDown ? 404 : 200);
    res.json(getStatus(parsedState));

    if (shuttingDown && lastHaproxyStatus !== 'UP' && resolve) {
      resolve();
    }
  }

  middleWare.shutdown = function () {
    shuttingDown = true;
    if (shutdownPromise) return shutdownPromise;

    shutdownPromise = new Promise(function (_resolve, reject) {
      if (lastHaproxyStatus !== 'UP') {
        _resolve();
      } else {
        resolve = _resolve;
      }
    })
    .then(function () {
      resolve = null;
    });

    return shutdownPromise;
  };

  return middleWare;
};
