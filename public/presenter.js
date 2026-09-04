const s = io();
s.emit("join", { role: "presenter" });
let cats = [];

const studentUrl = document.querySelector("#studentUrl");
const qr = document.querySelector("#qr");
const options = document.querySelector("#options");
const question = document.querySelector("#question");
const addButton = document.querySelector("#add");
const startButton = document.querySelector("#start");
const closeButton = document.querySelector("#close");
const clearButton = document.querySelector("#clear");

fetch("/api/info").then(r => r.json()).then(d => {
  const base = (location.hostname === "localhost" || location.hostname === "127.0.0.1")
    ? (d.urls[0] || location.origin)
    : location.origin;

  const u = base + "/student";

  studentUrl.value = u;

  fetch("/api/qr?url=" + encodeURIComponent(u))
    .then(r => r.text())
    .then(x => qr.src = x);
});

function add(v = "") {
  const x = document.createElement("input");
  x.className = "opt";
  x.placeholder = "Answer option";
  x.value = v;
  options.appendChild(x);
}
add("Running well");
add("Running… but with a few glitches");
add("Seriously overloaded");
add("Please don't ask 😶");

addButton.onclick = () => add();
startButton.onclick = () => {
  const q = question.value.trim();
  const o = [...document.querySelectorAll(".opt")].map(x => x.value.trim()).filter(Boolean);
  if (!q || o.length < 2) return alert("Please enter a question and at least two options.");
  s.emit("startPoll", { question: q, options: o });
};
closeButton.onclick = () => s.emit("closePoll");
clearButton.onclick = () => { if (confirm("Clear all anonymous live data?")) s.emit("clearSession"); };

s.on("init", d => {
  cats = d.wheelCategories || [
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

  render(d);
});
s.on("state", render);

function render(d) {
  document.querySelector("#counts").textContent = `Poll ${d.pollResponses} · Time ${d.timeSummary.responses} · Phone ${d.phoneSummary.responses} · Sleep ${d.sleepSummary.responses} · Wheel ${d.wheelResponses}`;
  document.querySelector("#liveQ").textContent = d.poll ? d.poll.question : "Ready";

  const bars = document.querySelector("#bars");
  bars.innerHTML = "";
  if (d.poll) {
    const total = Math.max(1, d.pollResponses);
    d.poll.options.forEach(o => {
      const n = d.pollCounts[o] || 0, p = Math.round(n / total * 100);
      const row = document.createElement("div"); row.className = "bar";
      row.innerHTML = `<div class="barMeta"><span></span><span>${n} · ${p}%</span></div><div class="track"><div class="fill" style="width:${p}%"></div></div>`;
      row.querySelector(".barMeta span").textContent = o;
      bars.appendChild(row);
    });
  }

  document.querySelector("#wr").textContent = d.wheelResponses + " responses";
drawGroup(d.wheelAverages || {});
  const ts = d.timeSummary;

  
document.querySelector("#timeN").textContent =
  ts.responses + " responses";

renderMiniBars("timeBars", ts.averages, ts.responses, true);

  const ps = d.phoneSummary;
  document.querySelector("#phoneN").textContent = ps.responses + " responses";
  document.querySelector("#phoneAvg").textContent = ps.averageHours + " h/day";
  renderMiniBars("phoneBars", ps.reasonCounts, ps.responses);

  const ss = d.sleepSummary;
  document.querySelector("#sleepN").textContent = ss.responses + " responses";
  document.querySelector("#weekdayAvg").textContent = ss.averageWeekday + " h";
  document.querySelector("#weekendAvg").textContent = ss.averageWeekend + " h";
  renderMiniBars("sleepBars", ss.effectCounts, ss.responses);
}

function renderMiniBars(id, counts, total, isHours = false) {
  const box = document.getElementById(id);
  box.innerHTML = "";

  Object.entries(counts).forEach(([name, n]) => {
    const value = Number(n) || 0;

    let percentage;
    let display;

    if (isHours) {
      // 24-hour day = 100%
      percentage = Math.min(100, (value / 24) * 100);
      display = `${value.toFixed(1)} h`;
    } else {
      percentage = total
        ? Math.round((value / total) * 100)
        : 0;
      display = value;
    }

    const row = document.createElement("div");
    row.className = isHours ? "time-row" : "mini-bar";

    if (isHours) {
      row.innerHTML = `
        <div class="time-meta">
          <span class="time-name">${name}</span>
          <b>${display}</b>
        </div>

        <div class="time-track">
          <div class="time-fill" style="width:${percentage}%"></div>
        </div>
      `;
    } else {
      row.innerHTML = `
        <div class="mini-meta">
          <span>${name}</span>
          <span>${display}</span>
        </div>

        <div class="mini-track">
          <div class="fill" style="width:${percentage}%"></div>
        </div>
      `;
    }

    box.appendChild(row);
  });
}

function drawGroup(sc) {
  const step = Math.PI * 2 / cats.length;

  let svg = `
    <svg viewBox="0 0 700 700"
         width="100%"
         height="100%"
         role="img"
         aria-label="Consolidated Wheel of Life">

      <rect width="100%" height="100%" fill="#fff"/>

      <circle
        cx="${cx}"
        cy="${cy}"
        r="${R}"
        fill="none"
        stroke="#222"
        stroke-width="2"
      />
  `;

  // Wheel grid
  for (let k = 1; k <= 10; k++) {
    const r = R * k / 10;

    svg += `
      <polygon
        points="${poly(
          Array.from({ length: cats.length }, (_, i) => point(r, i))
        )}"
        fill="none"
        stroke="#cfcfcf"
        stroke-width="1"
      />
    `;
  }

  // Radial lines
  for (let i = 0; i < cats.length; i++) {
    const [x, y] = point(R, i);

    svg += `
      <line
        x1="${cx}"
        y1="${cy}"
        x2="${x}"
        y2="${y}"
        stroke="#cfcfcf"
        stroke-width="1"
      />
    `;
  }

  // Centre circle
  svg += `
    <circle
      cx="${cx}"
      cy="${cy}"
      r="50"
      fill="#fff"
      stroke="#222"
      stroke-width="1.5"
    />

    <text
      x="${cx}"
      y="${cy - 8}"
      text-anchor="middle"
      font-family="Arial,Helvetica,sans-serif"
      font-size="28"
      font-weight="800"
      fill="#111"
    >WHEEL</text>

    <text
      x="${cx}"
      y="${cy + 23}"
      text-anchor="middle"
      font-family="Arial,Helvetica,sans-serif"
      font-size="28"
      font-weight="800"
      fill="#111"
    >OF LIFE</text>
  `;

  // Scale numbers 1–10
  for (let k = 1; k <= 10; k++) {
    const r = R * k / 10;

    svg += `
      <text
        x="${cx + 6}"
        y="${cy - r + 4}"
        text-anchor="start"
        font-family="Arial,Helvetica,sans-serif"
        font-size="12"
        fill="#222"
      >${k}</text>
    `;
  }

  // Average student wheel
  const pts = cats.map((c, i) =>
    point(R * (Number(sc[c[0]]) / 10), i)
  );

  svg += `
    <polygon
      points="${poly(pts)}"
      fill="rgba(0,0,0,.07)"
      stroke="#222"
      stroke-width="4"
    />
  `;

  // Data points
  pts.forEach(([x, y]) => {
    svg += `
      <circle
        cx="${x}"
        cy="${y}"
        r="5"
        fill="#222"
      />
    `;
  });

  // Category labels
  cats.forEach((c, i) => {
    const a = -Math.PI / 2 + i * step;
    const lr = R + 105;

    const x = cx + Math.cos(a) * lr;
    const y = cy + Math.sin(a) * lr;

    let anchor = "middle";

    if (Math.cos(a) > 0.35) {
      anchor = "start";
    }

    if (Math.cos(a) < -0.35) {
      anchor = "end";
    }

    svg += textBlock(
      c[0].toUpperCase(),
      x,
      y - 20,
      anchor,
      14,
      800
    );

    svg += textBlock(
      labels[c[0]],
      x,
      y + 10,
      anchor,
      11,
      500
    );
  });

  svg += `</svg>`;

  out.innerHTML = svg;
}


function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  const lines = [];
  let line = "";

  words.forEach(word => {
    const test = line ? line + " " + word : word;

    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  });

  if (line) {
    lines.push(line);
  }

  const start = y - ((lines.length - 1) * lineHeight) / 2;

  lines.forEach((l, i) => {
    ctx.fillText(l, x, start + i * lineHeight);
  });
}
}
