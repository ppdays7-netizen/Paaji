/* ============================================================
   OPERATION DHURANDAR — frontend behaviour
   Particle field · boot loader · typewriter · decryption FX ·
   reveal-on-scroll · live mission completion + leaderboard.
   (Vanilla JS — no build step required.)
   ============================================================ */

/* ----------------------- particle background ----------------------- */
(function particles() {
  const canvas = document.getElementById('particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h, dots;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    const count = Math.min(90, Math.floor((w * h) / 18000));
    dots = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 1.8 + 0.4,
    }));
  }

  function tick() {
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < dots.length; i++) {
      const d = dots[i];
      d.x += d.vx; d.y += d.vy;
      if (d.x < 0 || d.x > w) d.vx *= -1;
      if (d.y < 0 || d.y > h) d.vy *= -1;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(63, 255, 159, 0.55)';
      ctx.fill();
      // link nearby dots
      for (let j = i + 1; j < dots.length; j++) {
        const o = dots[j];
        const dist = Math.hypot(d.x - o.x, d.y - o.y);
        if (dist < 120) {
          ctx.strokeStyle = `rgba(63, 255, 159, ${0.12 * (1 - dist / 120)})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(o.x, o.y); ctx.stroke();
        }
      }
    }
    requestAnimationFrame(tick);
  }
  window.addEventListener('resize', resize);
  resize(); tick();
})();

/* ----------------------------- boot loader ------------------------- */
(function bootLoader() {
  const loader = document.getElementById('boot-loader');
  if (!loader) { document.body.classList.add('booted'); return; }
  const log = document.getElementById('boot-log');
  const bar = document.getElementById('boot-bar');
  const lines = [
    'ACCESSING SECURE DATABASE...',
    'ESTABLISHING ENCRYPTED CHANNEL...',
    'AUTHENTICATING...',
    'DECRYPTING PERSONNEL RECORDS...',
    'CLEARANCE VERIFIED.',
  ];
  let i = 0;
  function next() {
    if (i < lines.length) {
      const el = document.createElement('div');
      el.innerHTML = `<span class="text-emerald-400/50">&gt;</span> ${lines[i]}`;
      log.appendChild(el);
      bar.style.width = `${((i + 1) / lines.length) * 100}%`;
      i++;
      setTimeout(next, 380 + Math.random() * 220);
    } else {
      setTimeout(() => document.body.classList.add('booted'), 450);
    }
  }
  // skip on click / key
  loader.addEventListener('click', () => document.body.classList.add('booted'));
  next();
})();

/* ------------------------------ live clock ------------------------- */
(function clock() {
  const el = document.getElementById('clock');
  if (!el) return;
  const tick = () => {
    const d = new Date();
    el.textContent = d.toISOString().slice(11, 19) + ' ZULU';
  };
  tick(); setInterval(tick, 1000);
})();

/* ----------------------------- typewriter -------------------------- */
window.typeWriter = function (el, text, speed = 45, done) {
  let i = 0;
  el.textContent = '';
  el.classList.add('cursor-blink');
  (function step() {
    if (i <= text.length) {
      el.textContent = text.slice(0, i);
      i++;
      setTimeout(step, speed);
    } else {
      el.classList.remove('cursor-blink');
      if (done) done();
    }
  })();
};

document.querySelectorAll('[data-typewriter]').forEach((el, idx) => {
  const text = el.getAttribute('data-typewriter');
  setTimeout(() => window.typeWriter(el, text, 40), 1800 + idx * 700);
});

/* -------------------------- decryption effect ---------------------- */
const SCRAMBLE = '█▓▒░#@$%&*0123456789ABCDEF';
document.querySelectorAll('[data-decrypt]').forEach((el) => {
  const finalText = el.getAttribute('data-decrypt');
  let frame = 0;
  const reveal = () => {
    let out = '';
    for (let i = 0; i < finalText.length; i++) {
      if (i < frame / 2) out += finalText[i];
      else out += SCRAMBLE[Math.floor(Math.random() * SCRAMBLE.length)];
    }
    el.textContent = out;
    frame++;
    if (frame / 2 < finalText.length) requestAnimationFrame(reveal);
    else el.textContent = finalText;
  };
  setTimeout(reveal, 2000);
});

/* --------------------------- reveal on scroll ---------------------- */
(function reveal() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('shown'); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
})();

/* --------------------------- animate XP bars ----------------------- */
window.addEventListener('load', () => {
  setTimeout(() => {
    document.querySelectorAll('.xp-fill').forEach((el) => {
      const pct = el.getAttribute('data-pct') || 0;
      el.style.width = Math.min(100, pct) + '%';
    });
  }, 600);
});

/* ---------------- mission completion (live, no reload) ------------- */
async function completeMission(taskId, btn) {
  btn.disabled = true;
  const original = btn.innerHTML;
  btn.innerHTML = 'TRANSMITTING...';
  try {
    const res = await fetch('/api/missions/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId }),
    });
    const data = await res.json();
    if (data.ok) {
      btn.closest('[data-mission]').classList.add('opacity-50');
      btn.outerHTML = '<span class="chip"><i data-lucide=\'check\' class=\'w-3 h-3\'></i> COMPLETED</span>';
      const xpEl = document.getElementById('my-xp');
      if (xpEl) xpEl.textContent = data.newTotal;
      const bar = document.getElementById('my-xp-bar');
      if (bar) bar.style.width = Math.min(100, (data.newTotal % 100)) + '%';
      lucide.createIcons();
      toast(`+${data.xp} XP AWARDED`, 'success');
      renderMiniLeaderboard(data.leaderboard);
    } else {
      btn.disabled = false; btn.innerHTML = original;
      toast(data.error || 'Action failed.', 'error');
    }
  } catch (e) {
    btn.disabled = false; btn.innerHTML = original;
    toast('Network fault.', 'error');
  }
}
window.completeMission = completeMission;

function renderMiniLeaderboard(rows) {
  const box = document.getElementById('mini-leaderboard');
  if (!box || !rows) return;
  box.innerHTML = rows.map((r) => `
    <div class="lb-row flex items-center justify-between px-3 py-2 rounded">
      <span class="font-mono text-sm"><span class="text-emerald-400/50">#${r.position}</span> ${r.username}</span>
      <span class="font-mono text-mil-green">${r.points}</span>
    </div>`).join('');
}

/* ------------------------------ toast ------------------------------ */
function toast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = 'flash-toast ' + (type === 'error' ? 'flash-error' : 'flash-success');
  t.innerHTML = `<span class="font-mono text-sm">${msg}</span>`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4800);
}
window.toast = toast;

/* ----------------------- map pin interaction ----------------------- */
window.openSector = function (id) {
  const panel = document.getElementById('sector-panel');
  const data = window.SECTORS && window.SECTORS[id];
  if (!panel || !data) return;
  panel.innerHTML = `
    <div class="flex items-center justify-between mb-3">
      <h3 class="font-head text-mil-green tracking-widest text-lg">${data.posting}</h3>
      <span class="chip-danger chip">CLASSIFIED</span>
    </div>
    <div class="space-y-1 font-mono text-sm text-emerald-100/80">
      <div>OFFICER: <span class="text-mil-green">${data.username}</span></div>
      <div>RANK: ${data.rank}</div>
      <div>CALLSIGN: ${data.callsign}</div>
      <div>CLEARANCE: ${data.clearance}</div>
      <div>STATUS: <span class="text-mil-amber">${data.status}</span></div>
    </div>
    <a href="/profile/${data.username}" class="btn-ghost text-xs mt-4 inline-flex">OPEN FULL DOSSIER</a>`;
  panel.classList.remove('opacity-0');
  document.querySelectorAll('.pin').forEach((p) => p.classList.remove('ring'));
};
