let _broadcast = null;

function setupEventHandler(broadcast) {
  _broadcast = broadcast;
}

function emit(type, payload) {
  if (_broadcast) _broadcast({ type, payload, timestamp: new Date().toISOString() });
}

module.exports = { setupEventHandler, emit };
