const s = io();
const participantKey = "humanSystemResetParticipantId";
let participantId = localStorage.getItem(participantKey);
if (!participantId) {
  participantId = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now());
  localStorage.setItem(participantKey, participantId);
}
s.emit("join", { role: "student", participantId });

let cats = [];
const phoneReasons = [
  "Notifications", "Boredom", "Habit / automatic", "Avoiding a task",
  "Checking something specific", "Social connection", "Entertainment", "Other"
];
const sleepEffects = [
  "Poor concentration", "Forgetfulness", "Irritability", "Low energy",
  "Low motivation", "More screen use", "Other"
];
const timeCategories = [
  "Sleep",
  "Classes / college",
  "Studying / assignments",
  "Phone / social media",
  "YouTube / gaming / OTT",
  "Travel / commuting",
  "Exercise / sports",
  "Friends / family",
  "Meals / routines",
  "Unplanned / doing nothing",
  "Other"
];

const slideNames = ["Live Poll", "24-Hour Time Audit", "Phone Audit", "Sleep & Brain", "Wheel of Life"];
let currentSlide = 0;
let touchStartX = null;

s.on("init", data => {
  cats = data.wheelCategories || [];
  buildWheel();
  buildChecks("phoneReasons", phoneReasons, "phoneReason");
  buildChecks("sleepEffects", sleepEffects, "sleepEffect");
  buildTimeAudit();
  setupCarousel();
});

s.on("pollStarted", p => {
  document.querySelector("#q").textContent = p.question;
  document.querySelector("#opts").innerHTML = "";
  p.options.forEach(x => {
    const b = document.createElement("button");
    b.className = "option";
    b.textContent = x;
    b.onclick = () => {
      s.emit("submitPoll", x);
      document.querySelector("#thanks").textContent = "Thank you. Your response has been recorded.";
    };
    document.querySelector("#opts").appendChild(b);
  });
});

s.on("pollClosed", () => {
  document.querySelector("#q").textContent = "Waiting for the live poll…";
  document.querySelector("#opts").innerHTML = "";
  document.querySelector("#thanks").textContent = "";
});

s.on("wheelSaved", () => document.querySelector("#personal").classList.remove("hidden"));
s.on("phoneSaved", () => document.querySelector("#phoneThanks").textContent = "Saved. Thank you.");
s.on("sleepSaved", () => document.querySelector("#sleepThanks").textContent = "Saved. Your written reflection stays on your phone.");
s.on("timeAuditSaved", () => document.querySelector("#timeThanks").textContent = "Saved. Thank you.");

function buildTimeAudit() {
  const container = document.querySelector("#timeInputs");
  container.innerHTML = "";
  timeCategories.forEach(category => {
    const row = document.createElement("div");
    row.className = "time-row";
    row.innerHTML = `
      <label>${category}
        <div class="time-entry">
          <input type="number" min="0" max="24" step="0.5" value="0" class="time-input" data-category="">
          <span>hours</span>
        </div>
      </label>`;
    const input = row.querySelector(".time-input");
    input.dataset.category = category;
    input.addEventListener("input", updateTimeTotal);
    container.appendChild(row);
  });
  updateTimeTotal();
}

function updateTimeTotal() {
  let total = 0;
  document.querySelectorAll(".time-input").forEach(input => {
    let value = Number(input.value);
    if (!Number.isFinite(value) || value < 0) value = 0;
    if (value > 24) value = 24;
    input.value = value;
    total += value;
  });
  total = Math.round(total * 10) / 10;
  document.querySelector("#timeTotal").textContent = total;
  const next = document.querySelector("#timeNext");
  if (total === 24) {
    next.disabled = false;
    next.textContent = "SAVE TIME AUDIT";
  } else {
    next.disabled = true;
    next.textContent = "Total must equal 24 hours";
  }
}

function setupCarousel() {
  const carousel = document.querySelector("#carousel");
  const dots = document.querySelector("#dots");
  dots.innerHTML = "";
  slideNames.forEach((name, i) => {
    const dot = document.createElement("button");
    dot.className = "dot" + (i === 0 ? " active" : "");
    dot.setAttribute("aria-label", `Go to ${name}`);
    dot.onclick = () => goToSlide(i);
    dots.appendChild(dot);
  });

  document.querySelector("#prevSlide").onclick = () => goToSlide(currentSlide - 1);
  document.querySelector("#nextSlide").onclick = () => goToSlide(currentSlide + 1);

  carousel.addEventListener("touchstart", e => {
    touchStartX = e.changedTouches[0].screenX;
  }, {passive:true});
  carousel.addEventListener("touchend", e => {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].screenX - touchStartX;
    if (Math.abs(dx) > 45) goToSlide(currentSlide + (dx < 0 ? 1 : -1));
    touchStartX = null;
  }, {passive:true});

  // Mouse drag support makes desktop testing easy.
  let mouseX = null;
  carousel.addEventListener("mousedown", e => { mouseX = e.clientX; });
  carousel.addEventListener("mouseup", e => {
    if (mouseX === null) return;
    const dx = e.clientX - mouseX;
    if (Math.abs(dx) > 55) goToSlide(currentSlide + (dx < 0 ? 1 : -1));
    mouseX = null;
  });

  goToSlide(0);
}

function goToSlide(index) {
  currentSlide = Math.max(0, Math.min(slideNames.length - 1, index));
  const carousel = document.querySelector("#carousel");
  carousel.scrollTo({left: currentSlide * carousel.clientWidth, behavior: "smooth"});
  document.querySelectorAll(".dot").forEach((dot, i) => dot.classList.toggle("active", i === currentSlide));
  document.querySelector("#slideLabel").textContent = `${currentSlide + 1} · ${slideNames[currentSlide]}`;
  document.querySelector("#prevSlide").disabled = currentSlide === 0;
  document.querySelector("#nextSlide").disabled = currentSlide === slideNames.length - 1;
}

function buildWheel() {
  const form = document.querySelector("#wheelForm");
  form.innerHTML = "";
  cats.forEach(c => {
    const row = document.createElement("div");
    row.className = "system-row";
    row.innerHTML = `
      <div class="system-top">
        <span class="system-name"></span>
        <span class="score">5/10</span>
      </div>
      <input type="range" min="0" max="10" value="5" data-c="" class="system-slider">
      <div class="scale">${Array.from({length:11}, (_,i)=>`<span>${i}</span>`).join("")}</div>`;
    row.querySelector(".system-name").textContent = c;
    const slider = row.querySelector(".system-slider");
    slider.dataset.c = c;
    slider.addEventListener("input", () => row.querySelector(".score").textContent = slider.value + "/10");
    form.appendChild(row);
  });
}

function buildChecks(id, items, prefix) {
  const box = document.getElementById(id);
  box.innerHTML = "";
  items.forEach((item, i) => {
    const label = document.createElement("label");
    label.className = "check";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.id = `${prefix}-${i}`;
    input.value = item;
    label.append(input, document.createTextNode(item));
    box.appendChild(label);
  });
}

function checkedValues(prefix) {
  return [...document.querySelectorAll(`input[id^="${prefix}-"]:checked`)].map(x => x.value);
}

document.querySelector("#timeNext").onclick = () => {
  const timeData = {};
  document.querySelectorAll(".time-input").forEach(input => {
    timeData[input.dataset.category] = Number(input.value);
  });
  s.emit("submitTimeAudit", timeData);
};

document.querySelector("#submitWheel").onclick = () => {
  const scores = {};
  document.querySelectorAll(".system-slider").forEach(slider => scores[slider.dataset.c] = Number(slider.value));
  s.emit("submitWheel", scores);
  drawWheel("myWheel", scores);
};

document.querySelector("#submitPhone").onclick = () => {
  const hours = Number(document.querySelector("#phoneHours").value);
  if (!Number.isFinite(hours) || hours < 0 || hours > 24) return alert("Please enter your approximate daily phone hours (0–24).");
  s.emit("submitPhoneAudit", { hours, reasons: checkedValues("phoneReason") });
};

document.querySelector("#submitSleep").onclick = () => {
  const weekday = Number(document.querySelector("#weekdaySleep").value);
  const weekend = Number(document.querySelector("#weekendSleep").value);
  if (![weekday, weekend].every(Number.isFinite) || weekday < 0 || weekday > 24 || weekend < 0 || weekend > 24) return alert("Please enter both weekday and weekend sleep hours.");
  s.emit("submitSleep", { weekday, weekend, effects: checkedValues("sleepEffect"), cost: document.querySelector("#sleepCost").value.trim() });
};

function drawWheel(id, scores) {
  const host = document.getElementById(id);
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
  const W = 760, H = 760, cx = 380, cy = 380, R = 255, n = cats.length, step = 2 * Math.PI / n;
  const esc = x => String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const point = (r, i) => { const a = -Math.PI/2 + i*step; return [cx + Math.cos(a)*r, cy + Math.sin(a)*r]; };
  const poly = pts => pts.map(p => p.join(',')).join(' ');
  const textBlock = (text, x, y, anchor='middle', size=13, weight=500) => {
    const lines = String(text || '').split('\n'), lineH = 16, top = y - (lines.length-1)*lineH/2;
    return `<text x="${x}" y="${top}" text-anchor="${anchor}" font-family="Arial,Helvetica,sans-serif" font-size="${size}" font-weight="${weight}" fill="#202124">${lines.map((l,j)=>`<tspan x="${x}" dy="${j?lineH:0}">${esc(l)}</tspan>`).join('')}</text>`;
  };
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="My Wheel of Life"><rect width="100%" height="100%" fill="#fff"/><circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#222" stroke-width="2"/>`;
  for(let k=1;k<=10;k++){ const r=R*k/10; svg += `<polygon points="${poly(Array.from({length:n},(_,i)=>point(r,i)))}" fill="none" stroke="#cfcfcf" stroke-width="1"/>`; }
  for(let i=0;i<n;i++){ const [x,y]=point(R,i); svg += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#cfcfcf" stroke-width="1"/>`; }
  svg += `<circle cx="${cx}" cy="${cy}" r="70" fill="#fff" stroke="#222" stroke-width="1.5"/><text x="${cx}" y="${cy-8}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="25" font-weight="800" fill="#111">WHEEL</text><text x="${cx}" y="${cy+20}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="25" font-weight="800" fill="#111">OF LIFE</text>`;
  for(let k=1;k<=10;k++){ const r=R*k/10; svg += `<text x="${cx-12}" y="${cy-r+4}" text-anchor="end" font-family="Arial,Helvetica,sans-serif" font-size="11" fill="#444">${k}</text>`; }
  const scorePts=cats.map((c,i)=>point(R*(Number(scores[c]||0)/10),i));
  svg += `<polygon points="${poly(scorePts)}" fill="rgba(0,0,0,.07)" stroke="#222" stroke-width="3"/>`;
  scorePts.forEach(([x,y])=>{svg += `<circle cx="${x}" cy="${y}" r="4" fill="#222"/>`;});
  cats.forEach((c,i)=>{ const a=-Math.PI/2+i*step, lr=R+92, x=cx+Math.cos(a)*lr, y=cy+Math.sin(a)*lr; let anchor='middle'; if(Math.cos(a)>0.35)anchor='start'; if(Math.cos(a)<-0.35)anchor='end'; svg += textBlock(c.toUpperCase(),x,y-18,anchor,13,800); svg += textBlock(labels[c]||'',x,y+8,anchor,11,500); });
  svg += `</svg>`;
  host.innerHTML=svg;
}
