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


// ============================================================
// STUDENT LINK + QR CODE
// ============================================================

fetch("/api/info")
  .then(r => r.json())
  .then(d => {

    const base =
      (location.hostname === "localhost" ||
       location.hostname === "127.0.0.1")
        ? (d.urls && d.urls[0] ? d.urls[0] : location.origin)
        : location.origin;

    const u = base + "/student";

    studentUrl.value = u;

    return fetch("/api/qr?url=" + encodeURIComponent(u));
  })
  .then(r => r.text())
  .then(x => {
    qr.src = x;
  })
  .catch(err => {
    console.error("QR code error:", err);
  });


// ============================================================
// LIVE POLL SETUP
// ============================================================

function addOption(value = "") {

  const input = document.createElement("input");

  input.className = "opt";
  input.placeholder = "Answer option";
  input.value = value;

  options.appendChild(input);
}


addOption("Running well");
addOption("Running… but with a few glitches");
addOption("Seriously overloaded");
addOption("Please don't ask 😶");


addButton.onclick = () => {
  addOption();
};


startButton.onclick = () => {

  const q = question.value.trim();

  const o = [...document.querySelectorAll(".opt")]
    .map(x => x.value.trim())
    .filter(Boolean);

  if (!q || o.length < 2) {
    alert("Please enter a question and at least two options.");
    return;
  }

  s.emit("startPoll", {
    question: q,
    options: o
  });
};


closeButton.onclick = () => {
  s.emit("closePoll");
};


clearButton.onclick = () => {

  if (confirm("Clear all anonymous live data?")) {
    s.emit("clearSession");
  }
};


// ============================================================
// SOCKET EVENTS
// ============================================================

s.on("init", d => {

  cats = normalizeCategories(
    d.wheelCategories || [
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
    ]
  );

  render(d);
});


s.on("state", d => {
  render(d);
});


// ============================================================
// MAIN RENDER
// ============================================================

function render(d) {

  if (!d) return;


  // ----------------------------------------------------------
  // COUNTERS
  // ----------------------------------------------------------

  const pollResponses = Number(d.pollResponses || 0);

  const timeResponses =
    d.timeSummary && Number(d.timeSummary.responses || 0);

  const phoneResponses =
    d.phoneSummary && Number(d.phoneSummary.responses || 0);

  const sleepResponses =
    d.sleepSummary && Number(d.sleepSummary.responses || 0);

  const wheelResponses =
    Number(d.wheelResponses || 0);


  document.querySelector("#counts").textContent =
    `Poll ${pollResponses} · ` +
    `Time ${timeResponses} · ` +
    `Phone ${phoneResponses} · ` +
    `Sleep ${sleepResponses} · ` +
    `Wheel ${wheelResponses}`;


  // ----------------------------------------------------------
  // LIVE POLL
  // ----------------------------------------------------------

  document.querySelector("#liveQ").textContent =
    d.poll ? d.poll.question : "Ready";


  const bars = document.querySelector("#bars");

  bars.innerHTML = "";


  if (d.poll) {

    const total = Math.max(1, pollResponses);

    d.poll.options.forEach(option => {

      const n =
        d.pollCounts && d.pollCounts[option]
          ? Number(d.pollCounts[option])
          : 0;

      const percentage =
        Math.round((n / total) * 100);


      const row = document.createElement("div");

      row.className = "bar";

      row.innerHTML = `
        <div class="barMeta">
          <span>${escapeHTML(option)}</span>
          <span>${n} · ${percentage}%</span>
        </div>

        <div class="track">
          <div
            class="fill"
            style="width:${percentage}%">
          </div>
        </div>
      `;

      bars.appendChild(row);
    });
  }


  // ----------------------------------------------------------
  // WHEEL OF LIFE
  // ----------------------------------------------------------

  document.querySelector("#wr").textContent =
    wheelResponses + " responses";

  drawGroup(d.wheelAverages || {});


  // ----------------------------------------------------------
  // 24-HOUR TIME AUDIT
  // ----------------------------------------------------------

  const ts = d.timeSummary || {
    responses: 0,
    averages: {}
  };


  document.querySelector("#timeN").textContent =
    Number(ts.responses || 0) + " responses";


  document.querySelector("#timeTotal").textContent =
    "24 h";


  renderTimeAudit(ts.averages || {});


  // Existing lower time-audit card
  renderMiniBars(
    "timeBars",
    ts.averages || {},
    ts.responses || 0,
    true
  );


  // ----------------------------------------------------------
  // PHONE AUDIT
  // ----------------------------------------------------------

  const ps = d.phoneSummary || {
    responses: 0,
    averageHours: 0,
    reasonCounts: {}
  };


  document.querySelector("#phoneN").textContent =
    Number(ps.responses || 0) + " responses";


  document.querySelector("#phoneAvg").textContent =
    Number(ps.averageHours || 0) + " h/day";


  renderMiniBars(
    "phoneBars",
    ps.reasonCounts || {},
    ps.responses || 0,
    false
  );


  // ----------------------------------------------------------
  // SLEEP AUDIT
  // ----------------------------------------------------------

  const ss = d.sleepSummary || {
    responses: 0,
    averageWeekday: 0,
    averageWeekend: 0,
    effectCounts: {}
  };


  document.querySelector("#sleepN").textContent =
    Number(ss.responses || 0) + " responses";


  document.querySelector("#weekdayAvg").textContent =
    Number(ss.averageWeekday || 0) + " h";


  document.querySelector("#weekendAvg").textContent =
    Number(ss.averageWeekend || 0) + " h";


  renderMiniBars(
    "sleepBars",
    ss.effectCounts || {},
    ss.responses || 0,
    false
  );
}


// ============================================================
// 24-HOUR TIME AUDIT — VISUAL TIMELINE
// ============================================================

function renderTimeAudit(averages) {

  const timeline =
    document.querySelector("#timeTimeline");

  const legend =
    document.querySelector("#timeLegend");


  if (!timeline) return;


  timeline.innerHTML = "";

  if (legend) {
    legend.innerHTML = "";
  }


  const entries = Object.entries(averages || {});


  if (!entries.length) {

    timeline.innerHTML = `
      <div class="tiny center">
        Waiting for student responses…
      </div>
    `;

    return;
  }


  // ----------------------------------------------------------
  // Clean numerical values
  // ----------------------------------------------------------

  const cleaned = entries.map(([name, value]) => ({
    name,
    value: Math.max(0, Number(value) || 0)
  }));


  // ----------------------------------------------------------
  // Horizontal 24-hour stacked bar
  // ----------------------------------------------------------

  const stack = document.createElement("div");

  stack.style.display = "flex";
  stack.style.width = "100%";
  stack.style.height = "54px";
  stack.style.borderRadius = "12px";
  stack.style.overflow = "hidden";
  stack.style.border = "1px solid #ddd";
  stack.style.background = "#f5f5f5";


  cleaned.forEach(item => {

    const width =
      Math.min(100, (item.value / 24) * 100);


    const segment =
      document.createElement("div");


    segment.style.width = width + "%";
    segment.style.height = "100%";
    segment.style.display = "flex";
    segment.style.alignItems = "center";
    segment.style.justifyContent = "center";
    segment.style.fontSize = "11px";
    segment.style.fontWeight = "700";
    segment.style.overflow = "hidden";
    segment.style.whiteSpace = "nowrap";
    segment.style.borderRight = "1px solid white";


    segment.title =
      `${item.name}: ${item.value.toFixed(1)} h`;


    segment.textContent =
      item.value >= 1
        ? item.value.toFixed(1) + "h"
        : "";


    stack.appendChild(segment);
  });


  timeline.appendChild(stack);


  // ----------------------------------------------------------
  // Legend
  // ----------------------------------------------------------

  if (legend) {

    cleaned.forEach(item => {

      const itemBox =
        document.createElement("div");


      itemBox.style.display = "flex";
      itemBox.style.justifyContent = "space-between";
      itemBox.style.alignItems = "center";
      itemBox.style.padding = "4px 0";


      itemBox.innerHTML = `
        <span>${escapeHTML(item.name)}</span>
        <b>${item.value.toFixed(1)} h</b>
      `;


      legend.appendChild(itemBox);
    });
  }
}


// ============================================================
// MINI BAR CHARTS
// ============================================================

function renderMiniBars(id, counts, total, isHours = false) {

  const box = document.getElementById(id);

  if (!box) return;


  box.innerHTML = "";


  const entries =
    Object.entries(counts || {});


  if (!entries.length) {

    box.innerHTML = `
      <p class="tiny">No responses yet.</p>
    `;

    return;
  }


  entries.forEach(([name, n]) => {

    const value =
      Number(n) || 0;


    let percentage;
    let display;


    if (isHours) {

      percentage =
        Math.min(
          100,
          (value / 24) * 100
        );


      display =
        value.toFixed(1) + " h";

    } else {

      percentage =
        total
          ? Math.round(
              (value / total) * 100
            )
          : 0;


      display = value;
    }


    const row =
      document.createElement("div");


    row.className =
      isHours
        ? "time-row"
        : "mini-bar";


    if (isHours) {

      row.innerHTML = `
        <div class="time-meta">
          <span class="time-name">
            ${escapeHTML(name)}
          </span>

          <b>${display}</b>
        </div>

        <div class="time-track">
          <div
            class="time-fill"
            style="width:${percentage}%">
          </div>
        </div>
      `;

    } else {

      row.innerHTML = `
        <div class="mini-meta">
          <span>
            ${escapeHTML(name)}
          </span>

          <span>${display}</span>
        </div>

        <div class="mini-track">
          <div
            class="fill"
            style="width:${percentage}%">
          </div>
        </div>
      `;
    }


    box.appendChild(row);
  });
}


// ============================================================
// WHEEL OF LIFE
// ============================================================

function drawGroup(sc) {

  const out =
    document.querySelector("#groupWheel");


  if (!out) return;


  // ----------------------------------------------------------
  // Wheel dimensions
  // ----------------------------------------------------------

  const width = 700;
  const height = 700;

  const cx = width / 2;
  const cy = height / 2;

  const R = 210;

  const step =
    (Math.PI * 2) / cats.length;


  // ----------------------------------------------------------
  // Start SVG
  // ----------------------------------------------------------

  let svg = `
    <svg
      viewBox="0 0 ${width} ${height}"
      width="100%"
      height="100%"
      role="img"
      aria-label="Consolidated Wheel of Life">

      <rect
        width="100%"
        height="100%"
        fill="#fff">
      </rect>

      <circle
        cx="${cx}"
        cy="${cy}"
        r="${R}"
        fill="none"
        stroke="#222"
        stroke-width="2">
      </circle>
  `;


  // ----------------------------------------------------------
  // Wheel grid — 1 to 10
  // ----------------------------------------------------------

  for (let k = 1; k <= 10; k++) {

    const r =
      R * k / 10;


    const points =
      cats
        .map((_, i) => point(r, i))
        .map(p => p.join(","))
        .join(" ");


    svg += `
      <polygon
        points="${points}"
        fill="none"
        stroke="#cfcfcf"
        stroke-width="1">
      </polygon>
    `;
  }


  // ----------------------------------------------------------
  // Radial lines
  // ----------------------------------------------------------

  for (let i = 0; i < cats.length; i++) {

    const [x, y] =
      point(R, i);


    svg += `
      <line
        x1="${cx}"
        y1="${cy}"
        x2="${x}"
        y2="${y}"
        stroke="#cfcfcf"
        stroke-width="1">
      </line>
    `;
  }


  // ----------------------------------------------------------
  // Scale numbers
  // ----------------------------------------------------------

  for (let k = 1; k <= 10; k++) {

    const r =
      R * k / 10;


    svg += `
      <text
        x="${cx + 7}"
        y="${cy - r + 4}"
        text-anchor="start"
        font-family="Arial,Helvetica,sans-serif"
        font-size="12"
        fill="#222">
        ${k}
      </text>
    `;
  }


  // ----------------------------------------------------------
  // Centre circle
  // ----------------------------------------------------------

  svg += `
    <circle
      cx="${cx}"
      cy="${cy}"
      r="58"
      fill="#fff"
      stroke="#222"
      stroke-width="1.5">
    </circle>

    <text
      x="${cx}"
      y="${cy - 8}"
      text-anchor="middle"
      font-family="Arial,Helvetica,sans-serif"
      font-size="23"
      font-weight="800"
      fill="#111">
      WHEEL
    </text>

    <text
      x="${cx}"
      y="${cy + 22}"
      text-anchor="middle"
      font-family="Arial,Helvetica,sans-serif"
      font-size="23"
      font-weight="800"
      fill="#111">
      OF LIFE
    </text>
  `;


  // ----------------------------------------------------------
  // Average student wheel
  // ----------------------------------------------------------

  const pts =
    cats.map((category, i) => {

      const value =
        getWheelValue(
          sc,
          category
        );


      const safeValue =
        Math.max(
          0,
          Math.min(10, value)
        );


      return point(
        R * (safeValue / 10),
        i
      );
    });


  svg += `
    <polygon
      points="${pts.map(p => p.join(",")).join(" ")}"
      fill="rgba(0,0,0,.07)"
      stroke="#222"
      stroke-width="4">
    </polygon>
  `;


  // ----------------------------------------------------------
  // Data points
  // ----------------------------------------------------------

  pts.forEach(([x, y]) => {

    svg += `
      <circle
        cx="${x}"
        cy="${y}"
        r="5"
        fill="#222">
      </circle>
    `;
  });


  // ----------------------------------------------------------
  // Category labels
  // ----------------------------------------------------------

  cats.forEach((category, i) => {

    const a =
      -Math.PI / 2 +
      i * step;


    const labelRadius =
      R + 105;


    const x =
      cx + Math.cos(a) * labelRadius;


    const y =
      cy + Math.sin(a) * labelRadius;


    let anchor = "middle";


    if (Math.cos(a) > 0.35) {
      anchor = "start";
    }


    if (Math.cos(a) < -0.35) {
      anchor = "end";
    }


    const name =
      category;


    svg += `
      <text
        x="${x}"
        y="${y - 6}"
        text-anchor="${anchor}"
        font-family="Arial,Helvetica,sans-serif"
        font-size="14"
        font-weight="800"
        fill="#111">
        ${escapeHTML(name).toUpperCase()}
      </text>
    `;
  });


  // ----------------------------------------------------------
  // Close SVG
  // ----------------------------------------------------------

  svg += `</svg>`;


  out.innerHTML = svg;


  // ----------------------------------------------------------
  // SVG point helper
  // ----------------------------------------------------------

  function point(radius, index) {

    const angle =
      -Math.PI / 2 +
      index * step;


    return [
      cx + Math.cos(angle) * radius,
      cy + Math.sin(angle) * radius
    ];
  }
}


// ============================================================
// WHEEL DATA HELPERS
// ============================================================

function normalizeCategories(input) {

  if (!Array.isArray(input)) {
    return [];
  }


  return input
    .map(item => {

      if (typeof item === "string") {
        return item;
      }


      if (Array.isArray(item)) {
        return String(item[0] || "");
      }


      if (item && typeof item === "object") {

        return String(
          item.name ||
          item.label ||
          item.category ||
          ""
        );
      }


      return "";
    })
    .filter(Boolean);
}


function getWheelValue(data, category) {

  if (!data) return 0;


  // Exact key
  if (data[category] !== undefined) {
    return Number(data[category]) || 0;
  }


  // Case-insensitive match
  const target =
    String(category).trim().toLowerCase();


  const key =
    Object.keys(data).find(k =>
      String(k).trim().toLowerCase() === target
    );


  if (key !== undefined) {
    return Number(data[key]) || 0;
  }


  return 0;
}


// ============================================================
// HTML SAFETY
// ============================================================

function escapeHTML(value) {

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
