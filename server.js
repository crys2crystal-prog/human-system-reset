const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const QRCode = require("qrcode");
const os = require("os");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static(__dirname + "/public"));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/presenter.html");
});

app.get("/presenter.html", (req, res) => {
  res.sendFile(__dirname + "/public/presenter.html");
});

const PORT = process.env.PORT || 3000;

const wheelCategories = [
  "Academic Performance",
  "Life Path",
  "Friendship",
  "Mental Health",
  "Family",
  "Fun",
  "Love",
  "Finances",
  "Physical Health",
  "Spirituality"
];

const phoneReasons = [
  "Notifications",
  "Boredom",
  "Habit / automatic",
  "Avoiding a task",
  "Checking something specific",
  "Social connection",
  "Entertainment",
  "Other"
];

const sleepEffects = [
  "Poor concentration",
  "Forgetfulness",
  "Irritability",
  "Low energy",
  "Low motivation",
  "More screen use",
  "Other"
];

let poll = null;
const pollResponses = new Map();
const wheelResponses = new Map();
const phoneResponses = new Map();
const sleepResponses = new Map();
const timeResponses = new Map();

function pollCounts() {
  const out = {};
  if (!poll) return out;
  poll.options.forEach(x => out[x] = 0);
  for (const a of pollResponses.values()) if (out[a] !== undefined) out[a]++;
  return out;
}

function average(values) {
  const clean = values.map(Number).filter(Number.isFinite);
  if (!clean.length) return 0;
  return +(clean.reduce((a, b) => a + b, 0) / clean.length).toFixed(2);
}

function wheelAvg() {
  const out = {};
  for (const c of wheelCategories) out[c] = 0;
  const n = wheelResponses.size;
  if (!n) return out;
  for (const s of wheelResponses.values()) {
    for (const c of wheelCategories) out[c] += Number(s[c] || 0);
  }
  for (const c of wheelCategories) out[c] = +(out[c] / n).toFixed(2);
  return out;
}

function phoneSummary() {
  const reasons = {};
  phoneReasons.forEach(r => reasons[r] = 0);
  const hours = [];
  for (const data of phoneResponses.values()) {
    if (Number.isFinite(data.hours)) hours.push(data.hours);
    for (const r of data.reasons || []) if (reasons[r] !== undefined) reasons[r]++;
  }
  return { responses: phoneResponses.size, averageHours: average(hours), reasonCounts: reasons };
}

function sleepSummary() {
  const effects = {};
  sleepEffects.forEach(e => effects[e] = 0);
  const weekday = [], weekend = [];
  for (const data of sleepResponses.values()) {
    if (Number.isFinite(data.weekday)) weekday.push(data.weekday);
    if (Number.isFinite(data.weekend)) weekend.push(data.weekend);
    for (const e of data.effects || []) if (effects[e] !== undefined) effects[e]++;
  }
  return {
    responses: sleepResponses.size,
    averageWeekday: average(weekday),
    averageWeekend: average(weekend),
    effectCounts: effects
  };
}

function timeSummary() {
  const categories = [
    "Sleep", "Classes / college", "Studying / assignments",
    "Phone / social media", "YouTube / gaming / OTT", "Travel / commuting",
    "Exercise / sports", "Friends / family", "Meals / routines",
    "Unplanned / doing nothing", "Other"
  ];
  const averages = {};
  categories.forEach(c => averages[c] = 0);
  const n = timeResponses.size;
  if (!n) return { responses: 0, averages };
  for (const data of timeResponses.values()) {
    for (const c of categories) averages[c] += Number(data[c] || 0);
  }
  for (const c of categories) averages[c] = +(averages[c] / n).toFixed(2);
  return { responses: n, averages };
}

function state() {
  return {
    poll,
    pollCounts: pollCounts(),
    pollResponses: pollResponses.size,
    wheelResponses: wheelResponses.size,
    wheelAverages: wheelAvg(),
    wheelCategories,
    phoneSummary: phoneSummary(),
    sleepSummary: sleepSummary(),
    timeSummary: timeSummary()
  };
}

function lanAddresses() {
  const nets = os.networkInterfaces();
  const arr = [];
  for (const name of Object.keys(nets)) {
    for (const x of nets[name] || []) {
      if (x.family === "IPv4" && !x.internal) arr.push(`http://${x.address}:${PORT}`);
    }
  }
  return arr;
}

app.get("/health", (req, res) => res.status(200).send("ok"));
app.get("/api/info", (req, res) => res.json({ port: PORT, urls: lanAddresses(), publicUrl: `${req.protocol}://${req.get("host")}` }));
app.get("/api/qr", (req, res) => {
  const target = req.query.url || "";
  QRCode.toDataURL(target, { margin: 1, width: 700 }, (e, data) => {
    if (e) return res.status(500).send("QR error");
    res.type("text/plain").send(data);
  });
});

io.on("connection", s => {
  s.on("join", ({ role, participantId }) => {
    s.data.role = role;
    if (role === "student") s.data.participantId = String(participantId || s.id);
    s.emit("init", state());
  });

  s.on("startPoll", p => {
    if (s.data.role !== "presenter") return;
    if (!p?.question || !Array.isArray(p.options) || p.options.length < 2) return;
    poll = { question: String(p.question), options: p.options.map(String) };
    pollResponses.clear();
    io.emit("pollStarted", poll);
    io.emit("state", state());
  });

  s.on("submitPoll", a => {
    if (!poll || !poll.options.includes(a)) return;
    pollResponses.set(s.data.participantId || s.id, a);
    s.emit("pollThanks");
    io.emit("state", state());
  });

  s.on("closePoll", () => {
    if (s.data.role !== "presenter") return;
    poll = null;
    pollResponses.clear();
    io.emit("pollClosed");
    io.emit("state", state());
  });

  s.on("submitTimeAudit", data => {
    const categories = [
      "Sleep", "Classes / college", "Studying / assignments",
      "Phone / social media", "YouTube / gaming / OTT", "Travel / commuting",
      "Exercise / sports", "Friends / family", "Meals / routines",
      "Unplanned / doing nothing", "Other"
    ];
    const clean = {};
    let total = 0;
    for (const c of categories) {
      const v = Number(data?.[c]);
      if (!Number.isFinite(v) || v < 0 || v > 24) return;
      clean[c] = v;
      total += v;
    }
    total = Math.round(total * 10) / 10;
    if (total !== 24) return;
    timeResponses.set(s.data.participantId || s.id, clean);
    s.emit("timeAuditSaved");
    io.emit("state", state());
  });

  s.on("submitWheel", scores => {
    const clean = {};
    for (const c of wheelCategories) {
      const v = Math.round(Number(scores?.[c]));
      if (v < 0 || v > 10 || !Number.isFinite(v)) return;
      clean[c] = v;
    }
    wheelResponses.set(s.data.participantId || s.id, clean);
    s.emit("wheelSaved");
    io.emit("state", state());
  });

  s.on("submitPhoneAudit", data => {
    const hours = Number(data?.hours);
    const reasons = Array.isArray(data?.reasons) ? data.reasons.map(String) : [];
    if (!Number.isFinite(hours) || hours < 0 || hours > 24) return;
    const cleanReasons = reasons.filter(r => phoneReasons.includes(r));
    phoneResponses.set(s.data.participantId || s.id, { hours, reasons: cleanReasons });
    s.emit("phoneSaved");
    io.emit("state", state());
  });

  s.on("submitSleep", data => {
    const weekday = Number(data?.weekday);
    const weekend = Number(data?.weekend);
    const effects = Array.isArray(data?.effects) ? data.effects.map(String) : [];
    if (![weekday, weekend].every(Number.isFinite) || weekday < 0 || weekday > 24 || weekend < 0 || weekend > 24) return;
    const cleanEffects = effects.filter(e => sleepEffects.includes(e));
    sleepResponses.set(s.data.participantId || s.id, { weekday, weekend, effects: cleanEffects });
    s.emit("sleepSaved");
    io.emit("state", state());
  });

  s.on("clearSession", () => {
    if (s.data.role !== "presenter") return;
    poll = null;
    pollResponses.clear();
    wheelResponses.clear();
    phoneResponses.clear();
    sleepResponses.clear();
    timeResponses.clear();
    io.emit("pollClosed");
    io.emit("state", state());
  });

  s.on("disconnect", () => {
    // Keep anonymous responses across temporary phone reconnects.
    // The presenter can clear the entire session explicitly.
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("\nHuman System Reset running on port " + PORT + "\nStudent URLs:\n" + lanAddresses().join("\n") + "\n");
});
