// app.js
async function apiGetQuestion(level, usedIdsSet) {
  const exclude = Array.from(usedIdsSet).join(",");
  const r = await fetch(
    `/api/question?level=${encodeURIComponent(
      level
    )}&exclude=${encodeURIComponent(exclude)}`
  );
  return r.json();
}

async function apiGrade(id, choice) {
  const r = await fetch(`/api/grade`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, choice }),
  });
  return r.json();
}

async function apiSubmit(payload) {
  const r = await fetch(`/api/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return r.json();
}

async function apiLeaderboard(mode = "exam", limit = 20) {
  const r = await fetch(
    `/api/leaderboard?mode=${encodeURIComponent(mode)}&limit=${limit}`
  );
  return r.json();
}
let soundOn = true;
function beep(freq = 440, ms = 120) {
  if (!soundOn) return;
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.value = freq;
  o.connect(g);
  g.connect(ctx.destination);
  g.gain.value = 0.06;
  o.start();
  setTimeout(() => {
    o.stop();
    ctx.close();
  }, ms);
}

(() => {
  const $ = (id) => document.getElementById(id);

  // Theme
  const root = document.documentElement;
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme) root.setAttribute("data-theme", savedTheme);

  $("btnToggleTheme").addEventListener("click", () => {
    const cur = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    if (cur === "dark") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", "light");
    localStorage.setItem("theme", cur === "dark" ? "dark" : "light");
  });

  // Session: không trùng câu trong 1 phiên (reload là phiên mới)
  let session = null;

  function newSession() {
    // clone + shuffle theo level
    const all = (window.QUESTION_BANK || []).slice();
    const byLevel = { E: [], M: [], H: [] };
    all.forEach((q) => byLevel[q.level].push(q));

    const shuffle = (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };

    session = {
      pools: {
        E: shuffle(byLevel.E),
        M: shuffle(byLevel.M),
        H: shuffle(byLevel.H),
      },
      used: { E: 0, M: 0, H: 0 },
      current: null,
      locked: false,
      lastLevel: null,
    };

    updateStats();
    clearQuizUI(true);
  }

  $("btnNewSession").addEventListener("click", newSession);

  // UI helpers
  function levelLabel(lv) {
    if (lv === "E") return "DỄ";
    if (lv === "M") return "TRUNG BÌNH";
    return "KHÓ";
  }

  function updateStats() {
    $("statEasy").textContent = session.used.E;
    $("statMed").textContent = session.used.M;
    $("statHard").textContent = session.used.H;
  }

  function clearQuizUI(toEmpty) {
    $("feedback").textContent = "";
    $("feedback").className = "feedback";
    $("btnNext").disabled = true;

    if (toEmpty) {
      $("quizEmpty").classList.remove("hidden");
      $("quizBody").classList.add("hidden");
      $("badgeLevel").textContent = "—";
      $("badgeIndex").textContent = "—";
    }
  }

  function showQuestion(q, lv) {
    $("quizEmpty").classList.add("hidden");
    $("quizBody").classList.remove("hidden");

    $("badgeLevel").textContent = `MỨC: ${levelLabel(lv)}`;
    $("badgeIndex").textContent = `ID: ${q.id}`;

    $("questionText").textContent = q.q;

    const options = [
      { key: "A", text: q.A },
      { key: "B", text: q.B },
      { key: "C", text: q.C },
      { key: "D", text: q.D },
    ];

    const wrap = $("options");
    wrap.innerHTML = "";
    options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.className = "opt";
      btn.innerHTML = `<b>${opt.key}.</b> ${opt.text}`;
      btn.addEventListener("click", () => chooseAnswer(opt.key, q.ans, btn));
      wrap.appendChild(btn);
    });

    $("feedback").textContent = "Chọn A/B/C/D";
    $("feedback").className = "feedback";
    $("btnNext").disabled = true;
  }

  function chooseAnswer(chosen, correct, chosenBtn) {
    if (session.locked) return;
    session.locked = true;

    const allBtns = Array.from(document.querySelectorAll(".opt"));
    allBtns.forEach((b) => (b.disabled = true));

    const correctBtn = allBtns.find((b) =>
      b.innerText.trim().startsWith(correct + ".")
    );
    if (chosen === correct) {
      chosenBtn.classList.add("correct");
      $("feedback").textContent =
        "✅ Chuẩn! Nhấn “Câu tiếp theo” hoặc quay tiếp.";
      $("feedback").className = "feedback good";
    } else {
      chosenBtn.classList.add("wrong");
      if (correctBtn) correctBtn.classList.add("correct");
      $("feedback").textContent = `❌ Sai rồi. Đáp án đúng là ${correct}.`;
      $("feedback").className = "feedback bad";
    }

    $("btnNext").disabled = false;
  }

  $("btnNext").addEventListener("click", () => {
    if (!session || !session.lastLevel) return;
    pickQuestion(session.lastLevel);
  });

  // Pick question from a level
  function pickQuestion(level) {
    const pool = session.pools[level];
    if (!pool || pool.length === 0) {
      $("feedback").textContent = `⚠️ Hết câu mức ${levelLabel(
        level
      )} trong phiên này. Bấm “Phiên mới” để chơi lại.`;
      $("feedback").className = "feedback bad";
      $("btnNext").disabled = true;
      return;
    }

    const q = pool.shift(); // đã shuffle nên lấy đầu là random
    session.used[level] += 1;
    session.current = q;
    session.lastLevel = level;
    session.locked = false;

    updateStats();
    showQuestion(q, level);
  }

  // ===================== WHEEL =====================
  const canvas = $("wheel");
  const ctx = canvas.getContext("2d");

  const segments = [
    { label: "DỄ", level: "E" },
    { label: "TRUNG BÌNH", level: "M" },
    { label: "KHÓ", level: "H" },
    { label: "DỄ", level: "E" },
    { label: "TRUNG BÌNH", level: "M" },
    { label: "KHÓ", level: "H" },
  ];

  let angle = 0; // radians
  let spinning = false;

  function drawWheel() {
    const w = canvas.width,
      h = canvas.height;
    const cx = w / 2,
      cy = h / 2;
    const r = Math.min(cx, cy) - 8;

    ctx.clearRect(0, 0, w, h);

    // ring glow-ish
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.stroke();

    const segAngle = (Math.PI * 2) / segments.length;

    for (let i = 0; i < segments.length; i++) {
      const start = angle + i * segAngle;
      const end = start + segAngle;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, end);
      ctx.closePath();

      // colors by level (no fixed palette, just stable)
      const lv = segments[i].level;
      const fill =
        lv === "E"
          ? "rgba(124,255,181,0.20)"
          : lv === "M"
          ? "rgba(255,211,107,0.22)"
          : "rgba(255,107,107,0.20)";

      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.stroke();

      // text
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(start + segAngle / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = "700 16px system-ui";
      ctx.fillText(segments[i].label, r - 16, 6);
      ctx.restore();
    }

    // center cap
    ctx.beginPath();
    ctx.arc(cx, cy, 42, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.20)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "800 14px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("QUAY", cx, cy + 5);
  }

  function getSelectedSegment() {
    // pointer is at top (−90°). convert angle to index
    const segAngle = (Math.PI * 2) / segments.length;
    const pointerAngle = (Math.PI * 3) / 2; // 270° = top in canvas math
    const a = (pointerAngle - angle) % (Math.PI * 2);
    const norm = (a + Math.PI * 2) % (Math.PI * 2);
    const idx = Math.floor(norm / segAngle);
    return segments[idx];
  }

  function spin() {
    if (spinning) return;
    spinning = true;

    const spinTurns = 6 + Math.random() * 4; // 6-10 vòng
    const target =
      angle + spinTurns * Math.PI * 2 + Math.random() * Math.PI * 2;

    const start = performance.now();
    const dur = 2600 + Math.random() * 700;

    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const a0 = angle;
    const delta = target - a0;

    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      angle = a0 + delta * easeOutCubic(t);
      drawWheel();

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        spinning = false;
        const sel = getSelectedSegment();
        pickQuestion(sel.level);
      }
    };

    requestAnimationFrame(tick);
  }

  $("btnSpin").addEventListener("click", () => {
    if (!session) newSession();
    spin();
  });

  // init
  newSession();
  drawWheel();
})();
