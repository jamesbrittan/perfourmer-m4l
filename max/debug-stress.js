// [DEBUG-hang] Stop stress test: starts and stops Live's transport at random moments, then asks every Voice which
// notes it has sent without a note-off. "Heard a hang" marks the run in the log, so what Max sent can be compared
// with what the synth did. Writes .scratch/debug/stop-hang.log in the main checkout (and posts to the Max console).
autowatch = 1;
inlets = 1;
outlets = 2; // 0: log lines + "write <path>" to a text object, 1: status text

const LOG = "/Users/james/Work/m4l/perfourmer/.scratch/debug/stop-hang.log";
const tasks = []; // keep scheduled Tasks referenced until they fire
let runs = 0;
let current = 0;
let pause = 300;
const t = () => Date.now() % 100000;

// run <count> [<ms after each stop>]: a long pause leaves time to listen for a hang after every stop
function run(n, after = 300) {
  runs = n;
  current = 0;
  pause = after;
  log(`stress start runs ${n} pause ${after}`);
  later(500, next);
}

function next() {
  if (current >= runs) return finish();
  current++;
  const song = new LiveAPI("live_set");
  song.call("start_playing");
  log(`run ${current} start @${t()}`);
  later(150 + Math.random() * 1500, () => {
    log(`run ${current} stop @${t()}`);
    song.call("stop_playing");
    outlet(1, "set", `run ${current} of ${runs}: stopped`);
    later(pause, () => {
      messnamed("pf4.voice", "report", current);
      later(100, next);
    });
  });
}

function heard() {
  log(`HEARD a hang at run ${current} @${t()}`);
}

function held(runNumber, voice, count, stacked, pitches, ...details) {
  const hung = count > 0 || stacked > 0;
  log(`${hung ? "HUNG" : "ok"} run ${runNumber} voice ${voice} held ${count} stacked ${stacked} pitches ${pitches} ${details.join(" ")}`);
}

function hubdebug(...what) {
  log(`hub ${what.join(" ")} @${t()} run ${current}`);
}

function finish() {
  log("stress end");
  outlet(0, "write", LOG);
  outlet(1, "set", `done: ${runs} runs, see stop-hang.log`);
}

function save() {
  outlet(0, "write", LOG);
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
