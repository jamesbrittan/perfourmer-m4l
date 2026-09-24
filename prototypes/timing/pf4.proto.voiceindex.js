// PROTOTYPE — outputs this device's rack chain number (1-based); 1 if not inside a rack.
autowatch = 1;
outlets = 1;
function bang() {
    var path = new LiveAPI("this_device").unquotedpath; // e.g. live_set tracks 0 devices 1 chains 2 devices 0
    var m = path.match(/chains (\d+) devices \d+$/);
    outlet(0, m ? parseInt(m[1], 10) + 1 : 1);
}
