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

s.on("init", d => { cats = d.wheelCategories || []; render(d); });
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
  drawGroup(d.wheelAverages);

  const ts = d.timeSummary;

document.querySelector("#timeN").textContent =
  ts.responses + " responses";

renderTimeAudit(ts.averages);

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
  const host = document.getElementById("groupWheel");
  if (!host || !cats.length) return;

  const labels = {
    "Academic Performance": "Am I growing, learning\nand doing my best?",
    "Life Path": "Am I clear about\nmy goals and\nmoving forward?",
    "Friendship": "Do I have supportive,\nmeaningful\nfriendships?",
    "Mental Health": "Am I taking care of\nmy mind and\nemotions?",
    "Family": "Do I feel connected\nand supported by\nmy family?",
    "Fun": "Am I making time for\njoy, hobbies and\nthings I enjoy?",
    "Love": "Am I making time for\nlove, connection and\nhealthy relationships?",
    "Finances": "Am I managing my\nmoney wisely and\nplanning ahead?",
    "Physical Health": "Am I eating well,\nexercising and\ngetting enough rest?",
    "Spirituality": "Do I feel connected\nto something\nbigger than me?"
  };

  const W=980,H=820,cx=490,cy=410,R=285,n=cats.length,step=2*Math.PI/n;
  const point=(r,i)=>{const a=-Math.PI/2+i*step;return [cx+Math.cos(a)*r,cy+Math.sin(a)*r];};
  const poly=pts=>pts.map(p=>p.join(',')).join(' ');
  const esc=x=>String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const textBlock=(text,x,y,anchor='middle',size=13,weight=500)=>{
    const lines=String(text||'').split('\n'),lh=17,top=y-(lines.length-1)*lh/2;
    return `<text x="${x}" y="${top}" text-anchor="${anchor}" font-family="Arial,Helvetica,sans-serif" font-size="${size}" font-weight="${weight}" fill="#202124">${lines.map((l,j)=>`<tspan x="${x}" dy="${j?lh:0}">${esc(l)}</tspan>`).join('')}</text>`;
  };
  let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Consolidated Wheel of Life">
    <rect width="100%" height="100%" fill="#fff"/>
    <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#222" stroke-width="2"/>`;
  for(let k=1;k<=10;k++){
    const r=R*k/10; svg+=`<polygon points="${poly(Array.from({length:n},(_,i)=>point(r,i)))}" fill="none" stroke="#cfcfcf" stroke-width="1"/>`;
  }
  for(let i=0;i<n;i++){const [x,y]=point(R,i);svg+=`<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#cfcfcf" stroke-width="1"/>`;}
  svg+=`<circle cx="${cx}" cy="${cy}" r="78" fill="#fff" stroke="#222" stroke-width="1.5"/>
    <text x="${cx}" y="${cy-8}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="28" font-weight="800" fill="#111">WHEEL</text>
    <text x="${cx}" y="${cy+23}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="28" font-weight="800" fill="#111">OF LIFE</text>`;
  for(let k=1;k<=10;k++){const r=R*k/10;svg+=`<text x="${cx-13}" y="${cy-r+4}" text-anchor="end" font-family="Arial,Helvetica,sans-serif" font-size="12" fill="#444">${k}</text>`;}
  const pts=cats.map((c,i)=>point(R*(Number(sc[c]||0)/10),i));
  svg+=`<polygon points="${poly(pts)}" fill="rgba(0,0,0,.07)" stroke="#222" stroke-width="4"/>`;
  pts.forEach(([x,y])=>svg+=`<circle cx="${x}" cy="${y}" r="5" fill="#222"/>`);
  cats.forEach((c,i)=>{
    const a=-Math.PI/2+i*step,lr=R+105,x=cx+Math.cos(a)*lr,y=cy+Math.sin(a)*lr;
    let anchor='middle';if(Math.cos(a)>.35)anchor='start';if(Math.cos(a)<-.35)anchor='end';
    svg+=textBlock(c.toUpperCase(),x,y-20,anchor,14,800);
    svg+=textBlock(labels[c]||'',x,y+10,anchor,11,500);
  });
  svg+='</svg>';
  host.innerHTML=svg;
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" "), lines = []; let line = "";
  words.forEach(word => {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; } else line = test;
  });
  if (line) lines.push(line);
  const start = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => ctx.fillText(l, x, start + i * lineHeight));
}
