const logger = require('./logger');

let logged = false;

function preferCleanFields(analyzerResp = {}) {
  if (analyzerResp && analyzerResp.fields_clean) {
    if (!logged) {
      const logFn = logger.debug ? logger.debug.bind(logger) : logger.info.bind(logger);
      logFn('preferCleanFields using fields_clean');
      logged = true;
    }
    return analyzerResp.fields_clean;
  }
  if (analyzerResp && analyzerResp.fields) {
    return analyzerResp.fields;
  }
  return analyzerResp || {};
}

module.exports = { preferCleanFields };
