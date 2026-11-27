const { ipcRenderer } = require('electron');

let watchArmed = false;
let prevScore = '';
let lastHref = '';
let noScore = false;
let observedScoreNode = null;
let scoreObserver = null;
let evalQueued = false;
let pageTick = 0;
let btnTick = 0;

// Strict dash score parser ("0 - 0", "1-0", "2–1"): never colon times like "20:30"
const SCORE_RE = /^(\d{1,3})\s*[-–—]\s*(\d{1,3})$/;

function norm(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function parseScoreText(raw) {
  const m = SCORE_RE.exec(norm(raw));
  return m ? `${Number(m[1])} - ${Number(m[2])}` : null;
}

function parseHeaderScoreContainer(el) {
  if (!el) return null;
  const direct = parseScoreText(el.textContent || '');
  if (direct) return direct;
  // Support split numeric nodes inside Betano [data-qa="event-score"]
  const leafNums = Array.from(el.querySelectorAll('span, div, strong, b'))
    .filter((node) => node.children.length === 0)
    .map((node) => norm(node.textContent))
    .filter((t) => /^\d{1,3}$/.test(t));
  if (leafNums.length === 2) {
    return `${Number(leafNums[0])} - ${Number(leafNums[1])}`;
  }
  return null;
}

function isBetanoHost() {
  try {
    return /(^|\.)betano\.[a-z.]+$/i.test(location.hostname || '');
  } catch (_) {
    return false;
  }
}

function isMatchPage() {
  try {
    return isBetanoHost() && /\/(live|event)\/[^/]+\/\d+/.test(location.pathname || '');
  } catch (_) {
    return false;
  }
}

function isElementVisible(el) {
  if (!el || el.nodeType !== 1) return false;
  try {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    const cs = window.getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
  } catch (_) {
    return false;
  }
}

function findScoreElement() {
  const headerEls = Array.from(document.querySelectorAll('[data-qa="event-score"]'))
    .filter((el) => isElementVisible(el) && parseHeaderScoreContainer(el));
  if (headerEls.length > 0) return headerEls[0];

  const candidates = Array.from(document.querySelectorAll('span, div, p, strong, b')).filter((el) => {
    if (el.closest && el.closest('#qsWatchBtn, button, [role="button"], a')) return false;
    const txt = el.textContent || '';
    if (txt.length > 20 || !parseScoreText(txt) || !isElementVisible(el)) return false;
    for (const child of el.children) {
      if (parseScoreText(child.textContent || '')) return false;
    }
    return true;
  });

  if (candidates.length === 0) return null;

  const fontSizeOf = (el) => {
    let fs = parseFloat(window.getComputedStyle(el).fontSize) || 0;
    for (const ch of el.querySelectorAll('*')) {
      fs = Math.max(fs, parseFloat(window.getComputedStyle(ch).fontSize) || 0);
    }
    return fs;
  };

  candidates.sort((a, b) => (fontSizeOf(b) - fontSizeOf(a)) || (a.getBoundingClientRect().top - b.getBoundingClientRect().top));
  return candidates[0];
}

function readCurrentScore() {
  const el = findScoreElement();
  if (!el) return { el: null, score: '' };
  const score = el.getAttribute?.('data-qa') === 'event-score'
    ? (parseHeaderScoreContainer(el) || '')
    : (parseScoreText(el.textContent || '') || '');
  return { el, score };
}

function ensureWatchButton() {
  if (!document.documentElement) return null;
  if (!document.getElementById('qsWatchStyle')) {
    const st = document.createElement('style');
    st.id = 'qsWatchStyle';
    st.textContent =
      '@keyframes qsWatchPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.35);opacity:0.55}}' +
      '#qsWatchBtn:hover{transform:translateY(-1px);box-shadow:0 10px 28px rgba(0,0,0,0.55),0 0 0 1px rgba(255,255,255,0.16);}' +
      '#qsWatchBtn:active{transform:translateY(0px);}';
    (document.head || document.documentElement).appendChild(st);
  }
  let btn = document.getElementById('qsWatchBtn');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'qsWatchBtn';
    btn.type = 'button';
    btn.style.cssText = [
      'position:fixed',
      'right:12px',
      'bottom:86px',
      'z-index:2147483647',
      'padding:7px 13px',
      'border:1px solid rgba(251,146,60,0.45)',
      'border-radius:999px',
      'font-size:12px',
      'font-weight:600',
      'letter-spacing:0.015em',
      'backdrop-filter:blur(12px)',
      '-webkit-backdrop-filter:blur(12px)',
      'box-shadow:0 8px 24px rgba(0,0,0,0.48),inset 0 1px 0 rgba(255,255,255,0.08)',
      'cursor:pointer',
      'display:none',
      'align-items:center',
      'gap:8px',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,sans-serif',
      'transition:transform 0.14s ease,background 0.16s ease,border-color 0.16s ease,box-shadow 0.16s ease',
    ].join(';');

    const dot = document.createElement('span');
    dot.id = 'qsWatchDot';
    dot.style.cssText = 'width:8px;height:8px;border-radius:999px;flex-shrink:0;display:inline-block;';

    const lbl = document.createElement('span');
    lbl.id = 'qsWatchLabel';

    const scoreChip = document.createElement('span');
    scoreChip.id = 'qsWatchScore';
    scoreChip.style.cssText = [
      'display:none',
      'padding:1px 7px',
      'border-radius:999px',
      'font-size:11px',
      'font-weight:700',
      'font-variant-numeric:tabular-nums',
      'background:rgba(255,255,255,0.12)',
      'color:#ffffff',
    ].join(';');

    btn.appendChild(dot);
    btn.appendChild(lbl);
    btn.appendChild(scoreChip);

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const { score } = readCurrentScore();
      try {
        ipcRenderer.send('monitor:watch-toggle', {
          url: location.href,
          isMatchPage: isMatchPage(),
          score,
        });
      } catch (_) {}
    });
    document.documentElement.appendChild(btn);
  }
  return btn;
}

function paintWatchButton() {
  const btn = ensureWatchButton();
  if (!btn) return;
  const onMatch = isMatchPage();
  btn.style.display = onMatch ? 'inline-flex' : 'none';
  if (!onMatch) return;

  const dot = btn.querySelector('#qsWatchDot');
  const lbl = btn.querySelector('#qsWatchLabel');
  const scoreChip = btn.querySelector('#qsWatchScore');

  if (watchArmed) {
    if (noScore) {
      if (dot) {
        dot.style.background = '#f59e0b';
        dot.style.boxShadow = '0 0 8px rgba(245,158,11,0.75)';
        dot.style.animation = 'none';
      }
      if (lbl) lbl.textContent = 'Watching · No score';
      if (scoreChip) scoreChip.style.display = 'none';
      btn.style.background = 'rgba(69, 26, 3, 0.92)';
      btn.style.borderColor = 'rgba(245, 158, 11, 0.58)';
      btn.style.color = '#fef3c7';
      btn.title = 'Watch is ON but live header score could not be read on this view.';
    } else {
      if (dot) {
        dot.style.background = '#10b981';
        dot.style.boxShadow = '0 0 8px rgba(16,185,129,0.85)';
        dot.style.animation = 'qsWatchPulse 1.4s ease-in-out infinite';
      }
      if (lbl) lbl.textContent = 'Watching';
      if (scoreChip) {
        scoreChip.textContent = prevScore || 'Live';
        scoreChip.style.display = 'inline-block';
      }
      btn.style.background = 'rgba(6, 40, 32, 0.92)';
      btn.style.borderColor = 'rgba(16, 185, 129, 0.58)';
      btn.style.color = '#ecfdf5';
      btn.title = 'Goal auto-bet is ARMED — places bet on selected pane games when score increases; auto-cashout on drop. Tap to stop.';
    }
  } else {
    if (dot) {
      dot.style.background = '#fb923c';
      dot.style.boxShadow = '0 0 8px rgba(251,146,60,0.65)';
      dot.style.animation = 'none';
    }
    if (lbl) lbl.textContent = 'Watch this match';
    if (scoreChip) scoreChip.style.display = 'none';
    btn.style.background = 'rgba(15, 23, 42, 0.90)';
    btn.style.borderColor = 'rgba(251, 146, 60, 0.45)';
    btn.style.color = '#f8fafc';
    btn.title = 'Tap to listen to this Betano match score and trigger bets automatically on goal.';
  }
}

function attachScoreObserver(el) {
  if (!el || el === observedScoreNode) return;
  if (scoreObserver) {
    try { scoreObserver.disconnect(); } catch (_) {}
  }
  observedScoreNode = el;
  try {
    scoreObserver = new MutationObserver(() => {
      if (!watchArmed || evalQueued) return;
      evalQueued = true;
      queueMicrotask(() => {
        evalQueued = false;
        evaluateScore();
      });
    });
    scoreObserver.observe(el, { childList: true, subtree: true, characterData: true });
  } catch (_) {}
}

function detachScoreObserver() {
  observedScoreNode = null;
  if (scoreObserver) {
    try { scoreObserver.disconnect(); } catch (_) {}
    scoreObserver = null;
  }
}

function evaluateScore() {
  if (!watchArmed || !isMatchPage()) return;
  const { el, score } = readCurrentScore();
  if (el) attachScoreObserver(el);

  if (!score) {
    if (!noScore) {
      noScore = true;
      paintWatchButton();
    }
    return;
  }
  if (noScore) {
    noScore = false;
    paintWatchButton();
  }
  if (score === prevScore) return;

  const prev = prevScore;
  prevScore = score;
  paintWatchButton();

  try {
    ipcRenderer.send('monitor:score-update', {
      score,
      prev,
      url: location.href,
      isInitial: !prev,
    });
  } catch (_) {}
}

function reportPageInfo(forceScore = false) {
  const onMatch = isMatchPage();
  const score = (onMatch && (watchArmed || forceScore)) ? (prevScore || readCurrentScore().score) : '';
  try {
    ipcRenderer.send('monitor:page-info', {
      url: location.href,
      host: location.hostname || '',
      isMatchPage: onMatch,
      score,
    });
  } catch (_) {}
}

ipcRenderer.on('monitor:watch-state', (_e, payload) => {
  const nextArmed = !!(payload && payload.armed);
  if (nextArmed && !watchArmed) {
    prevScore = '';
    noScore = false;
  } else if (!nextArmed) {
    prevScore = '';
    noScore = false;
    detachScoreObserver();
  }
  watchArmed = nextArmed;
  paintWatchButton();
  if (watchArmed) evaluateScore();
});

window.addEventListener('DOMContentLoaded', () => {
  lastHref = location.href;
  paintWatchButton();
  reportPageInfo(true);
});

setInterval(() => {
  const curHref = location.href;
  if (curHref !== lastHref) {
    lastHref = curHref;
    prevScore = '';
    noScore = false;
    detachScoreObserver();
    if (watchArmed) {
      watchArmed = false;
      try {
        ipcRenderer.send('monitor:watch-auto-off', { url: curHref, isMatchPage: isMatchPage() });
      } catch (_) {}
    }
    paintWatchButton();
    reportPageInfo(true);
  } else if (pageTick++ % 20 === 0) {
    reportPageInfo(false);
  }

  if (watchArmed) {
    evaluateScore();
  } else if (btnTick++ % 10 === 0) {
    paintWatchButton();
  }
}, 100);

if (typeof module === 'object' && module.exports) {
  module.exports = {
    parseScoreText,
    parseHeaderScoreContainer,
    findScoreElement,
    isBetanoHost,
    isMatchPage,
  };
}
