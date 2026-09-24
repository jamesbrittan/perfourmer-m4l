// Voice device: outputs this device's rack chain number (1-based), or 1 when not inside a rack.
autowatch = 1;
outlets = 1;

function bang() {
  var path = new LiveAPI("this_device").unquotedpath; // e.g. live_set tracks 0 devices 1 chains 2 devices 0
  var match = path.match(/chains (\d+) devices \d+$/);
  outlet(0, match ? parseInt(match[1], 10) + 1 : 1);
}
