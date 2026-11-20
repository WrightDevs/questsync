const { ipcRenderer } = require('electron');

let pickKind = null; // 'odds' | 'stake' while the element picker is active
let hoverBox = null;
let replaying = false; // true while executing a mirror-replay → suppresses re-capture
let programmaticSuppressed = false; // true only while automated keypad typing runs on this pane
let suppressReleaseTimer = null;

ipcRenderer.on('set-suppress-capture', (_e, val) => {
  const next = !!val;
  clearTimeout(suppressReleaseTimer);
  if (!next) {
    lastSlipSig = readSlipSignature();
    clearTimeout(slipObsTimer);
    suppressReleaseTimer = setTimeout(() => {
      lastSlipSig = readSlipSignature();
      programmaticSuppressed = false;
    }, 90);
  } else {
    programmaticSuppressed = true;
    clearTimeout(slipObsTimer);
  }
});

function ensureHoverBox() {
  if (!hoverBox || !document.documentElement.contains(hoverBox)) {
    hoverBox = document.createElement('div');
    hoverBox.id = '__mfas_pick_highlight';
    hoverBox.style.cssText = `
      position: fixed; pointer-events: none;
      border: 2px solid #e0b341; background: rgba(224,179,65,0.2);
      z-index: 2147483647; transition: all 0.05s ease;
      display: none; box-sizing: border-box; border-radius: 3px;
    `;
    document.documentElement.appendChild(hoverBox);
  }
}

// ─── Selector builders ─────────────────────────────────────────────────────

function cssPath(el) {
  const parts = [];
  while (el && el.nodeType === 1 && el !== document.documentElement) {
    if (el.id) {
      const sel = '#' + CSS.escape(el.id);
      try { if (document.querySelectorAll(sel).length === 1) { parts.unshift(sel); break; } } catch (_) {}
    }
    let part = el.tagName.toLowerCase();
    const parent = el.parentElement;
    if (parent) {
      const same = Array.from(parent.children).filter(c => c.tagName === el.tagName);
      if (same.length > 1) part += `:nth-of-type(${same.indexOf(el) + 1})`;
    }
    parts.unshift(part);
    el = parent;
  }
  return parts.join(' > ');
}

const STABLE = c => /^[A-Za-z][\w-]*$/.test(c) && !/\d{3,}/.test(c) && !/[A-Fa-f0-9]{8,}/.test(c) && c.length < 40;

function nodeSel(el) {
  let s = el.tagName.toLowerCase();
  const cls = Array.from(el.classList).filter(STABLE);
  if (cls.length) s += '.' + cls.map(c => CSS.escape(c)).join('.');
  return s;
}

function uniqueSelector(el) {
  if (!el || el.nodeType !== 1) return '';
  if (el.id && /^[A-Za-z][\w-]*$/.test(el.id) && !/\d{3,}/.test(el.id)) {
    const s = '#' + CSS.escape(el.id);
    try { if (document.querySelectorAll(s).length === 1) return s; } catch (_) {}
  }

  // Data-op direct attribute check
  const directOp = el.getAttribute && el.getAttribute('data-op');
  if (directOp && /^[a-zA-Z0-9_-]+$/.test(directOp)) {
    const s = `${el.tagName.toLowerCase()}[data-op="${CSS.escape(directOp)}"]`;
    try { if (document.querySelectorAll(s).length === 1) return s; } catch (_) {}
  }

  // Scoped to ancestor with data-event-id or data-op
  let anc = el.parentElement;
  for (let d = 0; anc && anc !== document.body && d < 6; d++, anc = anc.parentElement) {
    const eid = anc.getAttribute && anc.getAttribute('data-event-id');
    const aOp = anc.getAttribute && anc.getAttribute('data-op');
    if (eid && /^[a-zA-Z0-9:_-]+$/.test(eid)) {
      const aSel = `${anc.tagName.toLowerCase()}[data-event-id="${CSS.escape(eid)}"] > ${relPath(anc, el)}`;
      try { if (document.querySelectorAll(aSel).length === 1) return aSel; } catch (_) {}
    }
    if (aOp && /^[a-zA-Z0-9_-]+$/.test(aOp)) {
      const aSel = `${anc.tagName.toLowerCase()}[data-op="${CSS.escape(aOp)}"] > ${relPath(anc, el)}`;
      try { if (document.querySelectorAll(aSel).length === 1) return aSel; } catch (_) {}
    }
  }

  const chain = [];
  let cur = el;
  for (let d = 0; cur && cur.nodeType === 1 && cur !== document.documentElement && d < 6; d++, cur = cur.parentElement) {
    chain.unshift(nodeSel(cur));
    const s = chain.join(' > ');
    try { if (document.querySelectorAll(s).length === 1) return s; } catch (_) {}
  }
  let a = el.parentElement;
  for (let d = 0; a && a !== document.body && d < 14; d++, a = a.parentElement) {
    if (!Array.from(a.classList).some(STABLE)) continue;
    const s = `${nodeSel(a)} > ${relPath(a, el)}`;
    try { if (document.querySelectorAll(s).length === 1) return s; } catch (_) {}
  }
  return cssPath(el);
}

function relPath(a, el) {
  const parts = [];
  let cur = el;
  while (cur && cur !== a) {
    let part = cur.tagName.toLowerCase();
    const parent = cur.parentElement;
    if (parent) {
      const same = Array.from(parent.children).filter(c => c.tagName === cur.tagName);
      if (same.length > 1) part += `:nth-of-type(${same.indexOf(cur) + 1})`;
    }
    parts.unshift(part);
    cur = parent;
  }
  return parts.join(' > ');
}

// ─── Send to main process ──────────────────────────────────────────────────

function send(payload) {
  ipcRenderer.send('mirror-event', payload);
}

// ─── Track editable focus synchronously for safe Spacebar hotkey ──────────

let lastEditableFocus = null;
function checkEditableFocus() {
  const el = document.activeElement;
  let editable = false;
  if (el && el !== document.body && el !== document.documentElement) {
    const tag = el.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) {
      editable = true;
    } else if (tag === 'INPUT') {
      const t = (el.type || 'text').toLowerCase();
      editable = !['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'image'].includes(t);
    }
  }
  if (editable !== lastEditableFocus) {
    lastEditableFocus = editable;
    ipcRenderer.send('view:typing-focus', editable);
  }
}
document.addEventListener('focusin', checkEditableFocus, true);
document.addEventListener('focusout', () => setTimeout(checkEditableFocus, 0), true);
window.addEventListener('blur', () => {
  if (lastEditableFocus !== false) {
    lastEditableFocus = false;
    ipcRenderer.send('view:typing-focus', false);
  }
});

// ─── Site & Semantic helpers (self-contained for sandboxed preload) ────────

function currentSite() {
  try {
    const host = (location.hostname || '').toLowerCase();
    if (host.includes('football.com')) return 'football';
  } catch (_) {}
  return 'sportybet';
}

function isElementVisible(el) {
  if (!el || el.nodeType !== 1) return false;
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return false;
  const st = getComputedStyle(el);
  if (st.display === 'none' || st.visibility === 'hidden') return false;
  try {
    // If element is a visually suppressed confirm target, permit it so automation can click it
    if (el.matches && el.matches('[data-op*="confirm" i], .flexibet-confirm, [class*="confirm" i], button:has([data-cms-key="confirm"]), [data-cms-key="confirm"]')) {
      return true;
    }
  } catch (_) {}
  return st.opacity !== '0';
}

function normText(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.+/\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP_WORDS = new Set(['fc', 'cf', 'sc', 'ac', 'afc', 'u19', 'u20', 'u21', 'u23', 'reserves', 'women', 'w', 'club', 'fk', 'sk', 'bk', 'nk', 'cd', 'sd', 'rc', 'as', 'us', 'ss']);

function teamTokens(name) {
  return normText(name).split(' ').filter(w => w.length >= 2 && !STOP_WORDS.has(w));
}

function teamSimilarity(a, b) {
  const na = normText(a);
  const nb = normText(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  const ta = teamTokens(na);
  const tb = teamTokens(nb);
  if (!ta.length || !tb.length) return 0;
  const setB = new Set(tb);
  let hits = 0;
  for (const w of ta) {
    if (setB.has(w) || tb.some(x => x.length >= 4 && w.length >= 4 && (x.startsWith(w) || w.startsWith(x)))) {
      hits++;
    }
  }
  return hits / Math.max(ta.length, tb.length);
}

function matchTeamPair(teamsA, teamsB) {
  if (!Array.isArray(teamsA) || !Array.isArray(teamsB) || teamsA.length < 2 || teamsB.length < 2) return 0;
  const direct = (teamSimilarity(teamsA[0], teamsB[0]) + teamSimilarity(teamsA[1], teamsB[1])) / 2;
  const minDirect = Math.min(teamSimilarity(teamsA[0], teamsB[0]), teamSimilarity(teamsA[1], teamsB[1]));
  if (minDirect >= 0.5 && direct >= 0.65) return direct;
  return 0;
}

function extractSrMatchIdFromText(s) {
  const m = String(s || '').match(/sr:match:\d+/);
  return m ? m[0] : '';
}

function findMatchCard(el) {
  if (!el || el.nodeType !== 1) return null;
  const direct = el.closest(
    '[data-op="match-card-root"], [data-event-id*="sr:match:"], [data-hs-id*="sr:match:"], [data-match-id*="sr:match:"]'
  );
  if (direct) return direct;
  let cur = el.parentElement;
  for (let i = 0; cur && cur !== document.body && i < 10; i++, cur = cur.parentElement) {
    const link = cur.querySelector && cur.querySelector('a[href*="sr:match:"]');
    if (link) {
      const rect = cur.getBoundingClientRect();
      if (rect.height > 30 && rect.height < 500) return cur;
    }
  }
  return null;
}

function extractCardSrMatchId(card) {
  if (!card) return extractSrMatchIdFromText(location.href);
  const attrs = ['data-event-id', 'data-hs-id', 'data-match-id', 'data-eventid', 'data-id'];
  for (const a of attrs) {
    const val = card.getAttribute && card.getAttribute(a);
    const id = extractSrMatchIdFromText(val);
    if (id) return id;
  }
  const link = card.querySelector && card.querySelector('a[href*="sr:match:"]');
  if (link) {
    const id = extractSrMatchIdFromText(link.getAttribute('href') || link.href);
    if (id) return id;
  }
  return extractSrMatchIdFromText(location.href);
}

function extractTeamsFromCard(card) {
  if (!card) return extractTeamsFromPageHeader();

  // Inspect structured team wrapper (e.g. Football.com match card team names)
  if (card.querySelector) {
    const teamWrapper = card.querySelector('[data-op="match-card-team-names"], [class*="team-names" i]');
    if (teamWrapper) {
      const subEls = Array.from(teamWrapper.querySelectorAll('h1, h2, h3, [data-op="search-highlight"], span, div')).filter(el => el.children.length === 0);
      const subNames = [];
      for (const el of subEls) {
        const t = String(el.textContent || '').replace(/\s+/g, ' ').trim();
        if (t && t.length >= 2 && !/^\d+$/.test(t) && !subNames.includes(t)) subNames.push(t);
      }
      if (subNames.length >= 2) return [subNames[0], subNames[1]];
    }
  }

  const teamEls = Array.from(card.querySelectorAll(
    '[data-op*="team" i], [class*="home-team" i], [class*="away-team" i], [class*="team-name" i], [class*="teamName" i], .team'
  )).filter(el => isElementVisible(el) && !el.closest('[data-op="outcome-btn"], [class*="outcome" i]'));
  const names = [];
  for (const tEl of teamEls) {
    const txt = String(tEl.textContent || '').replace(/\s+/g, ' ').trim();
    if (txt && txt.length >= 2 && txt.length <= 60 && !/^\d+$/.test(txt) && !names.includes(txt)) {
      names.push(txt);
    }
  }
  if (names.length >= 2) return [names[0], names[1]];

  const link = card.querySelector && card.querySelector('a[href*="sr:match:"]');
  const pool = link || card;
  const lines = String(pool.innerText || pool.textContent || '')
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length >= 2 && s.length <= 50 && !/^\d+([.,:]\d+)?$/.test(s) && !/^(1|X|2|1X|X2|12|GG|NG|VS|Live|FT|HT)$/i.test(s) && !/^\d{2}:\d{2}/.test(s) && !/^\+\d+/.test(s));
  if (lines.length >= 2) return [lines[0], lines[1]];
  return [];
}

function extractTeamsFromPageHeader() {
  const headerEls = Array.from(document.querySelectorAll(
    '[class*="scoreboard" i] [class*="team" i], [class*="match-header" i] [class*="team" i], [class*="event-header" i] [class*="team" i], [data-op*="team" i]'
  )).filter(isElementVisible);
  const names = [];
  for (const el of headerEls) {
    const txt = String(el.textContent || '').replace(/\s+/g, ' ').trim();
    if (txt && txt.length >= 2 && txt.length <= 60 && !/^\d+$/.test(txt) && !names.includes(txt)) {
      names.push(txt);
    }
  }
  if (names.length >= 2) return [names[0], names[1]];
  const titleMatch = String(document.title || '').match(/^(.+?)\s+vs\.?\s+(.+?)(?:\s*[-|]|$)/i);
  if (titleMatch) return [titleMatch[1].trim(), titleMatch[2].trim()];
  return [];
}

function normalizeOutcomeLabel(raw) {
  const t = String(raw || '').replace(/\s+/g, ' ').trim();
  const up = t.toUpperCase();
  if (up === 'HOME' || up === 'W1') return '1';
  if (up === 'DRAW' || up === 'TIE') return 'X';
  if (up === 'AWAY' || up === 'W2') return '2';
  if (up === 'HOME/DRAW' || up === '1/X') return '1X';
  if (up === 'DRAW/AWAY' || up === 'X/2') return 'X2';
  if (up === 'HOME/AWAY' || up === '1/2') return '12';
  if (up === 'YES') return 'GG';
  if (up === 'NO') return 'NG';
  return up;
}

function extractOutcomeLabelFromBtn(btn) {
  if (!btn) return '';
  const explicit = btn.querySelector('[class*="label" i], [class*="name" i], [data-op*="label" i], [data-op*="specifier" i]');
  if (explicit) {
    const t = String(explicit.textContent || '').replace(/\s+/g, ' ').trim();
    if (t && !/^\d+\.\d+$/.test(t)) return normalizeOutcomeLabel(t);
  }
  const parts = String(btn.innerText || btn.textContent || '')
    .split('\n')
    .map(s => s.trim())
    .filter(s => s && !/^\d+\.\d+$/.test(s) && s !== '--');
  if (parts.length) return normalizeOutcomeLabel(parts[0]);

  // Football.com fallback: look up column label from card's market title bar or sibling index
  try {
    const card = findMatchCard(btn);
    if (card) {
      const row = btn.parentElement;
      const rowBtns = row ? Array.from(row.children).filter(c => c.matches && c.matches('[data-op="outcome-btn"], .m-outcome, [class*="outcome" i]')) : [];
      const idx = rowBtns.indexOf(btn);
      if (idx >= 0) {
        const titleBar = card.querySelector('[data-op="classic-match-card-market-title-bar"], [data-op*="market-title-bar"]');
        if (titleBar) {
          const colLabels = Array.from(titleBar.children).map(c => (c.textContent || '').trim()).filter(Boolean);
          if (colLabels[idx]) return normalizeOutcomeLabel(colLabels[idx]);
        }
        if (rowBtns.length === 3) {
          const map3 = ['1', 'x', '2'];
          return normalizeOutcomeLabel(map3[idx]);
        }
      }
    }
  } catch (_) {}

  return '';
}

function extractMarketName(outcomeBtn, card) {
  const group = outcomeBtn.closest('[data-op*="market" i], [class*="market" i], [class*="group" i]');
  if (group && (!card || card.contains(group))) {
    const title = group.querySelector('[class*="title" i], [class*="header" i], [class*="name" i]');
    if (title && !outcomeBtn.contains(title)) {
      return String(title.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 48);
    }
  }
  return '';
}

function stripCountryPrefix(pathname) {
  return String(pathname || '').replace(/^\/(ng|gh)(\/m)?(?=\/|$)/i, '') || '/';
}

function extractSemantic(target, clickable) {
  const el = clickable || target;
  if (!el || el.nodeType !== 1) return null;

  const inBetslip = !!el.closest(
    '[data-op="fast-betslip-container"], [data-op="betslip-bottom-sheet"], [data-op="betslip-selection"], .m-betslip, .m-bet-slip, .m-fast-betslip, [class*="betslip" i], [class*="bet-slip" i]'
  );
  const isInsideModal = !!el.closest(
    '[data-op="betslip-confirm-to-pay-modal"], [class*="mask" i], [class*="modal" i], [class*="popup" i], [class*="dialog" i], [class*="confirm" i], [class*="sheet" i]'
  );

  // 1. Outcome / odds button (outside betslip)
  if (!inBetslip) {
    const outBtn = el.closest('[data-op="outcome-btn"], .m-outcome, [class*="m-outcome"], [class*="outcome-btn" i], [class*="outcome-item" i]');
    if (outBtn) {
      const card = findMatchCard(outBtn);
      const srMatchId = extractCardSrMatchId(card);
      const teams = extractTeamsFromCard(card);
      const row = outBtn.parentElement;
      const rowBtns = row
        ? Array.from(row.children).filter(c => c.matches && c.matches('[data-op="outcome-btn"], .m-outcome, [class*="m-outcome"], [class*="outcome" i], [class*="odd" i]'))
        : [];
      const outcomeIndex = rowBtns.indexOf(outBtn);
      const outcomeLabel = extractOutcomeLabelFromBtn(outBtn);
      const market = extractMarketName(outBtn, card);
      if (srMatchId || teams.length === 2 || outcomeLabel) {
        return {
          kind: 'outcome',
          srMatchId,
          teams,
          market,
          outcomeLabel,
          outcomeIndex: outcomeIndex >= 0 ? outcomeIndex : null,
          rowSize: rowBtns.length || null,
        };
      }
    }
  }

  // 2. Specific high-value UI actions
  const txt = String(el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  const low = txt.toLowerCase();
  const href = el.getAttribute && (el.getAttribute('href') || (el.closest('a') && el.closest('a').getAttribute('href'))) || '';
  let hrefPath = '';
  if (href && !href.startsWith('javascript:')) {
    try { hrefPath = stripCountryPrefix(new URL(href, location.origin).pathname); } catch (_) { hrefPath = stripCountryPrefix(href); }
  }

  if (el.closest('[data-op="betslip-remove-all"]') || (inBetslip && /^(remove all|clear all|clear slip)$/i.test(low))) {
    return { kind: 'action', action: 'remove-all', inBetslip: true, label: txt };
  }
  if (/open[_\s-]*bets?/i.test(hrefPath) || /^open\s*bets?$/i.test(low)) {
    return { kind: 'action', action: 'open-bets', hrefPath, label: txt };
  }

  // Handle Place Bet and Accept Changes directly from collapsed OR expanded betslip
  const isPlaceBet = (
    el.closest('[data-op="betslip-placebet"], [data-op="fast-betslip-single-bottom-row-right-content"], .place-bet, [class*="place-bet" i], .required-change') ||
    (inBetslip && (
      low.includes('place bet') || low.includes('placebet') ||
      low.includes('bet now') || low.includes('place a bet') ||
      low === 'bet' ||
      low.includes('accept change') || low.includes('accept changes') ||
      low.includes('save change') || low.includes('save changes') ||
      low.includes('confirm bet') || low.includes('confirm order') ||
      low === 'accept'
    ))
  );
  if (isPlaceBet) {
    return { kind: 'action', action: 'place-bet', inBetslip: true, label: txt };
  }

  if (el.closest('[data-op="fast-betslip-container"], .m-fast-betslip') && !el.closest('[data-op="betslip-keyboard-trigger"], [data-op="fast-betslip-single-bottom-row-right-content"], .place-bet, [class*="place-bet" i], .m-keybord-input, [class*="keybord-input" i]')) {
    return { kind: 'action', action: 'betslip-tab', inBetslip: true, label: txt };
  }

  // 3. Match navigation click (team/card title to open match detail page)
  if (!inBetslip) {
    const card = findMatchCard(el);
    if (card) {
      const srMatchId = extractCardSrMatchId(card);
      const teams = extractTeamsFromCard(card);
      if (srMatchId || teams.length === 2) {
        return { kind: 'match-nav', srMatchId, teams, hrefPath };
      }
    }
  }

  // 4. Generic nav / button / modal action
  if (/^live(\s+betting)?$/i.test(low) || /\/live(\b|\/|$)/i.test(hrefPath)) {
    return { kind: 'action', action: 'live', hrefPath, label: txt };
  }
  if (/^home$/i.test(low) || hrefPath === '/' || hrefPath === '/m/' || hrefPath === '/m') {
    return { kind: 'action', action: 'home', hrefPath, label: txt };
  }
  const isCloseBtn = isInsideModal && (/^(×|✕|x|close|cancel|done|ok|got it|confirm)$/i.test(low) || !!(el.closest('[data-op*="close" i], [class*="close" i]')));
  if (txt || hrefPath || isCloseBtn) {
    return {
      kind: 'action',
      action: isCloseBtn ? 'modal-close' : 'generic',
      label: txt,
      hrefPath,
      inBetslip,
      isInsideModal,
      isCloseBtn,
    };
  }
  return null;
}

function getOutcomeButtonsInContainer(root) {
  if (!root) return [];
  return Array.from(root.querySelectorAll(
    '[data-op="outcome-btn"], .m-outcome, [class*="m-outcome"], [class*="outcome-btn" i], [class*="outcome-item" i]'
  )).filter(b => isElementVisible(b) && !b.closest('[data-op="fast-betslip-container"], [data-op="betslip-bottom-sheet"], .m-betslip, .m-bet-slip'));
}

function findCardSemanticMatch(sem) {
  if (!sem) return null;
  // A. Exact Sportradar match ID in DOM
  if (sem.srMatchId) {
    const byAttr = document.querySelector(
      `[data-event-id="${sem.srMatchId}"], [data-hs-id="${sem.srMatchId}"], [data-match-id="${sem.srMatchId}"], a[href*="${sem.srMatchId}"]`
    );
    if (byAttr) {
      const card = byAttr.matches('[data-op="match-card-root"], [data-event-id], [data-hs-id], [data-match-id]')
        ? byAttr
        : (findMatchCard(byAttr) || byAttr);
      if (isElementVisible(card)) return card;
    }
    if (location.href.includes(sem.srMatchId)) {
      return document.querySelector('main, [class*="match-detail" i], [class*="event-detail" i]') || document.body;
    }
  }
  // B. Dual-team fuzzy name match across visible cards
  if (Array.isArray(sem.teams) && sem.teams.length === 2) {
    if (location.href.includes('sr:match:') && matchTeamPair(sem.teams, extractTeamsFromPageHeader()) >= 0.7) {
      return document.querySelector('main, [class*="match-detail" i], [class*="event-detail" i]') || document.body;
    }
    const candidateCards = new Set();
    const roots = document.querySelectorAll(
      '[data-op="match-card-root"], [data-event-id*="sr:match:"], [data-hs-id*="sr:match:"], a[href*="sr:match:"]'
    );
    for (const r of roots) {
      const c = r.tagName === 'A' ? (findMatchCard(r) || r.parentElement) : r;
      if (c && isElementVisible(c)) candidateCards.add(c);
    }
    let bestCard = null;
    let bestScore = 0;
    for (const card of candidateCards) {
      const score = matchTeamPair(sem.teams, extractTeamsFromCard(card));
      if (score > bestScore && score >= 0.65) {
        bestScore = score;
        bestCard = card;
      }
    }
    if (bestCard) return bestCard;
  }
  return null;
}

function findCrossSiteTarget(m) {
  const sem = m.semantic;
  if (!sem) return null;

  if (sem.kind === 'outcome') {
    const card = findCardSemanticMatch(sem);
    if (!card) return null;
    let scope = card;
    if (sem.market && (card === document.body || card.tagName === 'MAIN')) {
      const mNorm = normText(sem.market);
      const groups = Array.from(card.querySelectorAll('[data-op*="market" i], [class*="market" i]')).filter(isElementVisible);
      const matchedGroup = groups.find(g => {
        const hdr = g.querySelector('[class*="title" i], [class*="header" i], [class*="name" i]');
        const ht = normText(hdr ? hdr.textContent : '');
        return ht && (ht.includes(mNorm) || mNorm.includes(ht)
          || ((mNorm.includes('gg') || mNorm.includes('both teams')) && (ht.includes('gg') || ht.includes('both teams'))));
      });
      if (matchedGroup) scope = matchedGroup;
    }

    const btns = getOutcomeButtonsInContainer(scope);
    if (!btns.length) return null;

    if (sem.outcomeLabel) {
      const want = normalizeOutcomeLabel(sem.outcomeLabel);
      const byLabel = btns.find(b => {
        const lbl = extractOutcomeLabelFromBtn(b);
        return lbl === want || (lbl && want && (lbl.includes(want) || want.includes(lbl)));
      });
      if (byLabel) return byLabel;
    }

    if (sem.outcomeIndex != null && sem.rowSize) {
      // Match by sibling row of exact rowSize
      const grouped = new Map();
      for (const b of btns) {
        const p = b.parentElement;
        if (!grouped.has(p)) grouped.set(p, []);
        grouped.get(p).push(b);
      }
      for (const list of grouped.values()) {
        if (list.length === sem.rowSize && list[sem.outcomeIndex]) {
          return list[sem.outcomeIndex];
        }
      }
      if (btns[sem.outcomeIndex]) return btns[sem.outcomeIndex];
    }
    return null;
  }

  if (sem.kind === 'match-nav') {
    const card = findCardSemanticMatch(sem);
    if (card) {
      const link = card.querySelector('a[href*="sr:match:"], a[data-op*="nav" i], a.un-absolute')
        || card.querySelector('[data-op*="team" i], [class*="team" i], [class*="header" i]');
      return link || card;
    }
    if (sem.hrefPath) {
      const links = Array.from(document.querySelectorAll('a[href]')).filter(isElementVisible);
      const hit = links.find(a => {
        try { return stripCountryPrefix(new URL(a.href, location.origin).pathname) === sem.hrefPath; } catch (_) { return false; }
      });
      if (hit) return hit;
    }
    return null;
  }

  if (sem.kind === 'action') {
    if (sem.action === 'remove-all') {
      const btn = document.querySelector('[data-op="betslip-remove-all"]');
      if (btn && isElementVisible(btn)) return btn;
      const candidates = Array.from(document.querySelectorAll('.m-betslip button, .m-bet-slip button, [class*="betslip" i] button, [data-op="betslip-bottom-sheet"] button'));
      return candidates.find(b => isElementVisible(b) && /remove all|clear all|clear/i.test(b.textContent || '')) || null;
    }
    if (sem.action === 'open-bets') {
      const link = document.querySelector('a[href*="open_bets"], a[href*="open-bets"]');
      if (link && isElementVisible(link)) return link;
      const navs = Array.from(document.querySelectorAll('a, button, [role="button"]')).filter(isElementVisible);
      return navs.find(el => /^open\s*bets?$/i.test((el.textContent || '').trim())) || null;
    }
    if (sem.action === 'betslip-tab') {
      return document.querySelector('[data-op="fast-betslip-container"], .m-betslip-entry, [class*="betslip-entry" i], .m-fast-betslip') || null;
    }
    if (sem.action === 'place-bet') {
      // 1. Collapsed fast betslip button (SportyBet & general)
      const fastSlip = Array.from(document.querySelectorAll(
        '.m-fast-betslip, .m-fast-stake-wrapper, .m-fast-stake, [data-op="fast-betslip-container"], [data-op="fast-betslip-wrap"]'
      )).find(isElementVisible);
      if (fastSlip) {
        const candidates = Array.from(fastSlip.querySelectorAll(
          '.place-bet, [class*="place-bet" i], .required-change, [data-op="fast-betslip-single-bottom-row-right-content"], [data-op="betslip-placebet"], button, [role="button"], .m-btn, [class*="btn" i]'
        )).filter(isElementVisible);
        const match = candidates.find(b => {
          const t = String(b.innerText || b.textContent || '').trim().toLowerCase();
          return t.includes('place bet') || t.includes('placebet') || t.includes('accept change') || t.includes('save change') || t.includes('confirm') || t === 'bet';
        });
        if (match) return match;
        const placeBetDiv = fastSlip.querySelector('.place-bet, [class*="place-bet" i]');
        if (placeBetDiv && isElementVisible(placeBetDiv)) return placeBetDiv;
      }
      // 2. Direct exact Place Bet button
      const exact = Array.from(document.querySelectorAll(
        'button[data-op="betslip-placebet"], [data-op="betslip-placebet"], [data-op="fast-betslip-single-bottom-row-right-content"], button.place-bet'
      )).find(isElementVisible);
      if (exact) return exact;
      // 3. Expanded betslip button
      const slipRoot = document.querySelector('.m-bet-slip, .m-betslip, [class*="betslip" i], [class*="bet-slip" i], #betslip');
      const scope = slipRoot || document;
      const candidates = Array.from(scope.querySelectorAll('button, [role="button"], .m-btn, [class*="btn" i]')).filter(isElementVisible);
      const match = candidates.find(b => {
        const t = String(b.innerText || b.textContent || '').trim().toLowerCase();
        return t.includes('place bet') || t.includes('placebet') || t.includes('accept change') || t.includes('save change') || t.includes('confirm');
      });
      if (match) return match;
      return null;
    }
    if (sem.action === 'live') {
      const link = document.querySelector('a[href*="/live"]');
      if (link && isElementVisible(link)) return link;
      const navs = Array.from(document.querySelectorAll('a, button, [role="button"], [role="tab"]')).filter(isElementVisible);
      return navs.find(el => /^live(\s+betting)?$/i.test((el.textContent || '').trim())) || null;
    }
    if (sem.action === 'home') {
      const navs = Array.from(document.querySelectorAll('a, button, [role="button"]')).filter(isElementVisible);
      return navs.find(el => /^home$/i.test((el.textContent || '').trim())) || null;
    }
    if (sem.action === 'modal-close') {
      const btns = Array.from(document.querySelectorAll(
        '[data-op*="close" i], [class*="modal" i] button, [class*="dialog" i] button, [class*="popup" i] button, [class*="sheet" i] button'
      )).filter(isElementVisible);
      const labelLow = (sem.label || '').toLowerCase();
      return btns.find(b => (b.textContent || '').trim().toLowerCase() === labelLow)
        || btns.find(b => /^(×|✕|x|close|cancel|done|ok|got it)$/i.test((b.textContent || '').trim()))
        || null;
    }
    if (sem.label) {
      const want = sem.label.toLowerCase();
      const scopeSel = sem.inBetslip
        ? '[data-op="fast-betslip-container"], [data-op="betslip-bottom-sheet"], .m-betslip, .m-bet-slip, .m-fast-betslip, [class*="betslip" i]'
        : (sem.isInsideModal ? '[class*="modal" i], [class*="dialog" i], [class*="popup" i], [class*="sheet" i]' : 'body');
      const root = document.querySelector(scopeSel) || document.body;
      const els = Array.from(root.querySelectorAll('a, button, [role="button"], [role="tab"], .place-bet, [class*="place-bet" i], .required-change, .m-btn, [class*="btn" i]')).filter(isElementVisible);
      const exact = els.find(el => (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase() === want);
      if (exact) return exact;
    }
    if (sem.hrefPath) {
      const links = Array.from(document.querySelectorAll('a[href]')).filter(isElementVisible);
      const hit = links.find(a => {
        try { return stripCountryPrefix(new URL(a.href, location.origin).pathname) === sem.hrefPath; } catch (_) { return false; }
      });
      if (hit) return hit;
    }
  }

  return null;
}

// ─── Passive read-only betslip observer (triggers stake auto-update) ───────

let lastSlipSig = '';
let slipObsTimer = null;

function readSlipSignature() {
  const candidates = Array.from(document.querySelectorAll(
    '[data-op="fast-betslip-container"], [data-op="betslip-bottom-sheet"], [data-op="betslip-selection"], .m-fast-betslip, .m-bet-slip, .m-betslip, [class*="betslip" i], [class*="bet-slip" i], #betslip, .m-slip'
  )).filter((el) => {
    const cls = String(el.className || '');
    if (/(bar|entry|icon|badge|count)/i.test(cls) && !el.matches('[data-op="fast-betslip-container"]')) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  if (candidates.length === 0) return '';
  const parts = [];
  for (const slip of candidates) {
    const oddsEls = slip.querySelectorAll(
      '[data-op="betslip-outcome-odds-display"], span[data-op="betslip-keyboard-trigger"], [class*="odds" i], [class*="odd" i], .af-odds, [class*="stake" i], span.m-keybord-input, input:not([name="c2c-converter-input"])'
    );
    for (let i = 0; i < oddsEls.length && parts.length < 30; i++) {
      const o = oddsEls[i];
      if (o.name === 'c2c-converter-input') continue;
      const txt = o.tagName === 'INPUT' ? o.value : o.textContent;
      if (txt) parts.push(String(txt).trim().slice(0, 32));
    }
  }
  return parts.length ? (location.href + '|' + parts.join('|')) : '';
}

function extractActiveMatchTitle() {
  try {
    // 1. Check betslip items first (the game selected in betslip)
    const slipItems = Array.from(document.querySelectorAll(
      '.m-bet-item, .m-item, .slip-item, [class*="bet-item" i], [data-op="betslip-selection"], [class*="selection-item" i]'
    )).filter(isElementVisible);
    for (const item of slipItems) {
      const titleEl = item.querySelector('.m-team-name, .m-title, [class*="team" i], [class*="match" i], [class*="event" i], h4, h5, .name');
      if (titleEl) {
        const t = String(titleEl.textContent || '').replace(/\s+/g, ' ').trim();
        if (t.length >= 3 && !/^\d+$/.test(t)) return t;
      }
      const lines = String(item.innerText || item.textContent || '')
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length >= 3 && s.length <= 60 && !/^\d+([.,:]\d+)?$/.test(s) && !/^(1|X|2|1X|X2|12|Over|Under|Stake|Odds|Pot|Total|Rebet|Place|Bet)/i.test(s));
      if (lines.length > 0) return lines[0];
    }

    // 2. Check scoreboard / match header on event detail page
    const teams = extractTeamsFromPageHeader();
    if (teams && teams.length >= 2) return `${teams[0]} vs ${teams[1]}`;

    // 3. Check document title (e.g. "Arsenal vs Chelsea - SportyBet")
    const titleMatch = String(document.title || '').match(/^(.+?)\s+vs\.?\s+(.+?)(?:\s*[-|]|$)/i);
    if (titleMatch) return `${titleMatch[1].trim()} vs ${titleMatch[2].trim()}`;
  } catch (_) {}
  return '';
}

let lastReportedMatch = '';
function notifyMatchIfChanged() {
  const m = extractActiveMatchTitle();
  if (m && m !== lastReportedMatch) {
    lastReportedMatch = m;
    ipcRenderer.send('view:match-changed', { match: m });
  }
}

function scheduleSlipCheck() {
  if (replaying || programmaticSuppressed) return;
  clearTimeout(slipObsTimer);
  slipObsTimer = setTimeout(() => {
    if (replaying || programmaticSuppressed) return;
    notifyMatchIfChanged();
    const sig = readSlipSignature();
    if (sig && sig !== lastSlipSig) {
      lastSlipSig = sig;
      ipcRenderer.send('betslip-changed', { url: location.href });
    }
  }, 220);
}

// Instant Rebet Watcher: fires synchronously on DOM microtask (<0.1ms) the instant Rebet appears
let autoRebetArmed = true;
ipcRenderer.on('set-auto-rebet-armed', (_e, val) => {
  autoRebetArmed = !!val;
  if (autoRebetArmed) tryClickInstantRebet();
});

function isElementClickable(el) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 5 || r.height < 5) return false;
  const st = window.getComputedStyle(el);
  return st.visibility !== 'hidden' && st.display !== 'none';
}

function tryClickInstantRebet() {
  if (!autoRebetArmed) return false;
  // 1. Direct match on SportyBet success rebet button
  const exact = document.querySelector('button[data-op="betslip-success-rebet"], [data-op="betslip-success-rebet"], button.rebet, [data-cms-key="rebet"], .rebet-text, [data-op*="rebet" i]');
  if (exact && (exact.offsetParent !== null || isElementClickable(exact))) {
    clickElementFast(exact);
    return true;
  }
  // 2. Dialog match
  const dialog = document.querySelector('.m-dialog, .af-dialog, .es-dialog, [role="dialog"], [class*="success" i]');
  if (dialog && (dialog.offsetParent !== null || isElementClickable(dialog))) {
    const btns = Array.from(dialog.querySelectorAll('button, [role="button"], a, div, span, .m-btn, .af-button')).filter(b => b.offsetParent !== null || isElementClickable(b));
    const hit = btns.find(b => {
      const op = String(b.getAttribute('data-op') || '').toLowerCase();
      const t = String(b.innerText || b.textContent || '').trim().toLowerCase();
      return op.includes('rebet') || /^re-?bet/i.test(t) || t === 'rebet';
    });
    if (hit) {
      clickElementFast(hit);
      return true;
    }
  }
  return false;
}

function clickElementFast(el) {
  if (!el) return;
  const btn = (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') ? el : (el.closest('button, [role="button"]') || el);
  const r = btn.getBoundingClientRect();
  const cx = Math.round(r.left + r.width / 2);
  const cy = Math.round(r.top + r.height / 2);
  const ev = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, button: 0, buttons: 1 };
  try { btn.dispatchEvent(new PointerEvent('pointerdown', { ...ev, pointerType: 'touch', isPrimary: true })); } catch (_) {}
  try { btn.dispatchEvent(new PointerEvent('pointerup', { ...ev, pointerType: 'touch', isPrimary: true })); } catch (_) {}
  try { btn.dispatchEvent(new MouseEvent('mousedown', ev)); } catch (_) {}
  try { btn.dispatchEvent(new MouseEvent('mouseup', ev)); } catch (_) {}
  try { btn.click(); } catch (_) {}
  try { btn.click(); } catch (_) {}
}

try {
  const instantRebetObs = new MutationObserver(() => {
    if (autoRebetArmed) tryClickInstantRebet();
  });
  if (document.documentElement) {
    instantRebetObs.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'data-op'] });
  }
} catch (_) {}

window.addEventListener('DOMContentLoaded', () => {
  if (!document.body) return;
  const obs = new MutationObserver(() => scheduleSlipCheck());
  obs.observe(document.body, { childList: true, subtree: true, characterData: true });
});

// ─── Capture (only genuine user input, never replayed events) ───────────────

let lastUserAction = 0;
let lastReportedStake = null;
let stakeSyncDebounce = null;

function notifyStakeIfChanged() {
  if (replaying || programmaticSuppressed) return;
  clearTimeout(stakeSyncDebounce);
  stakeSyncDebounce = setTimeout(() => {
    const stakeEl = document.querySelector(
      '.m-keybord-input, [data-op="betslip-keyboard-trigger"], span.m-keyboard-input, [class*="keybord-input" i], [class*="keyboard-input" i], input[name*="stake" i], input[placeholder*="stake" i], input[class*="stake" i], [class*="stake-input" i], [class*="stakeInput" i], .m-betslip-stake span, [data-op="fast-betslip-single-stake"]'
    );
    if (!stakeEl) return;
    if (stakeEl.classList && stakeEl.classList.contains('m-input--placeholder')) return;
    const raw = ('value' in stakeEl && stakeEl.value !== undefined && stakeEl.value !== '') ? stakeEl.value : stakeEl.textContent;
    const rawStr = String(raw || '').trim();
    if (/^min\\.?\\s*\\d/i.test(rawStr) || /^stake$/i.test(rawStr) || /^enter/i.test(rawStr)) return;
    const cleaned = rawStr.replace(/[^0-9.]/g, '').trim();
    if (cleaned && cleaned !== lastReportedStake) {
      lastReportedStake = cleaned;
      ipcRenderer.send('view:stake-sync', { value: cleaned });
    }
  }, 0);
}

// Observe custom mobile keypad mutations (SportyBet span.m-keybord-input)
try {
  const stakeObs = new MutationObserver((muts) => {
    if (replaying || programmaticSuppressed) return;
    for (const m of muts) {
      const target = m.target;
      const el = target.nodeType === 1 ? target : target.parentElement;
      if (el && el.closest('.m-keybord-input, [data-op="betslip-keyboard-trigger"], [class*="keybord-input" i], [class*="keyboard-input" i], .stake-keyboard, .m-keyboard')) {
        notifyStakeIfChanged();
        break;
      }
    }
  });
  stakeObs.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
  });
} catch (_) {}

function markUser(e) {
  if (e.isTrusted && !replaying && !programmaticSuppressed) {
    lastUserAction = Date.now();
    ipcRenderer.send('view:focus');
  }
}
['wheel', 'keydown', 'mousedown', 'touchmove', 'pointerdown'].forEach(t =>
  document.addEventListener(t, markUser, { capture: true, passive: true })
);

document.addEventListener('keydown', (e) => {
  if (e.isTrusted && !replaying && !programmaticSuppressed) {
    const active = document.activeElement;
    const inStake = active && (
      active.matches('.m-keybord-input, [data-op="betslip-keyboard-trigger"], input[name*="stake" i], input[class*="stake" i]') ||
      active.closest('.m-betslip, [class*="betslip" i]')
    );
    if (inStake) notifyStakeIfChanged();
  }
}, { capture: true, passive: true });

function triggerElementAction(el) {
  if (!el) return;
  // 1. SportyBet safeTap directive execution
  const tapTarget = (el.matches && el.matches('.place-bet, [class*="place-bet" i], .flexibet-confirm, [data-op*="confirm" i]'))
    ? el
    : (el.closest && (el.closest('.place-bet, [class*="place-bet" i], .flexibet-confirm, [data-op*="confirm" i]') || el));
  const safeTap = tapTarget?.__safe_tap_state__;
  if (safeTap && safeTap.config && typeof safeTap.config.onTap === 'function') {
    try { safeTap.config.onTap(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); } catch (_) {}
  }

  // 2. Vue component proxy method execution
  let cur = el;
  while (cur && cur !== document.documentElement) {
    const comp = cur.__vueParentComponent || cur.__vnode?.component || cur._vnode?.component;
    const proxy = comp?.proxy || comp?.ctx || comp?.setupState;
    if (proxy) {
      if (typeof proxy.onConfirmBtnClick === 'function') {
        try { proxy.onConfirmBtnClick(); } catch (_) {}
      }
      if (typeof proxy.handleConfirm === 'function') {
        try { proxy.handleConfirm(); } catch (_) {}
      }
      if (typeof proxy.onConfirm === 'function') {
        try { proxy.onConfirm(); } catch (_) {}
      }
      if (typeof proxy.handleBetConfirm === 'function') {
        try { proxy.handleBetConfirm(); } catch (_) {}
      }
      if (typeof proxy.betConfirm === 'function') {
        try { proxy.betConfirm({ betHelper: 'QUICK_BET' }); } catch (_) {}
      }
    }
    cur = cur.parentElement;
  }

  // 3. Native DOM click
  try { el.click(); } catch (_) {}
}

function injectConfirmSuppressionStyles() {
  try {
    const styleId = '__mfas_confirm_suppress_styles';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* Suppress SportyBet confirmation buttons & confirmation drawers from visually displaying */
      button[data-op="betslip-confirm"],
      [data-op="betslip-confirm"],
      button.flexibet-confirm,
      .flexibet-confirm,
      [data-op="betslip-confirm-wrap"],
      [data-op="betslip-confirm-to-pay-confirm"],
      [data-op="betslip-confirm-to-pay-btn"],
      [data-op="betslip-confirm-to-pay-modal"],
      [data-op="betslip-confirm-to-pay-sheet"],
      [data-op="confirm-to-pay-modal"],
      [data-op="confirm-to-pay-btn"],
      button:has([data-cms-key="confirm"]),
      [data-cms-key="confirm"],
      .m-fast-betslip [data-op*="confirm" i],
      .m-betslip [data-op*="confirm" i],
      .m-dialog:has([data-op*="confirm" i]),
      .drawer:has([data-op*="confirm" i]),
      [role="dialog"]:has([data-op*="confirm" i]),
      .m-pop-box:has([data-op*="confirm" i]) {
        opacity: 0 !important;
        pointer-events: auto !important;
        transition: none !important;
        animation: none !important;
      }
      .m-mask:has(~ .m-dialog [data-op*="confirm" i]),
      .m-dialog-mask:has(~ .m-dialog [data-op*="confirm" i]) {
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `;
    const target = document.head || document.documentElement;
    if (target) target.appendChild(style);
  } catch (_) {}
}

if (typeof document !== 'undefined') {
  injectConfirmSuppressionStyles();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectConfirmSuppressionStyles);
  }
}

function findConfirmCandidateInView() {
  try {
    const candidates = Array.from(document.querySelectorAll(
      'button[data-op="betslip-confirm"], [data-op="betslip-confirm"], button.flexibet-confirm, .flexibet-confirm, [data-op="betslip-confirm-wrap"] [data-op="betslip-confirm"], button[data-op="betslip-confirm-to-pay-confirm"], [data-op="betslip-confirm-to-pay-confirm"], [data-op="betslip-confirm-to-pay-btn"], [data-op="confirm-to-pay-btn"], button:has([data-cms-key="confirm"]), [data-cms-key="confirm"]'
    ));
    for (const b of candidates) {
      if (!b) continue;
      const r = b.getBoundingClientRect();
      if (r.width < 5 || r.height < 5) continue;
      const t = String(b.innerText || b.textContent || '').trim().toLowerCase();
      if (/deposit|recharge|top[\s-]?up/i.test(t)) continue;
      return b;
    }

    const modals = Array.from(document.querySelectorAll('.es-dialog, .m-dialog, .af-dialog, .m-pop-box, .m-pop, .m-modal, [role="dialog"], [class*="dialog" i], [class*="modal" i]'));
    for (const m of modals) {
      const txt = String(m.innerText || m.textContent || '').trim().toLowerCase();
      if (/insufficient|deposit|low\s*balance/i.test(txt)) continue;
      const mBtns = Array.from(m.querySelectorAll('button, [role="button"], .m-btn, [class*="btn" i], [class*="confirm" i], [class*="pay" i]'));
      for (const mb of mBtns) {
        const r = mb.getBoundingClientRect();
        if (r.width < 5 || r.height < 5) continue;
        const bt = String(mb.innerText || mb.textContent || '').trim().toLowerCase();
        if (/deposit|recharge|top[\s-]?up|cancel|close/i.test(bt)) continue;
        if (/\b(confirm|pay|accept|agree|proceed|submit)\b/i.test(bt)) return mb;
      }
    }
  } catch (_) {}
  return null;
}

let activeConfirmPoll = null;
let activeConfirmObs = null;
function wireBetslipAutoConfirm(triggerEl) {
  const isAccept = /accept\s*changes?|save\s*changes?|^accept$/i.test(
    String(triggerEl?.innerText || triggerEl?.textContent || '').trim()
  );

  clearInterval(activeConfirmPoll);
  if (activeConfirmObs) {
    try { activeConfirmObs.disconnect(); } catch (_) {}
    activeConfirmObs = null;
  }

  const doConfirm = (btn) => {
    clearInterval(activeConfirmPoll);
    activeConfirmPoll = null;
    if (activeConfirmObs) {
      try { activeConfirmObs.disconnect(); } catch (_) {}
      activeConfirmObs = null;
    }
    triggerElementAction(btn);
  };

  // 1. Immediate microsecond check (0ms)
  const immediate = findConfirmCandidateInView();
  if (immediate) {
    doConfirm(immediate);
    return;
  }

  // 2. Instant MutationObserver (fires in microtask before browser paints frame)
  try {
    activeConfirmObs = new MutationObserver(() => {
      const hit = findConfirmCandidateInView();
      if (hit) doConfirm(hit);
    });
    if (document.documentElement) {
      activeConfirmObs.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'data-op']
      });
    }
  } catch (_) {}

  // 3. Fallback polling loop (safety net)
  let waited = 0;
  activeConfirmPoll = setInterval(() => {
    waited += 10;
    if (waited > 3500) {
      clearInterval(activeConfirmPoll);
      activeConfirmPoll = null;
      if (activeConfirmObs) {
        try { activeConfirmObs.disconnect(); } catch (_) {}
        activeConfirmObs = null;
      }
      return;
    }

    // If it was "Accept Changes", look for the button to transition to "Place Bet" and click it
    if (isAccept) {
      const placeEl = Array.from(document.querySelectorAll(
        '.place-bet, [class*="place-bet" i], [data-op="single-placebet"], [data-op="single-placebet-text"], [data-op="betslip-placebet"]'
      )).find(isElementVisible);
      if (placeEl) {
        const t = String(placeEl.innerText || placeEl.textContent || '').trim().toLowerCase();
        if (t.includes('place bet') || t.includes('placebet') || t.includes('bet now') || t === 'bet') {
          triggerElementAction(placeEl);
        }
      }
    }

    const confirmBtn = findConfirmCandidateInView();
    if (confirmBtn) {
      doConfirm(confirmBtn);
    }
  }, 10);
}

document.addEventListener('click', (e) => {
  // If in pick mode, let the pick listener handle it exclusively
  if (pickKind) return;
  // Ignore non-trusted, replaying, or programmatic keypad clicks
  if (!e.isTrusted || replaying || programmaticSuppressed) return;

  const target = e.target;
  const slipActionBtn = target.closest(
    '[data-op="betslip-remove-all"], [data-op="betslip-placebet"], [data-op="betslip-confirm-to-pay-btn"], [data-op*="placebet" i], [data-op*="confirm" i], .place-bet, [class*="place-bet" i], .required-change, button, [role="button"]'
  );
  if (slipActionBtn) {
    const op = String(slipActionBtn.getAttribute('data-op') || '').toLowerCase();
    const btnText = String(slipActionBtn.innerText || slipActionBtn.textContent || '').trim().toLowerCase();
    if (op.includes('betslip-remove-all')) {
      ipcRenderer.send('view:slip-cleared');
    } else if (
      op.includes('placebet') ||
      op.includes('confirm-to-pay') ||
      slipActionBtn.classList.contains('place-bet') ||
      /\b(place\s*bet|confirm|pay\s*now|accept\s*changes?|save\s*changes?)\b/i.test(btnText)
    ) {
      const stakeEl = document.querySelector(
        '.m-fast-betslip span.m-keybord-input, .m-keybord-input, [data-op="betslip-keyboard-trigger"], input[name*="stake" i], input[placeholder*="stake" i], input[class*="stake" i], [class*="stake-input" i], [class*="stakeInput" i]'
      );
      if (stakeEl) {
        const raw = ('value' in stakeEl && stakeEl.value !== undefined) ? stakeEl.value : stakeEl.textContent;
        if (raw) ipcRenderer.send('view:stake-seen', String(raw).trim());
      }
      triggerElementAction(slipActionBtn);
      wireBetslipAutoConfirm(slipActionBtn);
    }
  }
  const isConverter = target.name === 'c2c-converter-input' || !!target.closest('[class*="c2c-converter" i]');
  const isStakeField = !isConverter && !!target.closest(
    '.m-betslip, [class*="betslip" i], [class*="slip" i], .m-input-keyboard-wrapper, .m-keybord-input, [class*="stake" i], [class*="keyboard" i], [data-op="betslip-keyboard-trigger"], .stake-keyboard, [data-op="appendKey"], [data-op="clearAll"], [data-op="removeLast"], [data-op="done-bottom"]'
  );
  if (isStakeField) {
    notifyStakeIfChanged();
  }

  // Detect game / match selection on SportyBet and sync to monitor
  if (/sportybet/i.test(location.hostname)) {
    const card = findMatchCard(target) || target.closest('[class*="match" i], [class*="game" i], [class*="event" i], .m-table-cell, .match-info');
    if (card) {
      const teams = extractTeamsFromCard(card);
      if (teams && teams.length >= 2) {
        ipcRenderer.send('sporty:match-sync', {
          team1: teams[0],
          team2: teams[1],
          query: `${teams[0]} vs ${teams[1]}`,
        });
      } else if (teams && teams.length === 1) {
        ipcRenderer.send('sporty:match-sync', {
          team1: teams[0],
          team2: '',
          query: teams[0],
        });
      }
    }
  }

  const isInput = (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'
    || target.isContentEditable || !!target.closest('input, textarea, [contenteditable]')) && !isStakeField;
  const clickable = target.closest(
    'button, a, [role="button"], input, label, select, [data-op="outcome-btn"], [data-op="betslip-keyboard-trigger"], [data-op="appendKey"], [data-op="clearAll"], [data-op="removeLast"], [data-op="done-bottom"], [data-op="betslip-remove-all"], [data-op="fast-betslip-single-bottom-row-right-content"], [data-op="betslip-placebet"], .place-bet, [class*="place-bet" i], .required-change, [data-op="single-placebet"], [data-op="single-placebet-text"], .flexibet-confirm, [data-op="betslip-confirm"], [data-op="betslip-confirm-wrap"], [class*="btn"], [class*="odd"], span.m-keybord-input, [class*="stake" i]'
  );

  const isInsideModal = !!target.closest(
    '[data-op="betslip-confirm-to-pay-modal"], [class*="mask" i], [class*="modal" i], [class*="popup" i], [class*="dialog" i], [class*="confirm" i], [class*="sheet" i]'
  );

  send({
    type: 'click',
    selector: cssPath(target),
    smartSelector: uniqueSelector(target),
    clickableSelector: clickable ? uniqueSelector(clickable) : null,
    semantic: extractSemantic(target, clickable),
    isFormInput: isInput,
    isStakeField: isStakeField,
    isInsideModal: isInsideModal,
    rx: e.clientX / window.innerWidth,
    ry: e.clientY / window.innerHeight,
  });
}, true);

let scrollQueued = false;
document.addEventListener('scroll', (e) => {
  if (Date.now() - lastUserAction > 400 || scrollQueued || replaying || programmaticSuppressed) return;
  scrollQueued = true;
  requestAnimationFrame(() => {
    scrollQueued = false;
    const t = e.target;
    const isDoc = t === document || t === document.documentElement || t === document.body;
    const el = isDoc ? document.scrollingElement : t;
    const max = el.scrollHeight - el.clientHeight;
    send({ type: 'scroll', selector: isDoc ? null : cssPath(t), ratio: max > 0 ? el.scrollTop / max : 0 });
  });
}, true);

document.addEventListener('input', (e) => {
  if (!e.isTrusted || replaying || programmaticSuppressed) return;
  const el = e.target;
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
  if (el.type === 'password' || el.name === 'c2c-converter-input') return;

  const isStake = !!el.closest('.m-betslip, [class*="betslip" i], [class*="stake" i]')
    || /stake|amount/i.test(`${el.placeholder || ''} ${el.name || ''} ${el.className || ''}`);
  if (isStake) {
    notifyStakeIfChanged();
  }

  const isSearch = el.type === 'search'
    || /search/i.test(`${el.placeholder || ''} ${el.name || ''} ${el.className || ''}`);

  if (/sportybet/i.test(location.hostname) && isSearch && el.value && el.value.trim().length >= 2) {
    ipcRenderer.send('sporty:match-sync', {
      query: el.value.trim(),
      team1: el.value.trim(),
      team2: '',
    });
  }

  send({
    type: 'input',
    selector: cssPath(el),
    smartSelector: uniqueSelector(el),
    isSearch,
    value: el.value,
  });
}, true);

// ─── Replay ─────────────────────────────────────────────────────────────────

function findTarget(m) {
  const crossSite = !!(m.srcSite && m.srcSite !== currentSite());
  if (crossSite) {
    // STRICT CROSS-SITE SAFETY: never use blind (rx, ry) coordinates or foreign selectors
    return findCrossSiteTarget(m);
  }

  // 0. For outcomes and match navigation, semantic matching across cards is highest fidelity
  if (m.semantic && (m.semantic.kind === 'outcome' || m.semantic.kind === 'match-nav')) {
    const semHit = findCrossSiteTarget(m);
    if (semHit) return semHit;
  }

  const x = m.rx != null ? Math.round(m.rx * window.innerWidth) : null;
  const y = m.ry != null ? Math.round(m.ry * window.innerHeight) : null;
  let el = null;

  // 1. Same-site: if user clicked a specific button or interactive control, try that selector first
  if (m.clickableSelector) {
    try { el = document.querySelector(m.clickableSelector); } catch (_) {}
  }
  if (!el && m.smartSelector) {
    try { el = document.querySelector(m.smartSelector); } catch (_) {}
  }

  // 1b. Same-site country-agnostic semantic fallback (e.g. NG <-> GH path differences)
  if (!el && m.semantic) {
    el = findCrossSiteTarget(m);
  }

  // 2. Same-site fallback: exact screen coordinate element (backdrop dismissal, etc.)
  if (!el && x != null && y != null) {
    el = document.elementFromPoint(x, y);
  }

  // 3. Fallback to css path selector
  if (!el && m.selector) {
    try { el = document.querySelector(m.selector); } catch (_) {}
  }
  return el;
}

ipcRenderer.on('mirror-replay', (_e, m) => {
  replaying = true;
  try {
    const crossSite = !!(m.srcSite && m.srcSite !== currentSite());
    if (m.type === 'click') {
      const el = findTarget(m);

      if (el) {
        const clickable = el.closest('button, a, [role="button"], label, input, [data-op="outcome-btn"], .place-bet, [class*="place-bet" i], .required-change, [data-op="single-placebet"], [data-op="single-placebet-text"], .flexibet-confirm, [data-op="betslip-confirm"], [data-op="betslip-confirm-wrap"]');
        const targetToClick = clickable || el;

        const isOverlay = targetToClick.matches && targetToClick.matches(
          'body, html, [class*="mask" i], [class*="overlay" i], [class*="backdrop" i], [class*="dialog" i], [class*="modal" i]'
        );
        if (!isOverlay && typeof el.scrollIntoView === 'function') {
          try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (_) {}
        }
        if (typeof el.focus === 'function' && !isOverlay) {
          try { el.focus(); } catch (_) {}
        }

        const rect = targetToClick.getBoundingClientRect ? targetToClick.getBoundingClientRect() : null;
        const hasValidRect = rect && rect.width > 0 && rect.height > 0 && !isOverlay;
        const x = hasValidRect
          ? Math.round(rect.left + rect.width / 2)
          : (m.rx != null ? Math.round(m.rx * window.innerWidth) : 0);
        const y = hasValidRect
          ? Math.round(rect.top + rect.height / 2)
          : (m.ry != null ? Math.round(m.ry * window.innerHeight) : 0);

        const mouseOpts = {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: x,
          clientY: y,
          screenX: x,
          screenY: y,
          button: 0,
          buttons: 1,
          pointerType: 'touch',
          isPrimary: true
        };

        // Dispatch TouchEvent for mobile touch handlers (e.g. SportyBet/Football mobile sheet & mask tap listeners)
        try {
          if (typeof Touch !== 'undefined' && typeof TouchEvent !== 'undefined') {
            const touch = new Touch({ identifier: Date.now(), target: targetToClick, clientX: x, clientY: y, screenX: x, screenY: y, pageX: x, pageY: y });
            targetToClick.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, view: window, touches: [touch], targetTouches: [touch], changedTouches: [touch] }));
            targetToClick.dispatchEvent(new TouchEvent('touchend',   { bubbles: true, cancelable: true, view: window, touches: [], targetTouches: [], changedTouches: [touch] }));
          }
        } catch (_) {}

        targetToClick.dispatchEvent(new PointerEvent('pointerdown', mouseOpts));
        targetToClick.dispatchEvent(new MouseEvent('mousedown', mouseOpts));
        targetToClick.dispatchEvent(new PointerEvent('pointerup', mouseOpts));
        targetToClick.dispatchEvent(new MouseEvent('mouseup', mouseOpts));
        targetToClick.click();

        // Match navigation Nuxt router / URL fallback
        if (m.semantic?.kind === 'match-nav' && m.semantic?.hrefPath) {
          const targetPath = stripCountryPrefix(m.semantic.hrefPath);
          setTimeout(() => {
            try {
              const curPath = stripCountryPrefix(location.pathname);
              if (curPath !== targetPath) {
                if (window.useNuxtApp && window.useNuxtApp().$router) {
                  window.useNuxtApp().$router.push(m.semantic.hrefPath);
                } else {
                  location.href = m.semantic.hrefPath;
                }
              }
            } catch (_) {
              try { location.href = m.semantic.hrefPath; } catch (_) {}
            }
          }, 120);
        }

        if (m.semantic?.action === 'place-bet') {
          triggerElementAction(targetToClick);
          wireBetslipAutoConfirm(targetToClick);
        }
      }
    } else if (m.type === 'scroll') {
      const el = (!crossSite && m.selector)
        ? (document.querySelector(m.selector) || document.scrollingElement)
        : document.scrollingElement;
      if (el) el.scrollTop = m.ratio * (el.scrollHeight - el.clientHeight);
    } else if (m.type === 'input') {
      let el = null;
      if (crossSite) {
        if (m.isSearch) {
          el = Array.from(document.querySelectorAll(
            'input[type="search"], input[placeholder*="search" i], [class*="search" i] input'
          )).find(isElementVisible) || null;
        }
      } else {
        el = (m.smartSelector && document.querySelector(m.smartSelector))
          || (m.selector && document.querySelector(m.selector)) || null;
      }
      if (el && el.type !== 'password') {
        const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const desc = Object.getOwnPropertyDescriptor(proto, 'value');
        if (desc && desc.set) desc.set.call(el, m.value); else el.value = m.value;
        el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: m.value }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  } catch (_) { /* missing element in one pane should not break the rest */ }
  finally {
    setTimeout(() => { replaying = false; }, 30);
  }
});

// ─── Element picker (Pick Odds / Pick Stake) ────────────────────────────────

ipcRenderer.on('pick-mode', (_e, kind) => {
  pickKind = kind || null;
  document.documentElement.style.cursor = pickKind ? 'crosshair' : '';
  if (!pickKind && hoverBox) hoverBox.style.display = 'none';
});

document.addEventListener('mousemove', (e) => {
  if (!pickKind) return;
  ensureHoverBox();
  let el = e.target;
  if (el === hoverBox || el === document.documentElement || el === document.body) {
    hoverBox.style.display = 'none'; return;
  }
  if (pickKind === 'stake') {
    const input = el.closest('input,textarea,[class*="input"]') || el.querySelector('input,textarea,[class*="input"]');
    if (input) el = input;
  }
  const r = el.getBoundingClientRect();
  if (r.width > 0 && r.height > 0) {
    hoverBox.style.display = 'block';
    hoverBox.style.left = `${r.left}px`; hoverBox.style.top = `${r.top}px`;
    hoverBox.style.width = `${r.width}px`; hoverBox.style.height = `${r.height}px`;
    hoverBox.style.borderColor = pickKind === 'odds' ? '#4ade80' : '#e0b341';
    hoverBox.style.background  = pickKind === 'odds' ? 'rgba(74,222,128,0.2)' : 'rgba(224,179,65,0.2)';
  }
}, true);

// Suppress page reactions during picker
['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'touchend'].forEach(t =>
  document.addEventListener(t, (e) => {
    if (pickKind) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, { capture: true, passive: false })
);

document.addEventListener('click', (e) => {
  if (!pickKind) return;
  e.preventDefault();
  e.stopPropagation();

  const kind = pickKind;
  pickKind = null;
  document.documentElement.style.cursor = '';

  let el = e.target;

  if (kind === 'odds') {
    // If clicked element has children with odds, get innermost odds text
    const children = Array.from(el.querySelectorAll('*'));
    for (let i = children.length - 1; i >= 0; i--) {
      const t = (children[i].textContent || '').trim();
      if (/\d+(?:[.,]\d+)?/.test(t) && t.length <= 12) { el = children[i]; break; }
    }
  } else if (kind === 'stake') {
    const input = el.closest('input,textarea,[class*="input"]') || el.querySelector('input,textarea,[class*="input"]');
    if (input) el = input;
  }

  // Flash green feedback
  if (hoverBox) {
    const r = el.getBoundingClientRect();
    Object.assign(hoverBox.style, {
      left:`${r.left}px`, top:`${r.top}px`, width:`${r.width}px`, height:`${r.height}px`,
      borderColor:'#22c55e', background:'rgba(34,197,94,0.3)'
    });
    setTimeout(() => { if (hoverBox) hoverBox.style.display = 'none'; }, 350);
  }

  const selector = uniqueSelector(el);
  let count = 0;
  try { count = document.querySelectorAll(selector).length; } catch (_) {}
  const raw = el.value !== undefined && el.value !== '' ? el.value : el.textContent || '';

  ipcRenderer.send('picked', {
    kind,
    selector,
    count,
    tag: el.tagName.toLowerCase(),
    readOnly: !!el.readOnly,
    sample: String(raw).trim().slice(0, 40),
  });
}, true);
