// [DEBUG-hang] Stop stress test: starts and stops Live's transport at random moments, then asks every Voice
// which notes it still holds. Writes .scratch/debug/stress.log (and posts to the Max console).
autowatch = 1;
inlets = 1;
outlets = 2; // 0: log lines + "write <path>" to a text object, 1: status text

const LOG = "/Users/james/Work/m4l/perfourmer/.scratch/debug/stress.log";
const tasks = []; // keep scheduled Tasks referenced until they fire
let runs = 0;
let current = 0;

function run(n) {
  runs = n;
  current = 0;
  log(`stress start runs ${n}`);
  messnamed("pf4.debugreq", "bang"); // ask the Hub to reconnect to Live and report what its probes see
  later(500, next);
}

function next() {
  if (current >= runs) return finish();
  current++;
  const song = new LiveAPI("live_set");
  song.call("start_playing");
  later(150 + Math.random() * 750, () => {
    song.call("stop_playing");
    later(300, () => {
      messnamed("pf4.voice", "report", current);
      later(100, next);
    });
  });
}

function held(runNumber, voice, count, pitches, ...details) {
  const extra = details.join(" ");
  log(`${count > 0 ? "HUNG" : "ok"} run ${runNumber} voice ${voice} held ${count} pitches ${pitches} ${extra};`);
  outlet(1, "set", `run ${runNumber} of ${runs}`);
}

function hubdebug(...what) {
  log(`hub ${what.join(" ")} at run ${current};`);
}

function finish() {
  log("stress end");
  outlet(0, "write", LOG);
  outlet(1, "set", `done: ${runs} runs, see stress.log`);
}

function log(line) {
  post(`[DEBUG-hang] ${line}\n`);
  outlet(0, line);
}

function later(ms, fn) {
  const task = new Task(fn);
  tasks.push(task);
  task.schedule(ms);
}
