// Voice device: detects its Voice number from its rack chain and keeps the Hub informed of it.
// Messages to the Hub go to "pf4.hub": "hello <deviceId> <voice>" and "bye <deviceId>".
autowatch = 1;
outlets = 1; // 0: detected Voice number (to the Voice number box)

var voice = 1;
var deviceId = 0;

// live.thisdevice bangs once the Live API is ready
function bang() {
  var device = new LiveAPI("this_device");
  deviceId = parseInt(device.id, 10);
  var match = device.unquotedpath.match(/chains (\d+) devices \d+$/); // e.g. live_set tracks 0 devices 1 chains 2 devices 0
  outlet(0, match ? parseInt(match[1], 10) + 1 : 1);
}

// the Voice number box reports its value (detected or set by hand)
function msg_int(n) {
  voice = n;
  announce();
}

function rollcall() {
  announce();
}

function announce() {
  if (deviceId) messnamed("pf4.hub", "hello", deviceId, voice);
}

function notifydeleted() {
  if (deviceId) messnamed("pf4.hub", "bye", deviceId);
}

