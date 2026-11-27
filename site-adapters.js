'use strict';

const VALID_SITES = new Set(['sportybet', 'football']);
const VALID_COUNTRIES = new Set(['ng', 'gh']);

function normalizeSite(site, fallback = 'sportybet') {
  const s = String(site || '').toLowerCase().trim();
  if (VALID_SITES.has(s)) return s;
  return VALID_SITES.has(fallback) ? fallback : 'sportybet';
}

function normalizeCountry(country, fallback = 'ng') {
  const c = String(country || '').toLowerCase().trim();
  if (VALID_COUNTRIES.has(c)) return c;
  return VALID_COUNTRIES.has(fallback) ? fallback : 'ng';
}

function siteFromUrl(url, fallback = 'sportybet') {
  if (!url || url === 'about:blank') return normalizeSite(fallback);
  if (/football\.com/i.test(url)) return 'football';
  if (/sportybet\.com/i.test(url)) return 'sportybet';
  return normalizeSite(fallback);
}

function countryFromUrl(url, fallback = 'ng') {
  if (!url || url === 'about:blank') return normalizeCountry(fallback);
  if (/\/gh(\/|$|\?)/i.test(url)) return 'gh';
  if (/\/ng(\/|$|\?)/i.test(url)) return 'ng';
  return normalizeCountry(fallback);
}

function buildHomeUrl(site, country = 'ng') {
  const s = normalizeSite(site);
  const c = normalizeCountry(country);
  const host = s === 'football' ? 'www.football.com' : 'www.sportybet.com';
  return `https://${host}/${c}/m/`;
}

function buildOpenBetsUrl(site, country = 'ng') {
  const s = normalizeSite(site);
  const c = normalizeCountry(country);
  if (s === 'football') {
    return `https://www.football.com/${c}/my_accounts/open_bets`;
  }
  return `https://www.sportybet.com/${c}/m/my_accounts/open_bets`;
}

function normalizeUrlForProfile(input, fallbackSite = 'sportybet', fallbackCountry = 'ng') {
  let t = String(input || '').trim();
  if (!t) return 'about:blank';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(t)) t = `https://${t}`;
  const defCountry = normalizeCountry(fallbackCountry);
  try {
    const u = new URL(t);
    if (u.hostname.includes('sportybet.com') || u.hostname.includes('football.com')) {
      if (u.pathname === '/' || u.pathname === '') {
        u.pathname = `/${defCountry}/m/`;
        t = u.toString();
      } else if (/^\/(ng|gh)\/?$/i.test(u.pathname)) {
        u.pathname = `/${RegExp.$1.toLowerCase()}/m/`;
        t = u.toString();
      }
    }
  } catch (_) {}
  return t;
}

function rewriteCountryOnUrl(rawUrl, targetSite, toCountry) {
  const s = normalizeSite(targetSite, siteFromUrl(rawUrl));
  const to = normalizeCountry(toCountry);
  const from = to === 'gh' ? 'ng' : 'gh';
  const u = String(rawUrl || '').trim();
  if (!u || u === 'about:blank') return buildHomeUrl(s, to);

  if (s === 'football') {
    if (!/football\.com/i.test(u)) return buildHomeUrl('football', to);
    const hasM = new RegExp(`/${from}/m(/|$)`, 'i');
    const noM = new RegExp(`/${from}(/|$)`, 'i');
    if (hasM.test(u)) return u.replace(hasM, `/${to}/m$1`);
    if (noM.test(u)) return u.replace(noM, `/${to}$1`);
    return u.replace(/football\.com(\/[a-z]{2}(\/m)?)?/i, `football.com/${to}/m`);
  }

  if (!/sportybet\.com/i.test(u)) return buildHomeUrl('sportybet', to);
  const hasM = new RegExp(`/${from}/m(/|$)`, 'i');
  const noM = new RegExp(`/${from}(/|$)`, 'i');
  if (hasM.test(u)) return u.replace(hasM, `/${to}/m$1`);
  if (noM.test(u)) return u.replace(noM, `/${to}/m$1`);
  return u.replace(/sportybet\.com(\/[a-z]{2}(\/m)?)?/i, `sportybet.com/${to}/m`);
}

function rewriteUrlForProfile(currentUrl, nextSite, nextCountry) {
  const s = normalizeSite(nextSite);
  const c = normalizeCountry(nextCountry);
  if (!currentUrl || currentUrl === 'about:blank') return buildHomeUrl(s, c);

  const curSite = siteFromUrl(currentUrl, s);
  if (curSite === s) {
    return rewriteCountryOnUrl(currentUrl, s, c);
  }
  if (/\/open_bets\b/i.test(currentUrl)) {
    return buildOpenBetsUrl(s, c);
  }
  return buildHomeUrl(s, c);
}

const MIN_STAKES = {
  sportybet: { ng: '10', gh: '0.1' },
  football: { ng: '1', gh: '0.1' },
};

function minStakeForProfile(site, country = 'ng') {
  const s = normalizeSite(site);
  const c = normalizeCountry(country);
  return (MIN_STAKES[s] && MIN_STAKES[s][c]) || '10';
}

// ─── Shared in-page DOM snippets (handle both SportyBet & Football.com) ───

const HAS_CONFIRM_OPEN_EXPR = `(() => {
  const isV = (el) => {
    if (!el || el.disabled) return false;
    if (el.getAttribute('aria-disabled') === 'true' || el.getAttribute('disabled') !== null) return false;
    if (el.classList.contains('is-disabled') || el.classList.contains('disabled')) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 5 || r.height < 5) return false;
    const st = window.getComputedStyle(el);
    return st.visibility !== 'hidden' && st.display !== 'none' && st.pointerEvents !== 'none';
  };
  const isCo = (el) => !!(el && el.closest && el.closest('.m-cashout, [class*="cashout" i], [data-op*="cashout" i], [class*="open_bets" i]'));
  if (Array.from(document.querySelectorAll('[data-op="betslip-success-rebet"], [data-op="betslip-success"], .m-betslip-success, .m-success-box, [class*="betslip-success" i]')).some(el => isV(el) && !isCo(el))) return false;
  if (Array.from(document.querySelectorAll('button[data-op="betslip-confirm"], [data-op="betslip-confirm"], button.flexibet-confirm, .flexibet-confirm, [data-op="betslip-confirm-wrap"] [data-op="betslip-confirm"], button[data-op="betslip-confirm-to-pay-confirm"], [data-op="betslip-confirm-to-pay-confirm"], [data-op="betslip-confirm-to-pay-btn"], [data-op="confirm-to-pay-btn"], [data-op="betslip-confirm-to-pay-modal"], .m-fast-betslip button:has([data-cms-key="confirm"]), .m-betslip button:has([data-cms-key="confirm"]), [data-op*="betslip" i] button:has([data-cms-key="confirm"])')).some(el => isV(el) && !isCo(el))) return true;
  const modals = Array.from(document.querySelectorAll('.es-dialog, .m-dialog, .af-dialog, .m-pop-box, .m-pop, .m-modal, [role="dialog"], [class*="dialog" i], [class*="modal" i], [class*="popup" i], [class*="sheet" i], [class*="confirm" i]')).filter(m => isV(m) && !isCo(m));
  for (const m of modals) {
    const mt = String(m.innerText || m.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase();
    if (/insufficient\\s*(funds|balance)|not\\s*enough\\s*balance|please\\s*deposit|low\\s*balance|\\bcash\\s*out\\b|\\bcashout\\b|auto-accept odds change/i.test(mt)) continue;
    if (mt.includes('odds change next time') && mt.includes('bet settings')) continue;
    const btns = Array.from(m.querySelectorAll('button, [role="button"], .m-btn, .af-button, .es-button, [class*="btn" i], [class*="confirm" i], [class*="pay" i]')).filter(c => isV(c) && !isCo(c));
    if (btns.some(c => {
      const t = String(c.innerText || c.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase();
      const op = String(c.getAttribute('data-op') || '').toLowerCase();
      if (!t || /\\b(deposit|recharge|top[\\s-]?up|cancel|close|back|later|dismiss|re-?bet|place\\s*bet)\\b/i.test(t)) return false;
      return op.includes('confirm') || op.includes('pay') || /\\b(confirm|pay\\s*now)\\b/i.test(t);
    })) return true;
  }
  return false;
})()`;

const IS_CONFIRM_OPEN_JS = `(${HAS_CONFIRM_OPEN_EXPR})`;

const FIND_STAKE_INPUT_JS = `
  (() => {
    const confirmOpen = ${HAS_CONFIRM_OPEN_EXPR};
    const isVis = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
    };
    const isExcludedInput = (el) => {
      if (!el) return true;
      const name = String(el.getAttribute?.('name') || el.name || '').toLowerCase();
      const op = String(el.getAttribute?.('data-op') || '').toLowerCase();
      if (name.includes('c2c-converter') || op === 'c2c-converter-input') return true;
      if (el.closest('[data-op="c2c-converter-input"], [class*="c2c" i]')) return true;
      return false;
    };
    const isFootball = /football\\.com/i.test(location.hostname || '');

    if (isFootball) {
      // Expand collapsed Football.com multi-betslip pill only if trigger isn't visible yet
      const visibleTrig = Array.from(document.querySelectorAll('[data-op="betslip-keyboard-trigger"]')).filter(isVis);
      if (visibleTrig.length > 0) {
        // Prefer expanded bottom sheet trigger when open, else fast slip trigger
        const inSheet = visibleTrig.find((el) => el.closest('[data-op="betslip-bottom-sheet"]'));
        return inSheet || visibleTrig[visibleTrig.length - 1];
      }
      const countBadge = Array.from(document.querySelectorAll('[data-op="betslip-selection-count"]')).find(isVis);
      const hasSheet = !!Array.from(document.querySelectorAll('[data-op="betslip-bottom-sheet"]')).find(isVis);
      const hasFast = !!Array.from(document.querySelectorAll('[data-op="fast-betslip-container"]')).find(isVis);
      if (!confirmOpen && countBadge && !hasSheet && !hasFast) {
        try {
          const _nuxtEl = document.querySelector('#__nuxt') || document.querySelector('#app') || countBadge;
          let _pinia = null;
          if (typeof window.useNuxtApp === 'function') {
            try { _pinia = window.useNuxtApp().$pinia; } catch (_) {}
          }
          if (!_pinia) {
            let _cur = _nuxtEl;
            while (_cur && _cur !== document.documentElement) {
              const _comp = _cur.__vueParentComponent || _cur.__vnode?.component || _cur._vnode?.component;
              if (_comp) {
                _pinia = _comp.appContext?.config?.globalProperties?.$pinia || _comp.appContext?.provides?.[Symbol.for('pinia')] || _comp.appContext?.provides?.pinia;
                if (_pinia) break;
              }
              _cur = _cur.parentElement;
            }
          }
          if (_pinia) {
            const _uiStore = _pinia._s?.get('betslip_ui_state');
            if (_uiStore && typeof _uiStore.openBetslipBottomSheet === 'function') {
              _uiStore.openBetslipBottomSheet();
            }
          }
        } catch (_) {}
        const bar = countBadge.closest('section, button, [role="button"], [data-op*="betslip" i]') || countBadge;
        if (bar && !bar.closest('[data-op="fast-betslip-single-close"], [data-op="betslip-remove-all"]')) {
          try { bar.click(); } catch (_) {}
        }
      }
    }

    // 1. Auto-expand SportyBet betslip if collapsed/minimized (never click while Confirm is open)
    const slipBar = document.querySelector('.m-betslip-bar, [class*="betslip-bar" i], .m-slip-bar, [class*="slip-bar" i]');
    if (!confirmOpen && slipBar && isVis(slipBar)) {
      const slipBox = Array.from(document.querySelectorAll('.m-betslip, .m-fast-betslip, [class*="betslip" i], [class*="bet-slip" i]')).find(el => {
        if (el === slipBar || slipBar.contains(el)) return false;
        const cls = String(el.className || '');
        return !/(bar|entry|icon|badge|count)/i.test(cls) && isVis(el);
      });
      if (!slipBox) {
        try { slipBar.click(); } catch (_) {}
      }
    }

    // 2. Exact Mobile custom keyboard elements first (Football.com & SportyBet)
    const mobileKeypadSelectors = [
      '[data-op="betslip-keyboard-trigger"]',
      'span.m-keybord-input',
      'span.m-keyboard-input',
      '[class*="keybord-input" i]',
      '[class*="keyboard-input" i]'
    ];

    for (const sel of mobileKeypadSelectors) {
      const list = Array.from(document.querySelectorAll(sel)).filter(isVis);
      if (list.length > 0) return list[list.length - 1];
    }

    // 3. Standard input elements for stake
    const stakeInputSelectors = [
      'input[placeholder*="stake" i]',
      'input[placeholder*="Stake" i]',
      'input[placeholder*="Amount" i]',
      'input[name*="stake" i]',
      'input[class*="stake" i]',
      '.stake-input input',
      '.m-stake input',
      'div[class*="stake" i] input',
      '.m-betslip input[type="tel"]',
      '.m-betslip input[type="number"]',
      '.m-betslip input[type="text"]',
      '[class*="betslip" i] input[type="tel"]',
      '[class*="betslip" i] input[type="number"]',
      '[class*="betslip" i] input[type="text"]',
      '[class*="betslip" i] input',
      '[class*="slip" i] input'
    ];

    for (const sel of stakeInputSelectors) {
      const list = Array.from(document.querySelectorAll(sel)).filter((el) => isVis(el) && !isExcludedInput(el));
      if (list.length > 0) return list[0];
    }

    // 4. Generic SportyBet mobile wrapper fallbacks (avoid plain static label spans)
    const fallbackWrapSelectors = [
      '.m-input-keyboard-wrapper',
      '[class*="input-keyboard-wrapper" i]',
      '.m-betslip-stake span',
      '[class*="betslip-stake" i] span',
      '.m-betslip-stake',
      '[class*="betslip-stake" i]',
      '.m-stake span',
      '[class*="stake-input" i] span',
      '[class*="stake-input" i]'
    ];

    for (const sel of fallbackWrapSelectors) {
      const list = Array.from(document.querySelectorAll(sel)).filter(el => {
        if (!isVis(el) || isExcludedInput(el)) return false;
        const txt = (el.textContent || '').trim().toLowerCase();
        return txt !== 'stake' && txt !== 'total stake';
      });
      if (list.length > 0) return list[0];
    }

    // 5. Any element inside betslip matching stake classes
    const slip = document.querySelector('[data-op="fast-betslip-container"], [data-op="betslip-bottom-sheet"], .m-betslip, [class*="betslip" i], [class*="bet-slip" i], #betslip');
    if (slip) {
      const items = Array.from(slip.querySelectorAll('input, span, div')).filter((el) => isVis(el) && !isExcludedInput(el));
      const match = items.find(el => {
        const c = (el.className || '').toString().toLowerCase();
        const op = (el.getAttribute('data-op') || '').toLowerCase();
        const p = (el.getAttribute('placeholder') || '').toLowerCase();
        return c.includes('stake') || c.includes('keybord') || c.includes('amount') || p.includes('stake') || op.includes('keyboard-trigger');
      });
      if (match) return match;
    }

    // 6. Fallback to any visible numeric input not related to search/phone/booking-code
    const allInputs = Array.from(document.querySelectorAll('input')).filter(isVis).filter(inp => {
      if (isExcludedInput(inp)) return false;
      const p = (inp.placeholder || '').toLowerCase();
      const n = (inp.name || '').toLowerCase();
      const t = (inp.type || '').toLowerCase();
      return t !== 'password' && t !== 'checkbox' && t !== 'radio' &&
             !p.includes('search') && !p.includes('booking') && !n.includes('phone') && !n.includes('search') &&
             !p.includes('mobile') && !p.includes('phone');
    });

    if (allInputs.length > 0) {
      const likely = allInputs.find(i => i.inputMode === 'decimal' || i.inputMode === 'numeric' || (i.className || '').includes('stake'));
      return likely || allInputs[0];
    }
    return null;
  })()
`;

function oddsReadCode(selector) {
  return `
    (() => {
      const parseOddsText = (txt) => {
        if (!txt) return null;
        const cleaned = String(txt).replace(/,/g, '.').trim();
        const decMatches = cleaned.match(/\\b[1-9]\\d*\\.\\d{1,3}\\b/g);
        if (decMatches) {
          const valid = decMatches.map(Number).filter(n => n > 1.0 && n < 100000);
          if (valid.length > 0) return valid[valid.length - 1];
        }
        const anyMatches = cleaned.match(/\\d+(?:\\.\\d+)?/g);
        if (anyMatches) {
          const valid = anyMatches.map(Number).filter(n => n > 1.0 && n < 100000);
          if (valid.length > 0) return valid[valid.length - 1];
        }
        return null;
      };

      const isVis = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
      };

      // 1. If manual selector provided, try reading from it first
      const sel = ${JSON.stringify(selector || '')};
      if (sel) {
        try {
          const el = document.querySelector(sel);
          if (el) {
            const raw = String(el.value !== undefined && el.value !== '' ? el.value : el.textContent || '').trim();
            const o = parseOddsText(raw);
            if (o) return o;
          }
        } catch (_) {}
      }

      const isFootball = /football\\.com/i.test(location.hostname || '');

      if (isFootball) {
        // Prefer visible expanded betslip bottom sheet if open
        const sheet = Array.from(document.querySelectorAll('[data-op="betslip-bottom-sheet"]')).find(isVis);
        if (sheet) {
          // Check explicit total/combo odds element if rendered in Multiples mode
          const explicitTotal = Array.from(sheet.querySelectorAll(
            '[data-op*="total-odds" i], [data-op*="combo-odds" i], [data-op*="multi-odds" i], [data-op="betslip-total-odds"]'
          )).find(isVis);
          if (explicitTotal) {
            const o = parseOddsText(explicitTotal.textContent);
            if (o) return o;
          }

          const selections = Array.from(sheet.querySelectorAll('[data-op="betslip-selection"]')).filter(isVis);
          if (selections.length > 1) {
            // Check summary row labeled Total Odds / Odds
            const rows = Array.from(sheet.querySelectorAll('[data-op*="row" i], [data-op*="summary" i]')).filter(isVis);
            for (const row of rows) {
              const txt = (row.textContent || '').trim();
              if (/total\\s*odds/i.test(txt)) {
                const o = parseOddsText(txt);
                if (o) return o;
              }
            }
            // Otherwise compute multi-leg product from each visible selection
            let prod = 1;
            let count = 0;
            for (const s of selections) {
              const odEl = s.querySelector('[data-op="betslip-outcome-odds-display"]');
              const o = parseOddsText(odEl ? odEl.textContent : s.textContent);
              if (o && o > 1) { prod *= o; count++; }
            }
            if (count >= 2 && prod > 1) return Math.round(prod * 100) / 100;
          }

          const sheetOdds = Array.from(sheet.querySelectorAll('[data-op="betslip-outcome-odds-display"]')).find(isVis);
          if (sheetOdds) {
            const o = parseOddsText(sheetOdds.textContent);
            if (o) return o;
          }
        }

        // Fast betslip single selection
        const fast = Array.from(document.querySelectorAll('[data-op="fast-betslip-container"]')).find(isVis);
        if (fast) {
          const fastOdds = Array.from(fast.querySelectorAll(
            '[data-op="fast-betslip-single-content-right-area"], [data-op="fast-betslip-multiple-right-content"], [data-op="betslip-outcome-odds-display"], [class*="right-content" i], [class*="right-area" i]'
          )).find(isVis);
          if (fastOdds) {
            const o = parseOddsText(fastOdds.textContent);
            if (o) return o;
          }
        }

        // Fallback: active outcome buttons on match list (before fast slip renders or if single selected)
        const activeBtns = Array.from(document.querySelectorAll('[data-op="outcome-btn"]')).filter((el) => {
          if (!isVis(el)) return false;
          const cls = String(el.className || '');
          return cls.includes('brand-secondary') || el.getAttribute('aria-pressed') === 'true' || el.getAttribute('aria-selected') === 'true';
        });
        if (activeBtns.length === 1) {
          const o = parseOddsText(activeBtns[0].textContent);
          if (o) return o;
        } else if (activeBtns.length > 1) {
          let prod = 1;
          let count = 0;
          for (const b of activeBtns) {
            const o = parseOddsText(b.textContent);
            if (o && o > 1) { prod *= o; count++; }
          }
          if (count >= 2 && prod > 1) return Math.round(prod * 100) / 100;
        }
      }

      // 2. SportyBet / generic betslip search
      const slipContainers = Array.from(document.querySelectorAll(
        '.m-bet-slip, .m-betslip, [class*="betslip" i], [class*="bet-slip" i], #betslip, .m-slip, [class*="slip-box" i]'
      )).filter(isVis);

      for (const slip of slipContainers) {
        const oddsElements = Array.from(slip.querySelectorAll(
          '[class*="odds" i], [class*="odd" i], .af-odds, .m-betslip-odds, .m-value'
        )).filter(isVis);
        for (const oEl of oddsElements) {
          const o = parseOddsText(oEl.textContent);
          if (o) return o;
        }

        const items = Array.from(slip.querySelectorAll(
          '[class*="item" i], [class*="selection" i], [class*="outcome" i]'
        )).filter(isVis);
        for (const it of items) {
          const o = parseOddsText(it.textContent);
          if (o) return o;
        }
      }

      // 3. Active / Selected option in market table
      const activeSelectors = [
        '.m-table-cell--active',
        '.m-outcome--active',
        '.m-table-cell.active',
        '.m-outcome.active',
        '.m-outcome.selected',
        '[class*="outcome"][class*="active" i]',
        '[class*="cell"][class*="active" i]',
        '[class*="active" i]',
        '[class*="selected" i]',
        '[aria-pressed="true"]',
        '[aria-selected="true"]'
      ];

      const activeCells = Array.from(document.querySelectorAll(activeSelectors.join(', '))).filter(isVis);
      for (const cell of activeCells) {
        if (cell.offsetWidth > 450 && cell.offsetHeight > 450) continue;
        const oddsChild = cell.querySelector('[class*="odds" i], .af-odds, [class*="odd" i]');
        if (oddsChild) {
          const o = parseOddsText(oddsChild.textContent);
          if (o) return o;
        }
        const o = parseOddsText(cell.textContent);
        if (o) return o;
      }

      // 4. Bottom betslip bar indicator
      const bar = document.querySelector('[class*="betslip-bar" i], [class*="slip-bar" i], .m-betslip-bar');
      if (bar && isVis(bar)) {
        const o = parseOddsText(bar.textContent);
        if (o) return o;
      }

      return null;
    })()
  `;
}

function readFieldCode(selector) {
  return `
    (() => {
      let el = null;
      const sel = ${JSON.stringify(selector || '')};
      if (sel) {
        try { el = document.querySelector(sel); } catch (_) {}
        if (el && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') {
          const inner = el.querySelector('input, textarea');
          if (inner) el = inner;
        }
      }
      if (!el) {
        const findStake = ${FIND_STAKE_INPUT_JS};
        el = findStake;
      }
      if (!el && ${HAS_CONFIRM_OPEN_EXPR}) {
        // Confirm overlay may hide underlying betslip input; read mounted element or store read-only
        el = document.querySelector(
          'span.m-keybord-input, span.m-keyboard-input, [data-op="betslip-keyboard-trigger"], .m-betslip input[type="tel"], .m-betslip input[type="number"], [class*="betslip" i] input[name*="stake" i]'
        );
        if (!el) {
          try {
            const appEl = document.querySelector('#app');
            const ss = appEl?.__vue_app__?.config?.globalProperties?.$store?.state?.betslipStake?.singleStake;
            if (ss && typeof ss === 'object') {
              const vals = Object.values(ss).map(v => String(v || '').trim()).filter(Boolean);
              if (vals.length > 0) return vals[0];
            }
            const ms = appEl?.__vue_app__?.config?.globalProperties?.$store?.state?.betslipStake?.multipleStake;
            if (ms !== undefined && String(ms).trim()) return String(ms).trim();
          } catch (_) {}
          try {
            const nuxtEl = document.querySelector('#__nuxt') || document.querySelector('#app');
            const pinia = nuxtEl?.__vue_app__?.config?.globalProperties?.$pinia;
            const st = pinia?._s?.get('betslip_stake');
            if (st?.defaultStake) return String(st.defaultStake).trim();
          } catch (_) {}
        }
      }
      if (!el) return null;
      if (el.classList && el.classList.contains('m-input--placeholder')) return '';
      const raw = String(el.value !== undefined && el.value !== '' ? el.value : el.textContent || '').trim();
      if (/^min\\.?\\s*\\d/i.test(raw) || /^stake$/i.test(raw) || /^enter/i.test(raw)) return '';
      return raw;
    })()
  `;
}

// Dedicated helper to synchronize Football.com visible stake directly into Nuxt 3 / Pinia store
function FOOTBALL_SYNC_STAKE_SNIPPET(valVar, elVar) {
  return `
        try {
          const _fbVal = String(${valVar} || '').trim();
          if (_fbVal && !/^min\\b/i.test(_fbVal) && !/^stake$/i.test(_fbVal) && !/^enter/i.test(_fbVal)) {
            const _nuxtEl = document.querySelector('#__nuxt') || document.querySelector('#app') || document.body.firstElementChild;
            let _pinia = _nuxtEl?.__vue_app__?.config?.globalProperties?.$pinia;
            if (!_pinia && ${elVar}) {
              let _cEl = ${elVar};
              while (_cEl && _cEl !== document.documentElement) {
                const _comp = _cEl.__vueParentComponent || _cEl.__vnode?.component || _cEl._vnode?.component;
                if (_comp) {
                  _pinia = _comp.appContext?.config?.globalProperties?.$pinia || _comp.appContext?.provides?.[Symbol.for('pinia')] || _comp.appContext?.provides?.pinia;
                  if (_pinia) break;
                }
                _cEl = _cEl.parentElement;
              }
            }
            if (_pinia) {
              const _store = _pinia._s?.get('betslip_stake') || _pinia._s?.get('betslip_real');
              if (_store) {
                if (typeof _store.updateRealStakes === 'function') {
                  try { _store.updateRealStakes(_fbVal); } catch (_) {}
                }
                if (typeof _store.updateDefaultStake === 'function') {
                  try { _store.updateDefaultStake(_fbVal); } catch (_) {}
                }
                if (typeof _store.updateSingleStake === 'function') {
                  try { _store.updateSingleStake({}, { syncAllWith: _fbVal }); } catch (_) {}
                }
                if (typeof _store.updateMultipleStake === 'function') {
                  try { _store.updateMultipleStake(_fbVal); } catch (_) {}
                }
                if (_store.defaultStake) {
                  try { _store.defaultStake.value = _fbVal; } catch (_) {}
                }
                if (_store.multipleStake) {
                  try { _store.multipleStake.value = _fbVal; } catch (_) {}
                }
                if (_store.singleStakeMap && _store.singleStakeMap.value) {
                  try {
                    _store.singleStakeMap.value.union = _fbVal;
                    for (const _k of Object.keys(_store.singleStakeMap.value)) {
                      _store.singleStakeMap.value[_k] = _fbVal;
                    }
                  } catch (_) {}
                }
              }
              if (_pinia.state?.value?.betslip_stake) {
                const _s = _pinia.state.value.betslip_stake;
                _s.defaultStake = _fbVal;
                _s.multipleStake = _fbVal;
                if (_s.singleStakeMap) {
                  _s.singleStakeMap.union = _fbVal;
                  for (const _k of Object.keys(_s.singleStakeMap)) {
                    _s.singleStakeMap[_k] = _fbVal;
                  }
                }
              }
            }

            if (${elVar}) {
              let _curComp = ${elVar};
              while (_curComp && _curComp !== document.documentElement) {
                const _comp = _curComp.__vueParentComponent || _curComp.__vnode?.component || _curComp._vnode?.component;
                if (_comp) {
                  try { _comp.emit('update:modelValue', _fbVal); } catch (_) {}
                  try { _comp.emit('change', _fbVal); } catch (_) {}
                  try { _comp.emit('input', _fbVal); } catch (_) {}
                  const _proxy = _comp.proxy || _comp.ctx || _comp.setupState;
                  if (_proxy) {
                    if (typeof _proxy.updateSingleStake === 'function') {
                      try { _proxy.updateSingleStake({}, { syncAllWith: _fbVal }); } catch (_) {}
                    }
                    if (typeof _proxy.updateMultipleStake === 'function') {
                      try { _proxy.updateMultipleStake(_fbVal); } catch (_) {}
                    }
                    if (typeof _proxy.updateDefaultStake === 'function') {
                      try { _proxy.updateDefaultStake(_fbVal); } catch (_) {}
                    }
                  }
                }
                _curComp = _curComp.parentElement;
              }
            }

            const _kb = document.querySelector('div.stake-keyboard, [data-op="stake-keyboard"]');
            if (_kb) {
              try {
                const _clearBtn = _kb.querySelector('[data-op="clearAll"], [data-key="clear"]');
                if (_clearBtn) _clearBtn.click();
                for (const _ch of _fbVal) {
                  const _keyBtn = Array.from(_kb.querySelectorAll('[data-op="appendKey"]')).find(n => (n.textContent || '').trim() === _ch)
                    || Array.from(_kb.querySelectorAll('[data-key]')).find(n => n.getAttribute('data-key') === _ch);
                  if (_keyBtn) _keyBtn.click();
                }
                const _doneBtn = _kb.querySelector('[data-op="done-bottom"], [data-key="done"], [data-key="ok"], [data-key="hide"]');
                if (_doneBtn) _doneBtn.click();
              } catch (_) {}
            }
          }
        } catch (_) {}
  `;
}

const KEYBOARD_CONTAINER_SELECTOR = 'div.stake-keyboard, [data-op="stake-keyboard"], div.m-keyboard, div.m-keybord, [class*="fastMode-keyboard" i], [class*="m-keyboard" i]';

const FAST_REBET_CYCLE_JS = (targetStake) => `
  (async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const isVis = (el) => {
      if (!el || el.disabled) return false;
      if (el.getAttribute('aria-disabled') === 'true' || el.getAttribute('disabled') !== null) return false;
      if (el.classList.contains('is-disabled') || el.classList.contains('disabled')) return false;
      const r = el.getBoundingClientRect();
      if (r.width < 5 || r.height < 5) return false;
      const st = window.getComputedStyle(el);
      return st.visibility !== 'hidden' && st.display !== 'none';
    };

    const norm = (el) => String(el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();

    const traceLogs = [];
    const logTrace = (...args) => {
      const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      try { console.log('[PlaceBet:Trace]', msg); } catch (_) {}
      traceLogs.push(msg);
    };

    const isDepositText = (t) => {
      if (!t) return false;
      return /\b(deposit|top[\s-]?up|recharge|fund|add\s*funds?|deposit\s*&\s*bet)\b/i.test(t);
    };

    const isRebetText = (t) => {
      if (!t || t.length > 50 || isDepositText(t)) return false;
      return /^re-?bet(\s+(now|all|selections?))?$/i.test(t) || t === 'rebet' ||
        /\b(re-?bet|bet again|keep selections?|repeat bet|duplicate bet|one more)\b/i.test(t);
    };

    const isNavOrFooter = (el) => {
      if (!el) return false;
      if (el.closest('.m-fast-betslip, .m-fast-stake-wrapper, .m-fast-stake, [data-op="fast-betslip-container"], [data-op="fast-betslip-wrap"], [data-op*="fast-betslip" i], [class*="fast-betslip" i], .m-betslip, .m-bet-slip, [class*="betslip" i], [class*="bet-slip" i], .es-dialog, .m-dialog, .af-dialog, .m-pop-box, .m-pop, .m-modal, [role="dialog"], [class*="dialog" i], [class*="modal" i], [class*="popup" i], [class*="sheet" i]')) {
        return false;
      }
      return !!el.closest('footer, nav, .m-bottom-nav, .m-main-tab, .af-tabbar, .m-footer, header, .m-header, .m-nav-bar, .af-nav-bar, [class*="bottom-nav" i], [class*="tabbar" i]');
    };

    const isDepositElement = (el) => {
      try {
        if (!el) return false;
        const t = norm(el);
        if (typeof isRebetText === 'function' && isRebetText(t)) return false;
        if (isNavOrFooter(el)) return true;
        if (isDepositText(t)) return true;
        const op = String(el.getAttribute?.('data-op') || '').toLowerCase();
        if (op.includes('deposit') || op.includes('recharge') || op.includes('topup')) return true;
        if (op.includes('pay') && !op.includes('betslip')) return true;
        const href = String(el.getAttribute?.('href') || '').toLowerCase();
        if (href.includes('deposit') || href.includes('recharge') || href.includes('pay')) return true;
        const cls = String(el.className || '').toLowerCase();
        if (cls.includes('deposit')) return true;
      } catch (err) {
        logTrace('[PlaceBet:Error] isDepositElement error:', String(err));
      }
      return false;
    };

    const triggerClick = (target) => {
      if (!target || isDepositElement(target)) return null;
      const btn = (target.tagName === 'BUTTON' || target.getAttribute('role') === 'button')
        ? target
        : (target.closest('button, [role="button"]') || target);
      if (isDepositElement(btn)) return null;

      try { btn.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (_) {}
      const r = btn.getBoundingClientRect();
      const cx = Math.round(r.left + r.width / 2);
      const cy = Math.round(r.top + r.height / 2);
      const evInit = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, button: 0, buttons: 1 };

      // 1. SportyBet custom safeTap directive execution
      const tapTarget = btn.matches?.('.place-bet, [class*="place-bet" i], .flexibet-confirm, [data-op*="confirm" i]')
        ? btn
        : (btn.closest?.('.place-bet, [class*="place-bet" i], .flexibet-confirm, [data-op*="confirm" i]')
           || btn.querySelector?.('.place-bet, [class*="place-bet" i], .flexibet-confirm, [data-op*="confirm" i]')
           || btn);
      const safeTap = tapTarget?.__safe_tap_state__ || btn?.__safe_tap_state__;
      if (safeTap && safeTap.config && typeof safeTap.config.onTap === 'function') {
        try { safeTap.config.onTap(new MouseEvent('click', evInit)); } catch (_) {}
      }

      // 2. Vue component proxy method execution
      let cur = btn;
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
          if (typeof proxy.onPlaceBet === 'function') {
            try { proxy.onPlaceBet(); } catch (_) {}
          }
          if (typeof proxy.placeBet === 'function') {
            try { proxy.placeBet(); } catch (_) {}
          }
          if (typeof proxy.handlePlaceBet === 'function') {
            try { proxy.handlePlaceBet(); } catch (_) {}
          }
        }
        cur = cur.parentElement;
      }

      try {
        btn.dispatchEvent(new PointerEvent('pointerdown', { ...evInit, pointerType: 'touch', isPrimary: true }));
        btn.dispatchEvent(new PointerEvent('pointerup', { ...evInit, pointerType: 'touch', isPrimary: true }));
      } catch (_) {}
      try {
        if (typeof Touch !== 'undefined' && typeof TouchEvent !== 'undefined') {
          const touchObj = new Touch({ identifier: Date.now(), target: btn, clientX: cx, clientY: cy, screenX: cx, screenY: cy, pageX: cx, pageY: cy, radiusX: 10, radiusY: 10 });
          btn.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, view: window, touches: [touchObj], targetTouches: [touchObj], changedTouches: [touchObj] }));
          btn.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, view: window, touches: [], targetTouches: [], changedTouches: [touchObj] }));
        }
      } catch (_) {}
      try {
        btn.dispatchEvent(new MouseEvent('mousedown', evInit));
        btn.dispatchEvent(new MouseEvent('mouseup', evInit));
      } catch (_) {}
      try { btn.click(); } catch (_) {}
      if (target !== btn && !isDepositElement(target)) {
        try { target.click(); } catch (_) {}
      }
      logTrace('triggerClick dispatched on:', {
        tagName: btn.tagName,
        className: btn.className,
        dataOp: btn.getAttribute?.('data-op'),
        text: norm(btn),
        hasSafeTap: !!safeTap,
        cx, cy
      });
      return { x: cx, y: cy };
    };


    // 1. Instant-fire detection for Rebet button:
    // Pre-warmed MutationObserver fires synchronously on DOM microtask (<0.5ms) the instant
    // the Rebet button is inserted into the DOM, backed by immediate check and a fallback polling loop.
    let rebetClicked = false;
    let rebetCoords = null;
    let detectionMethod = 'none';
    const isFootball = /football\.com/i.test(location.hostname || '');

    const tryFindRebet = () => {
      // Tier 1: Exact SportyBet rebet selectors (fastest match)
      const exact = Array.from(document.querySelectorAll(
        'button[data-op="betslip-success-rebet"], [data-op="betslip-success-rebet"], button.rebet, button[class*="rebet" i], [data-cms-key="rebet"], .rebet-text, [data-op*="rebet" i]'
      )).find(b => isVis(b) && !isDepositElement(b) && !isNavOrFooter(b));
      if (exact) return exact;

      // Tier 2: Inside any open dialog / success modal
      const dialogs = Array.from(document.querySelectorAll(
        '.es-dialog, .m-dialog, .af-dialog, .m-pop-box, .m-pop, .m-modal, [role="dialog"], [class*="dialog" i], [class*="modal" i], [class*="success" i]'
      )).filter(isVis);
      for (const d of dialogs) {
        const hit = Array.from(d.querySelectorAll(
          'button, [role="button"], a, div, span, .m-btn, .af-button, [class*="btn" i], [class*="rebet" i], [data-op*="rebet" i]'
        )).filter(b => isVis(b) && !isDepositElement(b) && !isNavOrFooter(b))
          .find(el => {
            const op = String(el.getAttribute?.('data-op') || '').toLowerCase();
            return op.includes('rebet') || isRebetText(norm(el));
          });
        if (hit) return hit;
      }

      // Tier 3: Text-match anywhere on page
      const textHit = Array.from(document.querySelectorAll(
        '[data-op*="rebet" i], [data-test-id*="rebet" i], [class*="rebet" i], button, a, [role="button"], div, span, .m-btn, .af-button, .es-button, [class*="btn" i]'
      )).filter(b => isVis(b) && !isDepositElement(b) && !isNavOrFooter(b))
        .find(el => {
          const op = (el.getAttribute('data-op') || '').toLowerCase();
          return op.includes('rebet') || isRebetText(norm(el));
        });
      if (textHit) return textHit;

      return null;
    };

    // Step A: Immediate check — button might ALREADY be present in DOM
    const immediate = tryFindRebet();
    if (immediate) {
      rebetCoords = triggerClick(immediate);
      try { immediate.click(); } catch (_) {}
      try { immediate.click(); } catch (_) {}
      rebetClicked = true;
      detectionMethod = 'immediate-dom';
      logTrace('[Rebet:Detection] Instant match: button already present in DOM (0ms)');
    } else {
      // Step B: Pre-warmed MutationObserver: arms BEFORE button appears and fires on microtask (<0.5ms)
      let obs = null;
      const onObsHit = (btn) => {
        if (rebetClicked) return;
        if (obs) { try { obs.disconnect(); } catch (_) {} obs = null; }
        rebetCoords = triggerClick(btn);
        try { btn.click(); } catch (_) {}
        try { btn.click(); } catch (_) {}
        rebetClicked = true;
        detectionMethod = 'mutation-observer';
        logTrace('[Rebet:Detection] Pre-warmed MutationObserver caught Rebet button (<0.5ms)');
      };

      try {
        obs = new MutationObserver(() => {
          const b = tryFindRebet();
          if (b) onObsHit(b);
        });
        if (document.documentElement) {
          obs.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'data-op']
          });
        }
      } catch (_) {}

      // Double-check right after attaching observer
      const quick = tryFindRebet();
      if (quick) {
        onObsHit(quick);
      }

      // Step C: Fallback polling loop (checks every 2ms) in case observer does not trigger
      if (!rebetClicked) {
        for (let attempt = 0; attempt < 2500; attempt++) {
          if (rebetClicked) break;
          const pollBtn = tryFindRebet();
          if (pollBtn) {
            if (obs) { try { obs.disconnect(); } catch (_) {} obs = null; }
            rebetCoords = triggerClick(pollBtn);
            try { pollBtn.click(); } catch (_) {}
            try { pollBtn.click(); } catch (_) {}
            rebetClicked = true;
            detectionMethod = 'fallback-poll (attempt ' + attempt + ')';
            logTrace('[Rebet:Detection] Fallback polling loop caught Rebet button (attempt ' + attempt + ')');
            break;
          }

          // Betslip already remounted with selections (rebet already processed)
          if (attempt > 80) {
            if (!isFootball) {
              const slipRoot = document.querySelector('.m-bet-slip, .m-betslip, [class*="betslip" i], [class*="bet-slip" i]');
              if (slipRoot && isVis(slipRoot)) {
                const hasItems = !!slipRoot.querySelector('.m-bet-item, .m-item, .slip-item, [class*="bet-item" i]');
                const hasInput = (${FIND_STAKE_INPUT_JS})();
                if (hasItems && hasInput && isVis(hasInput)) {
                  rebetClicked = true;
                  detectionMethod = 'betslip-remounted';
                  break;
                }
              }
            } else {
              const input = (${FIND_STAKE_INPUT_JS})();
              if (input && isVis(input)) {
                rebetClicked = true;
                detectionMethod = 'betslip-remounted';
                break;
              }
            }
          }

          await wait(2);
        }
      }

      if (obs) { try { obs.disconnect(); } catch (_) {} obs = null; }
    }

    if (!rebetClicked) return { ok: false, reason: 'no_rebet_btn' };

    // 2. Set decremented stake immediately when input mounts
    const val = ${JSON.stringify(String(targetStake))};
    let inputUpdated = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      const input = (${FIND_STAKE_INPUT_JS})();
      if (input && isVis(input)) {
        const inp = (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA') ? input : input.querySelector('input, textarea');
        if (inp) {
          try { inp.focus(); } catch (_) {}
          const proto = inp.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (setter) setter.call(inp, val);
          else inp.value = val;
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
          inp.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
          inputUpdated = true;
          break;
        } else if (input) {
          try {
            input.classList.remove('m-input--placeholder');
            input.textContent = val;
            input.innerText = val;
            if (isFootball) {
              ${FOOTBALL_SYNC_STAKE_SNIPPET('val', 'input')}
            } else {
              let cur = input;
              while (cur && cur !== document.documentElement) {
                const comp = cur.__vueParentComponent || cur.__vnode?.component || cur._vnode?.component;
                if (comp) {
                  try { comp.emit('input', val); } catch (_) {}
                  const proxy = comp.proxy || comp.ctx || comp.setupState;
                  if (proxy && typeof proxy.changeSingleStake === 'function') {
                    try { proxy.changeSingleStake(val); } catch (_) {}
                  }
                }
                cur = cur.parentElement;
              }
            }
            inputUpdated = true;
            break;
          } catch (_) {}
        }
      }
      await wait(15);
    }

    return { ok: true, rebetClicked, detectionMethod, rebetX: rebetCoords?.x, rebetY: rebetCoords?.y, inputUpdated, stake: val };
  })()
`;

// ─── Single Complete Attack Cycle Engine ─────────────────────────────────────
// Executes a full, unified, ultra-fast cycle:
// 1. Wait for Betslip & Place Bet button to be enabled
// 2. Click Place Bet
// 3. Wait for Confirm / Secondary Confirm & click it immediately
// 4. Wait for "Bet Successful" modal & click Rebet immediately (<0.1ms via preload or script)
// 5. Wait for "Bet Successful" modal to close
// 6. Wait for Betslip to re-mount selections & Place Bet button to become enabled again
// 7. Apply decremented stake
// Returns { ok: true, cycleCompleted: true } so the next cycle can fire immediately!
const EXECUTE_ATTACK_CYCLE_JS = (targetStake, isFinalCycle = false) => `
  (async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const isVis = (el) => {
      if (!el || el.disabled) return false;
      if (el.getAttribute('aria-disabled') === 'true' || el.getAttribute('disabled') !== null) return false;
      if (el.classList.contains('is-disabled') || el.classList.contains('disabled')) return false;
      const r = el.getBoundingClientRect();
      if (r.width < 5 || r.height < 5) return false;
      const st = window.getComputedStyle(el);
      return st.visibility !== 'hidden' && st.display !== 'none';
    };

    const norm = (el) => String(el?.innerText || el?.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase();

    const traceLogs = [];
    const logTrace = (...args) => {
      const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      try { console.log('[AutoRebet:Trace]', msg); } catch (_) {}
      if (traceLogs.length < 100) traceLogs.push(msg);
    };

    const isDepositText = (t) => {
      if (!t) return false;
      return /\\b(deposit|top[\\s-]?up|recharge|fund|add\\s*funds?|deposit\\s*&\\s*bet)\\b/i.test(t);
    };

    const isPlaceBetText = (t) => {
      if (!t || isDepositText(t)) return false;
      return (
        t.includes('place bet') || t.includes('placebet') ||
        t.includes('bet now') || t.includes('place a bet') ||
        t === 'bet' ||
        t.includes('accept change') || t.includes('accept changes') ||
        t.includes('save change') || t.includes('save changes') ||
        t.includes('confirm bet') || t.includes('confirm order') ||
        t === 'accept'
      );
    };

    const isConfirmText = (t) => {
      if (!t || t.length > 80 || isDepositText(t)) return false;
      if (/^(cancel|close|back|no|decline|reject|exit|dismiss|×|✕)$/i.test(t)) return false;
      if (/\\b(cancel|close|keep looking|continue betting)\\b/i.test(t)) return false;
      if (/\\b(confirm|pay now|accept|agree|proceed|submit)\\b/i.test(t)) return true;
      if (/\\b(confirm bet|confirm to pay|confirm order|place bet)\\b/i.test(t)) return true;
      if (/^(ok|yes|continue|next|i understand|got it)$/i.test(t)) return true;
      if (/^accept\\b/i.test(t) || /^confirm\\b/i.test(t)) return true;
      return false;
    };

    const isRebetText = (t) => {
      if (!t || t.length > 50 || isDepositText(t)) return false;
      return /^re-?bet(\\s+(now|all|selections?))?$/i.test(t) || t === 'rebet' ||
        /\\b(re-?bet|bet again|keep selections?|repeat bet|duplicate bet|one more)\\b/i.test(t);
    };

    const isNavOrFooter = (el) => {
      if (!el) return false;
      if (el.closest('.m-fast-betslip, .m-fast-stake-wrapper, .m-fast-stake, [data-op="fast-betslip-container"], [data-op="fast-betslip-wrap"], [data-op*="fast-betslip" i], [class*="fast-betslip" i], .m-betslip, .m-bet-slip, [class*="betslip" i], [class*="bet-slip" i], .es-dialog, .m-dialog, .af-dialog, .m-pop-box, .m-pop, .m-modal, [role="dialog"], [class*="dialog" i], [class*="modal" i], [class*="popup" i], [class*="sheet" i]')) {
        return false;
      }
      return !!el.closest('footer, nav, .m-bottom-nav, .m-main-tab, .af-tabbar, .m-footer, header, .m-header, .m-nav-bar, .af-nav-bar, [class*="bottom-nav" i], [class*="tabbar" i]');
    };

    const isDepositElement = (el) => {
      try {
        if (!el) return false;
        const t = norm(el);
        if (typeof isPlaceBetText === 'function' && isPlaceBetText(t)) return false;
        if (typeof isConfirmText === 'function' && isConfirmText(t)) return false;
        if (typeof isRebetText === 'function' && isRebetText(t)) return false;
        if (isNavOrFooter(el)) return true;
        if (isDepositText(t)) return true;
        const op = String(el.getAttribute?.('data-op') || '').toLowerCase();
        if (op.includes('deposit') || op.includes('recharge') || op.includes('topup')) return true;
        if (op.includes('pay') && !op.includes('betslip') && !op.includes('confirm') && !op.includes('place')) return true;
        const href = String(el.getAttribute?.('href') || '').toLowerCase();
        if (href.includes('deposit') || href.includes('recharge')) return true;
        const cls = String(el.className || '').toLowerCase();
        if (cls.includes('deposit')) return true;
      } catch (err) {
        logTrace('[PlaceBet:Error] isDepositElement error:', String(err));
      }
      return false;
    };

    const triggerClick = (target) => {
      if (!target || isDepositElement(target)) return null;
      const btn = (target.tagName === 'BUTTON' || target.getAttribute('role') === 'button')
        ? target
        : (target.closest('button, [role="button"]') || target);
      if (isDepositElement(btn)) return null;

      try { btn.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (_) {}
      const r = btn.getBoundingClientRect();
      const cx = Math.round(r.left + r.width / 2);
      const cy = Math.round(r.top + r.height / 2);
      const evInit = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, button: 0, buttons: 1 };

      // 1. SportyBet custom safeTap directive execution
      const tapTarget = btn.matches?.('.place-bet, [class*="place-bet" i], .flexibet-confirm, [data-op*="confirm" i]')
        ? btn
        : (btn.closest?.('.place-bet, [class*="place-bet" i], .flexibet-confirm, [data-op*="confirm" i]')
           || btn.querySelector?.('.place-bet, [class*="place-bet" i], .flexibet-confirm, [data-op*="confirm" i]')
           || btn);
      const safeTap = tapTarget?.__safe_tap_state__ || btn?.__safe_tap_state__;
      if (safeTap && safeTap.config && typeof safeTap.config.onTap === 'function') {
        try { safeTap.config.onTap(new MouseEvent('click', evInit)); } catch (_) {}
      }

      // 2. Vue component proxy method execution
      let cur = btn;
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
          if (typeof proxy.onPlaceBet === 'function') {
            try { proxy.onPlaceBet(); } catch (_) {}
          }
          if (typeof proxy.placeBet === 'function') {
            try { proxy.placeBet(); } catch (_) {}
          }
          if (typeof proxy.handlePlaceBet === 'function') {
            try { proxy.handlePlaceBet(); } catch (_) {}
          }
        }
        cur = cur.parentElement;
      }

      try {
        btn.dispatchEvent(new PointerEvent('pointerdown', { ...evInit, pointerType: 'touch', isPrimary: true }));
        btn.dispatchEvent(new PointerEvent('pointerup', { ...evInit, pointerType: 'touch', isPrimary: true }));
      } catch (_) {}
      try {
        if (typeof Touch !== 'undefined' && typeof TouchEvent !== 'undefined') {
          const touchObj = new Touch({ identifier: Date.now(), target: btn, clientX: cx, clientY: cy, screenX: cx, screenY: cy, pageX: cx, pageY: cy, radiusX: 10, radiusY: 10 });
          btn.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, view: window, touches: [touchObj], targetTouches: [touchObj], changedTouches: [touchObj] }));
          btn.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, view: window, touches: [], targetTouches: [], changedTouches: [touchObj] }));
        }
      } catch (_) {}
      try {
        btn.dispatchEvent(new MouseEvent('mousedown', evInit));
        btn.dispatchEvent(new MouseEvent('mouseup', evInit));
      } catch (_) {}
      try { btn.click(); } catch (_) {}
      if (target !== btn && !isDepositElement(target)) {
        try { target.click(); } catch (_) {}
      }
      logTrace('triggerClick dispatched on:', {
        tagName: btn.tagName,
        className: btn.className,
        dataOp: btn.getAttribute?.('data-op'),
        text: norm(btn),
        hasSafeTap: !!safeTap,
        cx, cy
      });
      return { x: cx, y: cy };
    };


    const checkInsufficientBalance = () => {
      if (location.pathname.includes('/deposit') || location.href.includes('/deposit')) {
        try { if (window.history.length > 1) window.history.back(); } catch (_) {}
        return { error: 'on_deposit_page', insufficientBalance: true, msg: 'View is currently on Deposit page' };
      }
      const dialogs = Array.from(document.querySelectorAll(
        '.es-dialog, .m-dialog, .af-dialog, .m-pop-box, .m-pop, .m-modal, [role="dialog"], [class*="dialog" i], [class*="modal" i], [class*="popup" i]'
      )).filter(isVis);
      for (const d of dialogs) {
        const txt = norm(d);
        if (/insufficient\\s*(funds|balance)|not\\s*enough\\s*balance|please\\s*deposit|low\\s*balance|balance\\s*is\\s*too\\s*low|top[\\s-]?up\\s*to\\s*continue/i.test(txt)) {
          return { error: 'insufficient_balance', insufficientBalance: true, msg: 'Insufficient balance dialog is open' };
        }
      }
      const alerts = Array.from(document.querySelectorAll('.m-msg, .af-msg, .es-msg, [class*="toast" i], [class*="notice" i], [class*="alert" i]')).filter(isVis);
      for (const a of alerts) {
        const txt = norm(a);
        if (/insufficient\\s*(funds|balance)|not\\s*enough\\s*balance|please\\s*deposit/i.test(txt)) {
          return { error: 'insufficient_balance', insufficientBalance: true, msg: 'Insufficient balance alert detected' };
        }
      }
      return null;
    };

    const checkOddsLocked = () => {
      const slipRoot = document.querySelector('.m-bet-slip, .m-betslip, [class*="betslip" i], [class*="bet-slip" i], #betslip');
      if (!slipRoot || !isVis(slipRoot)) return null;

      const items = Array.from(slipRoot.querySelectorAll('.m-bet-item, .m-item, .slip-item, [class*="bet-item" i]')).filter(isVis);
      for (const item of items) {
        const cls = String(item.className || '').toLowerCase();
        if (cls.includes('suspend') || (cls.includes('locked') && !cls.includes('unlocked'))) {
          return { error: 'odds_locked', oddsLocked: true, msg: 'Selection in betslip is suspended or locked' };
        }
        const hasLockIcon = item.querySelector('.m-icon-locked, .is-suspended, .is-locked, [data-op*="locked" i], [data-op*="suspend" i]');
        if (hasLockIcon && isVis(hasLockIcon)) {
          return { error: 'odds_locked', oddsLocked: true, msg: 'Selection in betslip is suspended' };
        }
      }

      const slipNotice = Array.from(slipRoot.querySelectorAll('.m-msg, .af-msg, .es-msg, [class*="notice" i], [class*="alert" i]')).find(isVis);
      if (slipNotice) {
        const noticeTxt = norm(slipNotice);
        if (/\\b(selection(s)?\\s*suspended|market\\s*suspended|market\\s*closed|odds\\s*unavailable)\\b/i.test(noticeTxt)) {
          return { error: 'odds_locked', oddsLocked: true, msg: noticeTxt };
        }
      }
      return null;
    };

    const isBetslipExpanded = () => {
      try {
        const slipBar = document.querySelector('.m-betslip-bar, [class*="betslip-bar" i], .m-slip-bar, [class*="slip-bar" i], [data-op="betslip-bar"]');
        const expandedSlip = Array.from(document.querySelectorAll('.m-betslip, .m-bet-slip, [class*="betslip" i], [class*="bet-slip" i]')).find(el => {
          if (el === slipBar || slipBar?.contains(el)) return false;
          const cls = String(el.className || '');
          return !/(bar|entry|icon|badge|count)/i.test(cls) && isVis(el);
        });
        return !!expandedSlip;
      } catch (err) {
        logTrace('[PlaceBet:Error] isBetslipExpanded error:', String(err));
        return false;
      }
    };

    const ensureBetslipExpanded = () => {
      try {
        if (findPlaceBetBtn() || isBetslipExpanded()) return false;
        const slipBar = document.querySelector('.m-betslip-bar, [class*="betslip-bar" i], .m-slip-bar, [class*="slip-bar" i], [data-op="betslip-bar"]');
        if (slipBar && isVis(slipBar)) {
          slipBar.click();
          return true;
        }
      } catch (err) {
        logTrace('[PlaceBet:Error] ensureBetslipExpanded error:', String(err));
      }
      return false;
    };

    const findPlaceBetBtn = () => {
      const isFootball = /football\\.com/i.test(location.hostname || '');
      if (isFootball) {
        const sheet = Array.from(document.querySelectorAll('[data-op="betslip-bottom-sheet"]')).find(isVis);
        const fast = Array.from(document.querySelectorAll('[data-op="fast-betslip-container"]')).find(isVis);
        const sheetBtn = sheet && Array.from(sheet.querySelectorAll('[data-op="betslip-placebet"]')).find(b => isVis(b) && !isDepositElement(b));
        const fastBtn = fast && Array.from(fast.querySelectorAll('[data-op="fast-betslip-single-bottom-row-right-content"], [data-op="betslip-placebet"]')).find(b => isVis(b) && !isDepositElement(b));
        return sheetBtn || fastBtn || Array.from(document.querySelectorAll('[data-op="betslip-placebet"], [data-op="fast-betslip-single-bottom-row-right-content"]')).find(b => isVis(b) && !isDepositElement(b));
      }

      // Collapsed fast betslip button first (SportyBet & general)
      const fastSlip = Array.from(document.querySelectorAll(
        '.m-fast-betslip, .m-fast-stake-wrapper, .m-fast-stake, [data-op="fast-betslip-container"], [data-op="fast-betslip-wrap"], [data-op*="fast-betslip" i], [class*="fast-betslip" i]'
      )).find(isVis);
      if (fastSlip) {
        const candidates = Array.from(fastSlip.querySelectorAll(
          '.place-bet, [class*="place-bet" i], .required-change, [data-op="single-placebet"], [data-op="single-placebet-text"], [data-op="fast-betslip-single-bottom-row-right-content"], [data-op="betslip-placebet"], button, [role="button"], .m-btn, [class*="btn" i]'
        )).filter(b => isVis(b) && !isDepositElement(b) && !isNavOrFooter(b));
        const match = candidates.find(b => isPlaceBetText(norm(b)));
        if (match) return match;
        const placeBetDiv = fastSlip.querySelector('.place-bet, [class*="place-bet" i], [data-op="single-placebet"]');
        if (placeBetDiv && isVis(placeBetDiv) && !isDepositElement(placeBetDiv) && isPlaceBetText(norm(placeBetDiv))) {
          return placeBetDiv;
        }
      }

      // Direct match on collapsed fast-betslip button without container requirement
      const directFast = Array.from(document.querySelectorAll(
        '[data-op="fast-betslip-single-bottom-row-right-content"], [data-op="single-placebet"], .place-bet, [class*="place-bet" i]'
      )).find(b => isVis(b) && !isDepositElement(b) && !isNavOrFooter(b) && isPlaceBetText(norm(b)));
      if (directFast) return directFast;

      // 1. Exact SportyBet Place Bet selector
      const rawExactPlace = Array.from(document.querySelectorAll(
        'button[data-op="betslip-placebet"], [data-op="betslip-placebet"], button:has([data-cms-key="place_bet"]), button:has([data-cms-key="placebet"]), button:has([data-cms-key*="place" i]), button.place-bet, [data-op*="placebet" i]'
      )).find(b => isVis(b) && !isNavOrFooter(b) && !isDepositElement(b));
      if (rawExactPlace) return rawExactPlace;

      // 2. On-screen keyboard Place Bet
      const kbPlace = Array.from(document.querySelectorAll('div.stake-keyboard [data-op="betslip-placebet"], div.stake-keyboard [data-op="done-bottom"], div.m-keyboard [data-op="betslip-placebet"]')).find(b => isVis(b) && !isDepositElement(b));
      if (kbPlace) return kbPlace;

      // 3. Search inside betslip root
      const slipRoot = document.querySelector('.m-bet-slip, .m-betslip, [class*="betslip" i], [class*="bet-slip" i], #betslip');
      if (slipRoot && isVis(slipRoot)) {
        const btns = Array.from(slipRoot.querySelectorAll(
          'button, [role="button"], .m-btn, .af-button, .es-button, [class*="btn" i], [class*="submit" i], [class*="place" i]'
        )).filter(b => isVis(b) && !isDepositElement(b) && !isNavOrFooter(b) && isPlaceBetText(norm(b)));
        if (btns.length > 0) return btns[btns.length - 1];
      }

      return null;
    };

    const findConfirmCandidate = (initialBtn) => {
      const exactSportyConfirm = Array.from(document.querySelectorAll(
        'button[data-op="betslip-confirm"], [data-op="betslip-confirm"], button.flexibet-confirm, .flexibet-confirm, button:has([data-cms-key="confirm"]), [data-cms-key="confirm"], [data-op="betslip-confirm-to-pay-btn"]'
      )).find(b => isVis(b) && !isDepositElement(b));
      if (exactSportyConfirm) return exactSportyConfirm;

      const modalContainers = Array.from(document.querySelectorAll(
        '.es-dialog, .m-dialog, .af-dialog, .m-pop-box, .m-pop, .m-modal, [role="dialog"], [class*="dialog" i], [class*="modal" i], [class*="popup" i], [class*="sheet" i], [class*="confirm" i]'
      )).filter(isVis);

      for (const modal of modalContainers) {
        const modalTxt = norm(modal);
        if (/insufficient\\s*(funds|balance)|not\\s*enough\\s*balance|please\\s*deposit|low\\s*balance/i.test(modalTxt)) {
          continue;
        }
        const candidates = Array.from(modal.querySelectorAll(
          'button, [role="button"], .m-btn, .af-button, .es-button, [class*="btn" i], [class*="confirm" i], [class*="pay" i]'
        )).filter(c => isVis(c) && !isDepositElement(c));

        const hit = candidates.find(c => {
          if (c.tagName !== 'BUTTON' && c.querySelector('button, [role="button"]')) return false;
          const t = norm(c);
          if (isDepositText(t)) return false;
          const op = String(c.getAttribute('data-op') || '').toLowerCase();
          if (op.includes('deposit') || op.includes('recharge')) return false;
          if (op.includes('confirm') || op.includes('pay') || op.includes('accept')) return true;
          return isConfirmText(t);
        });
        if (hit) return hit;
      }

      const slipRoot = document.querySelector('.m-bet-slip, .m-betslip, [class*="betslip" i], [class*="bet-slip" i], #betslip');
      if (slipRoot && isVis(slipRoot) && !isNavOrFooter(slipRoot)) {
        const candidates = Array.from(slipRoot.querySelectorAll(
          'button, [role="button"], .m-btn, .af-button, .es-button, [class*="btn" i], [class*="confirm" i]'
        )).filter(c => isVis(c) && !isDepositElement(c) && !isNavOrFooter(c));

        const hit = candidates.find(c => {
          if (c.tagName !== 'BUTTON' && c.querySelector('button, [role="button"]')) return false;
          if (initialBtn && c === initialBtn) return false;
          const t = norm(c);
          if (isDepositText(t)) return false;
          const op = String(c.getAttribute('data-op') || '').toLowerCase();
          if (op.includes('deposit') || op.includes('recharge')) return false;
          if (op.includes('confirm') || op.includes('accept')) return true;
          return isConfirmText(t);
        });
        if (hit) return hit;
      }

      return null;
    };

    const tryFindRebet = () => {
      const exact = Array.from(document.querySelectorAll(
        'button[data-op="betslip-success-rebet"], [data-op="betslip-success-rebet"], button.rebet, button[class*="rebet" i], [data-cms-key="rebet"], .rebet-text, [data-op*="rebet" i]'
      )).find(b => isVis(b) && !isDepositElement(b) && !isNavOrFooter(b));
      if (exact) return exact;

      const dialogs = Array.from(document.querySelectorAll(
        '.es-dialog, .m-dialog, .af-dialog, .m-pop-box, .m-pop, .m-modal, [role="dialog"], [class*="dialog" i], [class*="modal" i], [class*="success" i]'
      )).filter(isVis);
      for (const d of dialogs) {
        const hit = Array.from(d.querySelectorAll(
          'button, [role="button"], a, div, span, .m-btn, .af-button, [class*="btn" i], [class*="rebet" i], [data-op*="rebet" i]'
        )).filter(b => isVis(b) && !isDepositElement(b) && !isNavOrFooter(b))
          .find(el => {
            const op = String(el.getAttribute?.('data-op') || '').toLowerCase();
            return op.includes('rebet') || isRebetText(norm(el));
          });
        if (hit) return hit;
      }

      const textHit = Array.from(document.querySelectorAll(
        '[data-op*="rebet" i], [data-test-id*="rebet" i], [class*="rebet" i], button, a, [role="button"], div, span, .m-btn, .af-button, .es-button, [class*="btn" i]'
      )).filter(b => isVis(b) && !isDepositElement(b) && !isNavOrFooter(b))
        .find(el => {
          const op = (el.getAttribute('data-op') || '').toLowerCase();
          return op.includes('rebet') || isRebetText(norm(el));
        });
      if (textHit) return textHit;

      return null;
    };

    const isSuccessModalOpen = () => {
      const modal = Array.from(document.querySelectorAll(
        '[data-op="betslip-success-rebet"], [data-op="betslip-success"], .m-betslip-success, .m-success-box, [class*="betslip-success" i]'
      )).find(isVis);
      return !!modal;
    };

    const setStakeValue = (val) => {
      if (!val) return;
      const vStr = String(val);
      const inputs = Array.from(document.querySelectorAll(
        'input[name*="stake" i], input[placeholder*="stake" i], input[class*="stake" i], .m-betslip input, [class*="betslip" i] input, input[type="tel"], input[type="number"]'
      )).filter(isVis);

      for (const inp of inputs) {
        if (inp.name === 'c2c-converter-input' || inp.closest('[data-op="c2c-converter-input"]')) continue;
        try {
          if (inp.readOnly) inp.removeAttribute('readonly');
          const proto = (inp.tagName === 'TEXTAREA') ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (setter) setter.call(inp, vStr);
          else inp.value = vStr;
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
          inp.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        } catch (_) {}
      }

      const customEls = Array.from(document.querySelectorAll(
        'span.m-keybord-input, span.m-keyboard-input, [data-op="betslip-keyboard-trigger"], [class*="keybord-input" i], [class*="keyboard-input" i], .m-betslip-stake span'
      )).filter(isVis);

      for (const el of customEls) {
        try {
          el.classList.remove('m-input--placeholder');
          el.textContent = vStr;
          el.innerText = vStr;

          const isFootball = /football\\.com/i.test(location.hostname || '');
          if (isFootball) {
            ${FOOTBALL_SYNC_STAKE_SNIPPET('vStr', 'el')}
          } else {
            let cur = el;
            while (cur && cur !== document.documentElement) {
              const comp = cur.__vueParentComponent || cur.__vnode?.component || cur._vnode?.component;
              if (comp) {
                try { comp.emit('input', vStr); } catch (_) {}
                try { comp.emit('update:modelValue', vStr); } catch (_) {}
                const proxy = comp.proxy || comp.ctx || comp.setupState;
                if (proxy) {
                  if (typeof proxy.changeSingleStake === 'function') {
                    try { proxy.changeSingleStake(vStr); } catch (_) {}
                  }
                  if (typeof proxy.changeMultipleStake === 'function') {
                    try { proxy.changeMultipleStake(vStr); } catch (_) {}
                  }
                  if (proxy.bet && proxy.bet.key && proxy.singleStake) {
                    try { proxy.singleStake[proxy.bet.key] = vStr; } catch (_) {}
                  }
                }
                if (comp.parent) {
                  const pProxy = comp.parent.proxy || comp.parent.ctx || comp.parent.setupState;
                  if (pProxy) {
                    if (typeof pProxy.changeSingleStake === 'function') {
                      try { pProxy.changeSingleStake(vStr); } catch (_) {}
                    }
                    if (pProxy.bet && pProxy.bet.key && pProxy.singleStake) {
                      try { pProxy.singleStake[pProxy.bet.key] = vStr; } catch (_) {}
                    }
                  }
                }
              }
              if (cur.__vue__) {
                const vm = cur.__vue__;
                if ('stake' in vm) vm.stake = vStr;
                if ('value' in vm) vm.value = vStr;
                if ('currentStake' in vm) vm.currentStake = vStr;
                if (typeof vm.$emit === 'function') {
                  vm.$emit('input', vStr);
                  vm.$emit('change', vStr);
                }
                if (vm.$store && typeof vm.$store.commit === 'function') {
                  try { vm.$store.commit('betslip/updateStake', vStr); } catch (_) {}
                  try { vm.$store.commit('betslip/setStake', vStr); } catch (_) {}
                  try { vm.$store.commit('setStake', vStr); } catch (_) {}
                }
                break;
              }
              cur = cur.parentElement;
            }

            const appEl = document.querySelector('#app');
            if (appEl && appEl.__vue_app__) {
              const store = appEl.__vue_app__.config?.globalProperties?.$store;
              if (store && store.state?.betslipStake?.singleStake) {
                for (const k of Object.keys(store.state.betslipStake.singleStake)) {
                  store.state.betslipStake.singleStake[k] = vStr;
                }
              }
            }
          }

          el.dispatchEvent(new Event('input', { bubbles: true }));
        } catch (_) {}
      }
    };

    const syncVisibleStakeToModel = () => {
      try {
        const findStake = (${FIND_STAKE_INPUT_JS});
        const el = findStake;
        if (!el) return;
        const raw = String(el.value !== undefined && el.value !== '' ? el.value : el.textContent || '').trim();
        if (!raw || /^min\b/i.test(raw) || /^stake$/i.test(raw) || /^enter/i.test(raw)) return;

        // Football.com Nuxt 3 / Pinia synchronization
        const isFootball = /football\\.com/i.test(location.hostname || '');
        if (isFootball) {
          ${FOOTBALL_SYNC_STAKE_SNIPPET('raw', 'el')}
          if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            if (el.value !== raw) {
              const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
              const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
              if (setter) setter.call(el, raw);
              else el.value = raw;
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
          return;
        }

        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          if (el.value !== raw) {
            const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
            if (setter) setter.call(el, raw);
            else el.value = raw;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
          return;
        }

        let cur = el;
        while (cur && cur !== document.documentElement) {
          const comp = cur.__vueParentComponent || cur.__vnode?.component || cur._vnode?.component;
          if (comp) {
            try { comp.emit('input', raw); } catch (_) {}
            try { comp.emit('update:modelValue', raw); } catch (_) {}
            const proxy = comp.proxy || comp.ctx || comp.setupState;
            if (proxy) {
              if (typeof proxy.changeSingleStake === 'function') {
                try { proxy.changeSingleStake(raw); } catch (_) {}
              }
              if (typeof proxy.changeMultipleStake === 'function') {
                try { proxy.changeMultipleStake(raw); } catch (_) {}
              }
              if (proxy.bet && proxy.bet.key && proxy.singleStake) {
                try { proxy.singleStake[proxy.bet.key] = raw; } catch (_) {}
              }
            }
            if (comp.parent) {
              const pProxy = comp.parent.proxy || comp.parent.ctx || comp.parent.setupState;
              if (pProxy) {
                if (typeof pProxy.changeSingleStake === 'function') {
                  try { pProxy.changeSingleStake(raw); } catch (_) {}
                }
                if (pProxy.bet && pProxy.bet.key && pProxy.singleStake) {
                  try { pProxy.singleStake[pProxy.bet.key] = raw; } catch (_) {}
                }
              }
            }
          }
          if (cur.__vue__) {
            const vm = cur.__vue__;
            if ('stake' in vm) vm.stake = raw;
            if ('value' in vm) vm.value = raw;
            if (typeof vm.$emit === 'function') vm.$emit('input', raw);
          }
          cur = cur.parentElement;
        }

        const appEl = document.querySelector('#app');
        if (appEl && appEl.__vue_app__) {
          const store = appEl.__vue_app__.config?.globalProperties?.$store;
          if (store && store.state?.betslipStake?.singleStake) {
            for (const k of Object.keys(store.state.betslipStake.singleStake)) {
              store.state.betslipStake.singleStake[k] = raw;
            }
          }
        }
      } catch (_) {}
    };

    // If a new stake was requested (e.g. +0.1 after 2 cycles), apply it immediately
    const stakeToSet = ${JSON.stringify(targetStake !== null && targetStake !== undefined ? String(targetStake) : null)};
    if (stakeToSet) {
      setStakeValue(stakeToSet);
      await wait(15);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 1: Wait for Place Bet button to be rendered and enabled
    // ─────────────────────────────────────────────────────────────────────────────
    let placeBtn = null;
    let immediateExpandTriggered = false;
    let immediateExpandSucceeded = false;

    try {
      const slipBarCycle = document.querySelector('.m-betslip-bar, [class*="betslip-bar" i], .m-slip-bar, [class*="slip-bar" i], [data-op="betslip-bar"]');
      const alreadyExpanded = isBetslipExpanded();
      const existingBtn = findPlaceBetBtn();
      logTrace('Cycle Step 1 Start. slipBar visible:', isVis(slipBarCycle), 'alreadyExpanded:', alreadyExpanded, 'existingBtn:', !!existingBtn);

      // FIX 1: Fire immediate expand the instant a collapsed slipBar is detected
      if (slipBarCycle && isVis(slipBarCycle) && !alreadyExpanded && !existingBtn) {
        const t0 = Date.now();
        logTrace('Triggering immediate expand on collapsed slipBar at t=0...');
        immediateExpandTriggered = true;
        ensureBetslipExpanded();
        // Guard: short timeout (up to 60ms) to verify expansion succeeded before loop begins
        for (let w = 0; w < 12; w++) {
          await wait(5);
          if (isBetslipExpanded() || findPlaceBetBtn()) {
            immediateExpandSucceeded = true;
            logTrace('Immediate expand succeeded in ' + (Date.now() - t0) + 'ms');
            break;
          }
        }
        if (!immediateExpandSucceeded) {
          logTrace('Immediate expand did not register within 60ms; fallback safety net will engage at pWait===125');
        }
      } else if (alreadyExpanded) {
        logTrace('Betslip already expanded -> no-op to prevent accidental re-collapse');
      }
    } catch (err) {
      logTrace('[PlaceBet:Error] Immediate expand block threw:', String(err));
    }

    for (let pWait = 0; pWait < 1500; pWait++) {
      if (window.__mfas_auto_rebet_stop) return { aborted: true, traceLogs };

      const locked = checkOddsLocked();
      if (locked) {
        logTrace('Step 1: checkOddsLocked failed:', locked.msg);
        return { oddsLocked: true, error: locked.msg, traceLogs };
      }

      const noBal = checkInsufficientBalance();
      if (noBal) {
        logTrace('Step 1: checkInsufficientBalance failed:', noBal.msg);
        return { insufficientBalance: true, error: noBal.msg, traceLogs };
      }

      // Safety net fallback: if immediate expand failed or was not triggered, original pWait === 125 fires
      if (pWait === 125 && !immediateExpandSucceeded) {
        try {
          logTrace('pWait 125: Fallback safety net ensureBetslipExpanded() invoked');
          ensureBetslipExpanded();
        } catch (err) {
          logTrace('[PlaceBet:Error] Fallback ensureBetslipExpanded failed:', String(err));
        }
      }

      placeBtn = findPlaceBetBtn();
      if (placeBtn) {
        logTrace('pWait ' + pWait + ': Found placeBtn in Cycle Step 1:', norm(placeBtn));
        break;
      }
      await wait(2);
    }

    if (!placeBtn) {
      const allBtns = Array.from(document.querySelectorAll('button, [role="button"], .m-btn, .place-bet')).filter(isVis).map(b => ({
        tag: b.tagName,
        cls: b.className?.slice(0, 40),
        txt: norm(b).slice(0, 30)
      }));
      logTrace('FAILED to locate placeBtn in cycle after 1500 iters. Visible buttons:', allBtns);
      const locked = checkOddsLocked();
      if (locked) return { oddsLocked: true, error: locked.msg, traceLogs };
      const noBal = checkInsufficientBalance();
      if (noBal) return { insufficientBalance: true, error: noBal.msg, traceLogs };
      return { placed: false, confirmed: false, error: 'timeout_waiting_for_place_btn', traceLogs };
    }

    // Ensure model is synchronized to visible stake right before clicking
    syncVisibleStakeToModel();

    // Click Place Bet!
    const initialTxt = norm(placeBtn);
    const wasAcceptChange = initialTxt.includes('accept change') || initialTxt.includes('save change') || initialTxt === 'accept';
    logTrace('Cycle Step 1: Clicking placeBtn. wasAcceptChange:', wasAcceptChange);
    const placeCoords = triggerClick(placeBtn);

    if (wasAcceptChange) {
      for (let ac = 0; ac < 150; ac++) {
        await wait(10);
        const nextPlace = findPlaceBetBtn();
        if (nextPlace && !norm(nextPlace).includes('accept')) {
          syncVisibleStakeToModel();
          logTrace('Cycle Step 1: Transitioned accept change -> clicking place button:', norm(nextPlace));
          triggerClick(nextPlace);
          placeBtn = nextPlace;
          break;
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 2: Wait for Confirm button or direct Success screen
    // ─────────────────────────────────────────────────────────────────────────────
    let confirmed = false;
    let cycleStep2Obs = null;
    logTrace('Cycle Step 2: Waiting for confirm or success screen...');

    // 1. Instant check at t=0
    if (isSuccessModalOpen() || tryFindRebet()) {
      logTrace('Cycle Step 2: Success modal / Rebet found immediately at t=0');
      confirmed = true;
    } else {
      const instantConfirm = findConfirmCandidate(placeBtn);
      if (instantConfirm) {
        logTrace('Cycle Step 2: Instant confirm found at t=0:', norm(instantConfirm));
        triggerClick(instantConfirm);
        confirmed = true;
      }
    }

    if (!confirmed) {
      try {
        cycleStep2Obs = new MutationObserver(() => {
          if (!confirmed) {
            if (isSuccessModalOpen() || tryFindRebet()) {
              confirmed = true;
            } else {
              const hit = findConfirmCandidate(placeBtn);
              if (hit) {
                logTrace('Cycle Step 2: MutationObserver caught confirm in microtask:', norm(hit));
                triggerClick(hit);
                confirmed = true;
              }
            }
          }
        });
        if (document.documentElement) {
          cycleStep2Obs.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'data-op']
          });
        }
      } catch (_) {}
    }

    try {
      for (let cWait = 0; cWait < 450; cWait++) {
        if (window.__mfas_auto_rebet_stop) return { aborted: true, traceLogs };

        if (confirmed || isSuccessModalOpen() || tryFindRebet()) {
          confirmed = true;
          break;
        }

        const confirmBtn = findConfirmCandidate(placeBtn);
        if (confirmBtn) {
          logTrace('Cycle Step 2: Confirm candidate found on cWait ' + cWait + ':', norm(confirmBtn));
          triggerClick(confirmBtn);
          confirmed = true;

          // Check secondary confirm (e.g. odds change prompt)
          for (let sub = 0; sub < 20; sub++) {
            await wait(10);
            const nextC = findConfirmCandidate(confirmBtn);
            if (nextC && nextC !== confirmBtn) {
              logTrace('Cycle Step 2: Secondary confirm found on sub-attempt ' + sub + ':', norm(nextC));
              triggerClick(nextC);
              break;
            }
          }
          break;
        }
        await wait(8);
      }
    } finally {
      if (cycleStep2Obs) {
        try { cycleStep2Obs.disconnect(); } catch (_) {}
      }
    }

    // If this is the final cycle of the attack (or single cycle), we are DONE once the bet is confirmed!
    // Do NOT click Rebet and do NOT wait for the betslip to clear.
    if (${isFinalCycle ? 'true' : 'false'}) {
      logTrace('Final cycle reached (bet confirmed). Skipping Rebet to complete cycle cleanly.');
      return { cycleCompleted: true, placed: true, confirmed: true, isFinalCycle: true, traceLogs };
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 3: Wait for "Bet Successful" modal & Click "Rebet"
    // ─────────────────────────────────────────────────────────────────────────────
    let rebetClicked = false;
    logTrace('Cycle Step 3: Pre-warming Rebet observer...');

    // 1. Immediate t=0 check
    const instantRebetBtn = tryFindRebet();
    if (instantRebetBtn) {
      logTrace('Cycle Step 3: Instant Rebet found at t=0:', norm(instantRebetBtn));
      triggerClick(instantRebetBtn);
      try { instantRebetBtn.click(); } catch (_) {}
      try { instantRebetBtn.click(); } catch (_) {}
      rebetClicked = true;
    }

    // 2. Pre-warmed MutationObserver (fires synchronously in DOM microtask <0.5ms the instant Vue renders the modal)
    let cycleStep3Obs = null;
    if (!rebetClicked) {
      try {
        cycleStep3Obs = new MutationObserver(() => {
          if (!rebetClicked) {
            const hit = tryFindRebet();
            if (hit) {
              logTrace('Cycle Step 3: Pre-warmed MutationObserver caught Rebet in microtask (<0.5ms):', norm(hit));
              rebetClicked = true;
              triggerClick(hit);
              try { hit.click(); } catch (_) {}
              try { hit.click(); } catch (_) {}
            }
          }
        });
        if (document.documentElement) {
          cycleStep3Obs.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'data-op']
          });
        }
      } catch (_) {}
    }

    try {
      for (let rWait = 0; rWait < 500; rWait++) {
        if (window.__mfas_auto_rebet_stop) return { aborted: true, traceLogs };
        if (rebetClicked) break;

        const rebetBtn = tryFindRebet();
        if (rebetBtn) {
          logTrace('Cycle Step 3: Rebet button found on rWait ' + rWait + ':', norm(rebetBtn));
          triggerClick(rebetBtn);
          try { rebetBtn.click(); } catch (_) {}
          try { rebetBtn.click(); } catch (_) {}
          rebetClicked = true;
          break;
        }

        // If preload MutationObserver already clicked Rebet in <0.1ms (only valid if confirmed!):
        if (confirmed && rWait > 4 && !isSuccessModalOpen()) {
          const slipRoot = document.querySelector('.m-bet-slip, .m-betslip, [class*="betslip" i], [class*="bet-slip" i]');
          if (slipRoot && isVis(slipRoot)) {
            logTrace('Cycle Step 3: Preload observer closed modal, slip visible');
            rebetClicked = true;
            break;
          }
        }

        await wait(8);
      }
    } finally {
      if (cycleStep3Obs) {
        try { cycleStep3Obs.disconnect(); } catch (_) {}
      }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 4: As soon as Rebet is clicked, wait for Success Modal to clear and
    // Betslip Place Bet button to become ENABLED again (<5-10ms fast firing!)
    // ─────────────────────────────────────────────────────────────────────────────
    let slipReady = false;
    logTrace('Cycle Step 4: Waiting for betslip to be ready for next cycle...');
    for (let nextWait = 0; nextWait < 500; nextWait++) {
      if (window.__mfas_auto_rebet_stop) return { aborted: true, traceLogs };

      const locked = checkOddsLocked();
      if (locked) return { oddsLocked: true, error: locked.msg, traceLogs };

      const noBal = checkInsufficientBalance();
      if (noBal) return { insufficientBalance: true, error: noBal.msg, traceLogs };

      // Success modal still lingering? Click rebet again to dismiss
      if (nextWait % 15 === 0 && isSuccessModalOpen()) {
        const rebetBtn = tryFindRebet();
        if (rebetBtn) triggerClick(rebetBtn);
      }

      const nextPlace = findPlaceBetBtn();
      if (nextPlace && !isSuccessModalOpen()) {
        logTrace('Cycle Step 4: Next place button ready on nextWait ' + nextWait);
        slipReady = true;
        break;
      }
      await wait(8);
    }

    if (!confirmed && !isSuccessModalOpen()) {
      logTrace('[PlaceBet:Warn] Cycle finished without confirm or success detection');
      return {
        ok: false,
        cycleCompleted: false,
        placed: !!placeCoords,
        confirmed: false,
        rebetClicked,
        slipReady,
        error: 'confirm_not_detected',
        traceLogs
      };
    }

    return {
      ok: true,
      cycleCompleted: true,
      placed: true,
      confirmed: true,
      rebetClicked,
      slipReady,
      stake: stakeToSet,
      traceLogs
    };
  })()
`;

const NAV_OPEN_BETS_JS = `
  (() => {
    const norm = (el) => (el?.innerText || el?.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase();
    const isVis = (el) => {
      if (!el || el.disabled) return false;
      const r = el.getBoundingClientRect();
      const st = window.getComputedStyle(el);
      return r.width > 8 && r.height > 8 && st.visibility !== 'hidden' && st.display !== 'none' && st.pointerEvents !== 'none';
    };

    const route = ((location.pathname || '') + (location.hash || '')).toLowerCase();
    const onOpenBetsRoute = /\\/open_bets\\b/.test(route);
    const bodyHead = (document.body?.innerText || '').slice(0, 800).toLowerCase();
    const onHelpArticle = bodyHead.includes('what is cashout') && bodyHead.includes('how to cashout');

    if (onOpenBetsRoute && !onHelpArticle) {
      const tabs = Array.from(document.querySelectorAll('.m-sportBets li, .m-sportBets [role="tab"], .m-sportBets button, .m-sportBets div, [class*="bet-tab" i] *, [class*="nav-tab" i] *, [role="tab"], [data-op*="tab" i]'))
        .filter((el) => {
          if (!isVis(el) || el.closest('.m-bottom-fixed, [class*="bottom-fixed" i]')) return false;
          if (el.querySelector('li, [role="tab"], button')) return false;
          const t = norm(el);
          return /^open\\s*bets?(?:\\s*\\(?\\d+\\)?)?$/.test(t);
        });
      if (tabs.length > 0) {
        const tEl = tabs[0];
        const cls = String(tEl.className || '') + ' ' + String(tEl.parentElement?.className || '');
        const active = /active|selected|cur/i.test(cls) || tEl.getAttribute('aria-selected') === 'true';
        if (!active) {
          try { tEl.click(); } catch (_) {}
          return { status: 'navigated', via: 'inner-tab', href: location.href };
        }
      }
      return { status: 'ready', via: 'already-open-bets', href: location.href };
    }

    const navContainers = Array.from(document.querySelectorAll('.m-bottom-fixed, [class*="bottom-fixed" i], [class*="bottom-nav" i]'));
    const navPools = navContainers.length > 0 ? navContainers : [document];
    const navLabels = navPools.flatMap((scope) =>
      Array.from(scope.querySelectorAll('span.label, .m-btn-button, a, button, [role="tab"], [role="button"], li, div')).filter((el) => {
        if (!isVis(el)) return false;
        const t = norm(el);
        return /^open\\s*bets?(?:\\s*\\(?\\d+\\)?)?$/.test(t);
      })
    );

    if (navLabels.length > 0) {
      const labelEl = navLabels[navLabels.length - 1];
      const target = labelEl.closest('.m-btn-button, a, button, [role="tab"], [role="button"]') || labelEl;
      const tr = target.getBoundingClientRect();
      const tx = Math.max(1, Math.round(tr.left + tr.width / 2));
      const ty = Math.max(1, Math.round(tr.top + tr.height / 2));
      const topEl = typeof document.elementFromPoint === 'function' ? document.elementFromPoint(tx, ty) : target;
      const clickable = !topEl || topEl === target || target.contains(topEl) || topEl.contains(target);
      if (clickable) {
        try { target.click(); } catch (_) {}
        return { status: 'navigated', via: 'bottom-nav', href: location.href };
      }
    }

    const isFootball = /football\\.com/i.test(location.hostname || '');
    const isSporty = /sportybet\\.com/i.test(location.hostname || '');
    const mCountry = (location.pathname || '').match(/^\\/(ng|gh)(\\/|$)/i);
    const country = mCountry ? mCountry[1].toLowerCase() : null;
    return {
      status: (isSporty || isFootball) ? 'need-url' : 'unsupported',
      site: isFootball ? 'football' : (isSporty ? 'sportybet' : null),
      country,
      href: location.href,
    };
  })()
`;

const CASHOUT_CONFIRM_ROOT_SEL = '.m-cashout, .m-pop, .m-pop-box, .af-dialog, .m-dialog, .es-dialog, .drawer__content, .bottom-panel-drawer, [role="dialog"], [data-op*="cashout" i], [data-op*="confirm" i], [class*="cashout-dialog" i], [class*="cashout-confirm" i], [class*="cashout-pop" i], [class*="confirm" i], [class*="dialog" i], [class*="modal" i], [class*="popup" i], [class*="sheet" i], [class*="drawer" i]';

const CASHOUT_DOM_HELPERS = `
  const norm = (el) => (el?.innerText || el?.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase();
  const isVis = (el) => {
    if (!el || el.disabled) return false;
    if (el.closest?.('[disabled], [aria-disabled="true"], .is-disabled, .disabled, .af-button--disabled, .m-btn--disabled')) return false;
    const r = el.getBoundingClientRect();
    const st = window.getComputedStyle(el);
    return r.width > 20 && r.height > 16 && st.visibility !== 'hidden' && st.display !== 'none' && st.pointerEvents !== 'none' && parseFloat(st.opacity || '1') > 0.05;
  };
  const isRootNotHidden = (el) => {
    if (!el) return false;
    const st = window.getComputedStyle(el);
    return st.visibility !== 'hidden' && st.display !== 'none' && parseFloat(st.opacity || '1') > 0.05;
  };
  const isTopMost = (el) => {
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth || document.documentElement?.clientWidth || 1280;
    const vh = window.innerHeight || document.documentElement?.clientHeight || 800;
    const cx = Math.max(1, Math.min(vw - 2, Math.round(r.left + r.width / 2)));
    const cy = Math.max(1, Math.min(vh - 2, Math.round(r.top + r.height / 2)));
    if (typeof document.elementFromPoint !== 'function') return { top: true, x: cx, y: cy };
    const hit = document.elementFromPoint(cx, cy);
    const top = !hit || hit === el || el.contains(hit) || hit.contains(el);
    return { top, x: cx, y: cy };
  };
  const dispatchCashoutClick = (el) => {
    if (!el) return null;
    try { el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }); } catch (_) {
      try { el.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (_) {}
    }
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth || document.documentElement?.clientWidth || 1280;
    const vh = window.innerHeight || document.documentElement?.clientHeight || 800;
    const cx = Math.max(1, Math.min(vw - 2, Math.round(r.left + r.width / 2)));
    const cy = Math.max(1, Math.min(vh - 2, Math.round(r.top + r.height / 2)));
    const evInit = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, button: 0, buttons: 1 };
    const tapHost = el.matches?.('[data-op], .af-button, .m-btn, .es-button, button, [role="button"]')
      ? el
      : (el.closest?.('[data-op], .af-button, .m-btn, .es-button, button, [role="button"], [class*="confirm" i], [class*="cashout" i]') || el);
    const safeTap = tapHost?.__safe_tap_state__ || el?.__safe_tap_state__;
    if (safeTap && safeTap.config && typeof safeTap.config.onTap === 'function') {
      try { safeTap.config.onTap(new MouseEvent('click', evInit)); } catch (_) {}
    }
    try {
      el.dispatchEvent(new PointerEvent('pointerdown', { ...evInit, pointerType: 'touch', isPrimary: true }));
      el.dispatchEvent(new PointerEvent('pointerup', { ...evInit, pointerType: 'touch', isPrimary: true }));
    } catch (_) {}
    try {
      el.dispatchEvent(new MouseEvent('mousedown', evInit));
      el.dispatchEvent(new MouseEvent('mouseup', evInit));
    } catch (_) {}
    try { el.click(); } catch (_) {}
    return { x: cx, y: cy };
  };
  const CONFIRM_BTN_RE = /^confirm(?:\\s+(?:cash\\s*out|cashout|now|(?:[a-z]{1,4}|₦|gh₵|₵|\\$)?\\s*[\\d,.]+))?$/i;
  const BAD_BTN_WORDS_RE = /\\b(cancel|close|back|partial|auto[\\s-]*cash|rule|how to|what is|learn|no|deposit|recharge|log\\s*in|sign\\s*in|register|open bets|history|detail|terms|faq|guide|unavailable|suspend(?:ed|ing)?|locked|disabl(?:ed|ing))\\b/i;
  const BETSLIP_ANCESTOR_SEL = '[data-op*="betslip" i], .m-betslip, .m-fast-betslip, .m-bet-slip, #betslip';
  const BTN_NORMALIZE_SEL = 'button, [role="button"], .m-btn, .af-button, .es-button, [class*="btn" i], [class*="button" i], [data-op*="confirm" i], [data-op*="cashout" i], [class*="confirm" i]';
  const normalizeClickable = (el) => (el?.matches?.(BTN_NORMALIZE_SEL) ? el : (el?.closest?.(BTN_NORMALIZE_SEL) || el));

  const isConfirmCandidate = (cb, allowCashoutLabelInModal = false) => {
    if (!cb || !isVis(cb)) return false;
    if (cb.closest?.(BETSLIP_ANCESTOR_SEL)) return false;
    if (cb.closest?.('header, nav, .m-openbet-header, [class*="openbet-header" i], [class*="history" i], [class*="help" i], [class*="faq" i], [class*="guide" i]')) return false;
    if (cb.tagName !== 'BUTTON' && cb.querySelector?.('button, [role="button"]')) return false;
    const ct = norm(cb);
    if (!ct || ct.length > 48 || ct.includes('?')) return false;
    if (BAD_BTN_WORDS_RE.test(ct)) return false;
    if (CONFIRM_BTN_RE.test(ct) || ct.startsWith('confirm cash')) return true;
    if (allowCashoutLabelInModal && (ct === 'cashout' || ct === 'cash out' || /^cash\\s*out\\b/i.test(ct) || /^cashout\\b/i.test(ct))) {
      return isTopMost(cb).top;
    }
    return false;
  };

  const hasModalCues = (root) => {
    if (!root) return false;
    const cls = String(root.className || '').toLowerCase();
    const role = String(root.getAttribute?.('role') || '').toLowerCase();
    if (role === 'dialog' || /dialog|modal|popup|drawer|sheet|m-pop|m-cashout/.test(cls)) return true;
    const txt = norm(root);
    if (txt.includes('full cashout') || txt.includes('cashout now') || txt.includes('confirm')) return true;
    return false;
  };

  const pickBestButton = (list) => {
    if (!list || list.length === 0) return null;
    const uniq = Array.from(new Set(list));
    const topMatches = uniq.filter((b) => isTopMost(b).top);
    const pool = topMatches.length > 0 ? topMatches : uniq;
    return pool[pool.length - 1];
  };

  const findConfirmCashoutBtn = () => {
    // 1. Exact SportyBet Open-Bets cashout confirm button first (same pattern as betslip-confirm lookup)
    const exactConfirm = Array.from(document.querySelectorAll(
      'button[data-op="open_bets__cashout_confirm"], [data-op="open_bets__cashout_confirm"], button[data-op="cashout-confirm"], [data-op*="cashout_confirm" i], [data-op*="cashout-confirm" i]'
    )).filter((cb) => isVis(cb) && !cb.closest?.(BETSLIP_ANCESTOR_SEL) && !BAD_BTN_WORDS_RE.test(norm(cb)));
    if (exactConfirm.length > 0) return pickBestButton(exactConfirm);

    // 2. Global interactive search for explicit "Confirm ..." buttons ("Confirm NGN 9.77", "Confirm GHS 0.02", "Confirm Cashout")
    const primaryMatches = [];
    const globalEls = Array.from(document.querySelectorAll(
      'button, [role="button"], .m-btn, .af-button, .es-button, [class*="btn" i], [class*="button" i], [data-op*="confirm" i], [data-op*="cashout" i], [class*="confirm" i]'
    ));
    for (const rawEl of globalEls) {
      const cb = normalizeClickable(rawEl);
      if (isConfirmCandidate(cb, false)) primaryMatches.push(cb);
    }
    if (primaryMatches.length > 0) return pickBestButton(primaryMatches);

    // 3. Fallback leaf scan if CTA uses custom non-btn classes
    const leafMatches = [];
    for (const rawEl of Array.from(document.querySelectorAll('div, span, a'))) {
      if (rawEl.children.length > 3) continue;
      const cb = normalizeClickable(rawEl);
      if (isConfirmCandidate(cb, false)) leafMatches.push(cb);
    }
    if (leafMatches.length > 0) return pickBestButton(leafMatches);

    // 4. Modal-scoped fallback for themes where Confirm sheet button repeats "Cashout"
    const roots = Array.from(document.querySelectorAll(${JSON.stringify(CASHOUT_CONFIRM_ROOT_SEL)})).filter(isRootNotHidden);
    for (const root of roots) {
      if (root.closest?.(BETSLIP_ANCESTOR_SEL) || !hasModalCues(root)) continue;
      const modalBtns = [];
      const selfCand = normalizeClickable(root);
      if (isConfirmCandidate(selfCand, true)) modalBtns.push(selfCand);
      for (const rawEl of Array.from(root.querySelectorAll(
        'button, [role="button"], .m-btn, .af-button, .es-button, [class*="btn" i], [class*="button" i], [data-op*="confirm" i], [data-op*="cashout" i], [class*="confirm" i]'
      ))) {
        const cb = normalizeClickable(rawEl);
        if (isConfirmCandidate(cb, true)) modalBtns.push(cb);
      }
      if (modalBtns.length > 0) return pickBestButton(modalBtns);
    }
    return null;
  };

  const hasOpenModalOverlay = () => {
    return Array.from(document.querySelectorAll('.m-pop, .af-dialog, .m-dialog, .es-dialog, [role="dialog"], [class*="mask" i], [class*="overlay" i], [class*="backdrop" i]'))
      .some((el) => {
        if (!isRootNotHidden(el)) return false;
        const r = el.getBoundingClientRect();
        return r.width > 120 && r.height > 120;
      });
  };

  const findTicketCashoutBtns = () => {
    const EXCLUDED_ANCESTORS = [
      'header', 'nav', 'footer',
      '.m-openbet-header', '[class*="openbet-header" i]', '[class*="open-bets-header" i]', '[class*="header-wrap" i]',
      '.m-bottom-fixed', '[class*="bottom-fixed" i]',
      '[class*="help" i]', '[class*="guide" i]', '[class*="faq" i]', '[class*="rule" i]',
      '[class*="auto-cashout" i]', '[class*="partial" i]', '[class*="history" i]',
      '[data-op*="confirm" i]',
      BETSLIP_ANCESTOR_SEL
    ].join(', ');
    const isTicketCashoutText = (t) => {
      if (!t || t.length > 48 || t.includes('?')) return false;
      if (BAD_BTN_WORDS_RE.test(t) || CONFIRM_BTN_RE.test(t)) return false;
      return t === 'cashout' || t === 'cash out' || /^cash\\s*out\\b/i.test(t) || /^cashout\\b/i.test(t);
    };

    // 1. Exact SportyBet ticket Cashout button across document (never restricted by a single header querySelector!)
    const exactTicketBtns = Array.from(document.querySelectorAll(
      'button[data-op="openbet__cashout_btn"], [data-op="openbet__cashout_btn"], button.m-btn--cashout, [data-op*="cashout_btn" i]'
    )).filter((el) => {
      if (!isVis(el) || el.closest(EXCLUDED_ANCESTORS)) return false;
      return !BAD_BTN_WORDS_RE.test(norm(el));
    });
    if (exactTicketBtns.length > 0) {
      const topExact = exactTicketBtns.filter((b) => isTopMost(b).top);
      return topExact.length > 0 ? topExact : exactTicketBtns;
    }

    // 2. Broad fallback across document for Football.com / alternate bookmaker markup
    const rawCandidates = Array.from(document.querySelectorAll(
      'button, [role="button"], .m-btn, .af-button, .es-button, [class*="btn" i], [class*="button" i], [data-op*="cashout" i], [class*="cashout" i], [class*="cash-out" i]'
    ));
    const hits = [];
    for (const rawEl of rawCandidates) {
      const el = normalizeClickable(rawEl);
      if (!el || !isVis(el)) continue;
      if (el.tagName === 'A' && el.hasAttribute('href')) continue;
      if (el.closest('a[href]')) continue;
      if (el.closest(EXCLUDED_ANCESTORS)) continue;
      if (el.tagName !== 'BUTTON' && el.querySelector('button, [role="button"]')) continue;
      if (!isTicketCashoutText(norm(el))) continue;
      if (!hits.includes(el)) hits.push(el);
    }
    const topHits = hits.filter((b) => isTopMost(b).top);
    return topHits.length > 0 ? topHits : hits;
  };
`;

const INSPECT_OPEN_BETS_STATE_JS = `
  (() => {
    ${CASHOUT_DOM_HELPERS}
    const confirmBtn = findConfirmCashoutBtn();
    if (confirmBtn) return { state: 'confirm-open', href: location.href, label: norm(confirmBtn) };

    const ticketBtns = findTicketCashoutBtns();
    if (ticketBtns.length > 0) return { state: 'has-tickets', count: ticketBtns.length, href: location.href };

    const bodyTxt = (document.body?.innerText || '').replace(/\\s+/g, ' ').trim().toLowerCase();
    if (/\\b(please\\s+log\\s*in|log\\s*in\\s+to\\s+view|sign\\s*in\\s+to\\s+view)\\b/i.test(bodyTxt)) {
      return { state: 'logged-out', href: location.href };
    }
    const hasSpinner = Array.from(document.querySelectorAll('[class*="loading" i], [class*="spinner" i], [class*="skeleton" i]'))
      .some((el) => isRootNotHidden(el) && el.getBoundingClientRect().height > 8);
    if (hasSpinner) {
      return { state: 'loading', href: location.href };
    }
    const hasEmptyNode = Array.from(document.querySelectorAll('.no-data, .m-empty, [class*="empty" i], [class*="no-bet" i], [class*="no-data" i]'))
      .some((el) => isRootNotHidden(el) && el.getBoundingClientRect().height > 12);
    if (hasEmptyNode || /\\b(no\\s+bets\\??\\s+no\\s+problem|no\\s+open\\s+bets?|no\\s+cashout\\s+available|no\\s+records?|no\\s+tickets?)\\b/i.test(bodyTxt)) {
      return { state: 'empty', href: location.href };
    }
    return { state: 'loading', href: location.href };
  })()
`;

const PREPARE_CASHOUT_CLICK_JS = `
  (async () => {
    ${CASHOUT_DOM_HELPERS}
    const confirmBtn = findConfirmCashoutBtn();
    if (confirmBtn) {
      const r = confirmBtn.getBoundingClientRect();
      return { mode: 'confirm-only', confirmReady: true, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), label: norm(confirmBtn) };
    }

    const candidates = findTicketCashoutBtns();
    if (candidates.length === 0) return { mode: 'none' };

    const btn = candidates[0];
    const label = norm(btn);
    const coords = dispatchCashoutClick(btn);

    // Same fast MutationObserver confirmation wait used in SINGLE_BET_PLACE_ONLY_JS
    const immediateConfirm = findConfirmCashoutBtn();
    if (immediateConfirm) {
      const cr = immediateConfirm.getBoundingClientRect();
      return {
        mode: 'clicked-ticket',
        label,
        x: coords ? coords.x : 0,
        y: coords ? coords.y : 0,
        confirmReady: true,
        confirmLabel: norm(immediateConfirm),
        confirmX: Math.round(cr.left + cr.width / 2),
        confirmY: Math.round(cr.top + cr.height / 2),
      };
    }

    const awaitedConfirm = await new Promise((resolve) => {
      let done = false;
      let obs = null;
      let timer = null;
      const finish = (cb) => {
        if (done) return;
        done = true;
        if (obs) try { obs.disconnect(); } catch (_) {}
        if (timer) clearTimeout(timer);
        resolve(cb || null);
      };
      const check = () => {
        const cb = findConfirmCashoutBtn();
        if (cb) finish(cb);
      };
      try {
        obs = new MutationObserver(check);
        if (document.documentElement) {
          obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'data-op'] });
        }
      } catch (_) {}
      timer = setTimeout(() => finish(findConfirmCashoutBtn()), 350);
    });

    if (awaitedConfirm) {
      const cr = awaitedConfirm.getBoundingClientRect();
      return {
        mode: 'clicked-ticket',
        label,
        x: coords ? coords.x : 0,
        y: coords ? coords.y : 0,
        confirmReady: true,
        confirmLabel: norm(awaitedConfirm),
        confirmX: Math.round(cr.left + cr.width / 2),
        confirmY: Math.round(cr.top + cr.height / 2),
      };
    }

    return {
      mode: 'clicked-ticket',
      label,
      x: coords ? coords.x : 0,
      y: coords ? coords.y : 0,
      confirmReady: false,
    };
  })()
`;

const FIND_CASHOUT_CONFIRM_JS = `
  (() => {
    ${CASHOUT_DOM_HELPERS}
    const cb = findConfirmCashoutBtn();
    if (cb) {
      try { cb.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }); } catch (_) {
        try { cb.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (_) {}
      }
      const r = cb.getBoundingClientRect();
      return {
        found: true,
        clickNow: true,
        overlayOpen: true,
        label: norm(cb),
        x: Math.round(r.left + r.width / 2),
        y: Math.round(r.top + r.height / 2),
      };
    }
    return { found: false, overlayOpen: hasOpenModalOverlay() };
  })()
`;

const CLICK_CASHOUT_CONFIRM_JS = `
  (async () => {
    ${CASHOUT_DOM_HELPERS}
    const cb = findConfirmCashoutBtn();
    if (!cb) return { clicked: false, dismissed: false };

    const label = norm(cb);
    const coords = dispatchCashoutClick(cb);

    // Same pattern as SINGLE_BET_CONFIRM_ONLY_JS: handle rapid confirm re-render + MutationObserver dismissal wait
    for (let sub = 0; sub < 8; sub++) {
      await new Promise((r) => setTimeout(r, 12));
      const nextC = findConfirmCashoutBtn();
      if (nextC && nextC !== cb) {
        dispatchCashoutClick(nextC);
        break;
      }
    }

    if (!findConfirmCashoutBtn()) {
      return {
        clicked: true,
        dismissed: true,
        label,
        x: coords ? coords.x : 0,
        y: coords ? coords.y : 0,
      };
    }

    const dismissed = await new Promise((resolve) => {
      let done = false;
      let obs = null;
      let timer = null;
      const finish = (ok) => {
        if (done) return;
        done = true;
        if (obs) try { obs.disconnect(); } catch (_) {}
        if (timer) clearTimeout(timer);
        resolve(!!ok);
      };
      const check = () => {
        if (!findConfirmCashoutBtn()) finish(true);
      };
      try {
        obs = new MutationObserver(check);
        if (document.documentElement) {
          obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'data-op'] });
        }
      } catch (_) {}
      timer = setTimeout(() => finish(!findConfirmCashoutBtn()), 380);
    });

    return {
      clicked: true,
      dismissed,
      label,
      x: coords ? coords.x : 0,
      y: coords ? coords.y : 0,
    };
  })()
`;

function loginCode(phone, password) {
  return `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const isVis = (el) => {
        if (!el) return false;
        const st = window.getComputedStyle(el);
        if (st.visibility === 'hidden' || st.display === 'none') return false;
        const r = el.getBoundingClientRect();
        if (window.innerWidth <= 1 || window.innerHeight <= 1) return true;
        return r.width > 0 && r.height > 0;
      };
      const isNotConverter = (el) => {
        if (!el) return false;
        const name = String(el.name || '').toLowerCase();
        const ph = String(el.placeholder || '').toLowerCase();
        return !name.includes('c2c-converter') && !ph.includes('booking') && !el.closest('[data-op="c2c-converter-input"]');
      };
      const fill = (el, val) => {
        if (!el) return false;
        try { el.focus(); } catch (_) {}
        if (el.readOnly) try { el.removeAttribute('readonly'); } catch(_){}
        const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const desc = Object.getOwnPropertyDescriptor(proto, 'value');
        if (desc && desc.set) desc.set.call(el, val); else el.value = val;
        el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: val }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      };

      const findPhone = () => Array.from(document.querySelectorAll(
        'input[type="tel"], input[name="phone"], input[name="username"], input[placeholder*="Mobile" i], input[placeholder*="Phone" i], input[placeholder*="Number" i]'
      )).find((el) => isVis(el) && isNotConverter(el));

      const findPass = () => Array.from(document.querySelectorAll(
        'input[type="password"], input[name="password"], input[placeholder*="Password" i]'
      )).find(isVis);

      // Check if user is ALREADY LOGGED IN
      // Strict check: ONLY considered logged in if an actual monetary balance is rendered AND no phone input exists AND no login button exists
      const balanceEl = Array.from(document.querySelectorAll(
        '.m-balance-val, .m-balance-num, [data-op="header-balance"], .header-balance, .af-balance, .balance-num, [data-op="user-balance"]'
      )).find(isVis);
      const hasLoginBtn = Array.from(document.querySelectorAll('.m-login-not, [data-op="nav-login"], .m-btn-login')).some(isVis);
      if (balanceEl && !findPhone() && !hasLoginBtn) {
        return { ok: true, alreadyLoggedIn: true, reason: 'Already logged in' };
      }

      // 1. Wait for inputs to mount (up to 6.5s)
      let phoneEl = null;
      let passEl = null;

      for (let attempt = 0; attempt < 45; attempt++) {
        phoneEl = findPhone();
        passEl = findPass();
        if (phoneEl && passEl) break;

        // Trigger login modal/route every few attempts until inputs appear
        if (attempt === 0 || attempt === 1 || attempt % 4 === 0) {
          if (typeof window.login !== 'undefined' && typeof window.login.showType === 'function') {
            try { window.login.showType('login'); } catch (_) {}
          } else if (typeof window.login !== 'undefined' && typeof window.login.show === 'function') {
            try { window.login.show(); } catch (_) {}
          }

          const navLogin = document.querySelector('[data-op="nav-login"], a[href*="login"], .m-btn-login, .m-btn--login, .m-nav-login, [data-cms-key="login"]')
            || Array.from(document.querySelectorAll('a, button, [role="button"], div, span')).find(b => {
                 const t = (b.textContent || '').trim().toLowerCase();
                 return t === 'log in' || t === 'login';
               });
          if (navLogin && isVis(navLogin)) {
            try { navLogin.click(); } catch (_) {}
          } else if (!location.hash.includes('login') && location.hostname.includes('sportybet')) {
            try { location.hash = '#login'; } catch (_) {}
          }
        }
        await sleep(140);
      }

      if (!phoneEl) phoneEl = Array.from(document.querySelectorAll('input[type="text"]')).find((el) => isVis(el) && isNotConverter(el));

      if (!phoneEl || !passEl) {
        return { ok: false, reason: 'Login inputs not found after opening login page' };
      }

      fill(phoneEl, ${JSON.stringify(phone)});
      await sleep(100);
      fill(passEl, ${JSON.stringify(password)});
      await sleep(150);

      const form = phoneEl.closest('form') || phoneEl.closest('.m-login, [role="dialog"], .drawer__content') || document;
      let sub = Array.from(form.querySelectorAll('button[data-op="login-btn"], [data-op="login-btn"], button[type="submit"], .m-btn-login, button.login-btn')).find(isVis);
      if (!sub) {
        const cands = Array.from(form.querySelectorAll('button, .btn, [role="button"], a')).filter(e => {
          if (!isVis(e)) return false;
          const t = (e.textContent || '').trim().toLowerCase();
          return t === 'log in' || t === 'login' || t === 'submit';
        });
        if (cands.length > 0) sub = cands[cands.length - 1];
      }

      if (sub) {
        sub.click();
        await sleep(500);
        return { ok: true, submitted: true };
      }
      return { ok: true, filled: true, reason: 'Filled – click Log In manually.' };
    })()
  `;
}

// ─── Ultra-Fast Millisecond Direct Stake Synchronizer ───────────────────────
// Injects the stake directly into the DOM and Vue state across panes WITHOUT
// opening or manually clicking through the mobile keypad!
const FAST_SET_STAKE_JS = (val) => `
  (() => {
    const vStr = ${JSON.stringify(String(val))};
    if (!vStr) return false;

    const confirmOpen = ${HAS_CONFIRM_OPEN_EXPR};
    const isVis = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
    };

    let modelVerified = false;

    // 1. Direct standard or hidden <input> / <textarea>
    const inputs = Array.from(document.querySelectorAll(
      'input[name*="stake" i], input[placeholder*="stake" i], input[class*="stake" i], .m-betslip input, [class*="betslip" i] input, input[type="tel"], input[type="number"]'
    )).filter((inp) => {
      if (inp.type === 'hidden' || inp.type === 'password' || inp.type === 'checkbox' || inp.type === 'radio') return false;
      return isVis(inp) || (confirmOpen && !!inp.closest('.m-betslip, .m-fast-betslip, [class*="betslip" i], [data-op*="betslip" i], [name*="stake" i]'));
    });

    for (const inp of inputs) {
      if (inp.name === 'c2c-converter-input' || inp.closest('[data-op="c2c-converter-input"]')) continue;
      try {
        if (inp.readOnly) inp.removeAttribute('readonly');
        const proto = (inp.tagName === 'TEXTAREA') ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (setter) setter.call(inp, vStr);
        else inp.value = vStr;
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        if (!confirmOpen) {
          inp.dispatchEvent(new Event('change', { bubbles: true }));
          inp.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        }
        if (inp.value === vStr) modelVerified = true;
      } catch (_) {}
    }

    // 2. Mobile custom display elements (SportyBet span.m-keybord-input & Football.com)
    const customEls = Array.from(document.querySelectorAll(
      'span.m-keybord-input, span.m-keyboard-input, [data-op="betslip-keyboard-trigger"], [class*="keybord-input" i], [class*="keyboard-input" i], .m-betslip-stake span'
    )).filter((el) => isVis(el) || confirmOpen);

    for (const el of customEls) {
      try {
        el.classList.remove('m-input--placeholder');
        el.textContent = vStr;
        el.innerText = vStr;

        const isFootball = /football\\.com/i.test(location.hostname || '');
        if (isFootball) {
          ${FOOTBALL_SYNC_STAKE_SNIPPET('vStr', 'el')}
          modelVerified = true;
        } else {
          let directStateUpdated = false;
          // Vue 3 global store commit first (safe direct reactive state update without UI-reset handlers)
          const appEl = document.querySelector('#app');
          if (appEl && appEl.__vue_app__) {
            const globalStore = appEl.__vue_app__.config?.globalProperties?.$store;
            if (globalStore) {
              try {
                if (globalStore.state?.betslipStake?.singleStake) {
                  for (const k of Object.keys(globalStore.state.betslipStake.singleStake)) {
                    globalStore.state.betslipStake.singleStake[k] = vStr;
                    directStateUpdated = true;
                    modelVerified = true;
                  }
                }
                if (globalStore.state?.betslipStake && 'multipleStake' in globalStore.state.betslipStake) {
                  globalStore.state.betslipStake.multipleStake = vStr;
                  directStateUpdated = true;
                  modelVerified = true;
                }
              } catch (_) {}
            }
          }

          // Traverse Vue 2 and Vue 3 component hierarchy
          let cur = el;
          while (cur && cur !== document.documentElement) {
            // Vue 3 component inspection (__vueParentComponent or __vnode.component)
            const comp = cur.__vueParentComponent || cur.__vnode?.component || cur._vnode?.component;
            if (comp) {
              try { comp.emit('input', vStr); } catch (_) {}
              try { comp.emit('update:modelValue', vStr); } catch (_) {}
              if (!confirmOpen) {
                try { comp.emit('change', vStr); } catch (_) {}
              }

              const proxy = comp.proxy || comp.ctx || comp.setupState;
              if (proxy) {
                if (proxy.bet && proxy.bet.key && proxy.singleStake) {
                  try { proxy.singleStake[proxy.bet.key] = vStr; directStateUpdated = true; modelVerified = true; } catch (_) {}
                }
                if (!confirmOpen || !directStateUpdated) {
                  if (typeof proxy.changeSingleStake === 'function') {
                    try { proxy.changeSingleStake(vStr); modelVerified = true; } catch (_) {}
                  }
                  if (typeof proxy.changeMultipleStake === 'function') {
                    try { proxy.changeMultipleStake(vStr); modelVerified = true; } catch (_) {}
                  }
                }
              }

              if (comp.parent) {
                const pProxy = comp.parent.proxy || comp.parent.ctx || comp.parent.setupState;
                if (pProxy) {
                  if (pProxy.bet && pProxy.bet.key && pProxy.singleStake) {
                    try { pProxy.singleStake[pProxy.bet.key] = vStr; directStateUpdated = true; modelVerified = true; } catch (_) {}
                  }
                  if (!confirmOpen || !directStateUpdated) {
                    if (typeof pProxy.changeSingleStake === 'function') {
                      try { pProxy.changeSingleStake(vStr); modelVerified = true; } catch (_) {}
                    }
                    if (typeof pProxy.changeMultipleStake === 'function') {
                      try { pProxy.changeMultipleStake(vStr); modelVerified = true; } catch (_) {}
                    }
                  }
                }
              }
            }

            // Vue 2 instance inspection
            if (cur.__vue__) {
              const vm = cur.__vue__;
              if ('stake' in vm) vm.stake = vStr;
              if ('value' in vm) vm.value = vStr;
              if ('currentStake' in vm) vm.currentStake = vStr;
              if (vm.$store && typeof vm.$store.commit === 'function') {
                try { vm.$store.commit('betslip/updateStake', vStr); } catch (_) {}
                try { vm.$store.commit('betslip/setStake', vStr); } catch (_) {}
                try { vm.$store.commit('setStake', vStr); } catch (_) {}
              }
              if (typeof vm.$emit === 'function') {
                vm.$emit('input', vStr);
                if (!confirmOpen) vm.$emit('change', vStr);
              }
              modelVerified = true;
              break;
            }
            cur = cur.parentElement;
          }
        }

        el.dispatchEvent(new Event('input', { bubbles: true }));
        if (!confirmOpen) {
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      } catch (_) {}
    }

    // Also update reactive store even if customEls wasn't mounted in DOM while Confirm modal is open
    if (confirmOpen && !modelVerified) {
      try {
        const isFootball = /football\\.com/i.test(location.hostname || '');
        if (isFootball) {
          ${FOOTBALL_SYNC_STAKE_SNIPPET('vStr', 'document.body')}
          modelVerified = true;
        } else {
          const appEl = document.querySelector('#app');
          const globalStore = appEl?.__vue_app__?.config?.globalProperties?.$store;
          if (globalStore?.state?.betslipStake?.singleStake) {
            for (const k of Object.keys(globalStore.state.betslipStake.singleStake)) {
              globalStore.state.betslipStake.singleStake[k] = vStr;
              modelVerified = true;
            }
          }
          if (globalStore?.state?.betslipStake && 'multipleStake' in globalStore.state.betslipStake) {
            globalStore.state.betslipStake.multipleStake = vStr;
            modelVerified = true;
          }
        }
      } catch (_) {}
    }

    // 3. Instant in-DOM Keypad click sequence WITHOUT OS pointer events or delays
    // Never click keypad/clear/done buttons while Confirm is open (would drop Confirm).
    const kb = !confirmOpen && document.querySelector('div.stake-keyboard, [data-op="stake-keyboard"], div.m-keyboard, div.m-keybord, [class*="m-keyboard" i]');
    if (kb && isVis(kb)) {
      try {
        const clearBtn = kb.querySelector('[data-key="clear"], [data-op="clearAll"]');
        if (clearBtn) {
          clearBtn.click();
        } else {
          const delBtn = kb.querySelector('[data-key="delete"], [data-key="del"], [data-op="removeLast"]');
          if (delBtn) {
            for (let i = 0; i < 15; i++) delBtn.click();
          }
        }
        for (const ch of vStr) {
          const keyBtn = kb.querySelector(\`[data-key="\${ch}"]\`)
            || Array.from(kb.querySelectorAll('[data-op="appendKey"]')).find(n => (n.textContent || '').trim() === ch)
            || Array.from(kb.querySelectorAll('span, div, button')).find(n => n.children.length === 0 && (n.textContent || '').trim() === ch);
          if (keyBtn) keyBtn.click();
        }
        const doneBtn = kb.querySelector('[data-key="done"], [data-op="done-bottom"], [data-key="ok"], [data-key="hide"]');
        if (doneBtn) doneBtn.click();
        modelVerified = true;
      } catch (_) {}
    }

    return modelVerified;
  })()
`;

const MONITOR_URLS = {
  betano: {
    ng: 'https://www.betano.ng/',
    gh: 'https://www.betano.ng/',
  },
  betpawa: {
    ng: 'https://www.betpawa.ng/',
    gh: 'https://www.betpawa.com.gh/',
  },
};

// ─── Single Bet 2-Click State-Based Helpers ──────────────────────────────────
// Shared DOM state inspection and step-isolated Place Bet / Confirm scripts.
// Strictly excludes Cashout dialogs, native auto-accept prompts, and deposit links.
const SINGLE_BET_DOM_HELPERS = `
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const norm = (el) => String(el?.innerText || el?.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase();
  const isVis = (el) => {
    if (!el || el.disabled) return false;
    if (el.getAttribute('aria-disabled') === 'true' || el.getAttribute('disabled') !== null) return false;
    if (el.classList.contains('is-disabled') || el.classList.contains('disabled')) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 5 || r.height < 5) return false;
    const st = window.getComputedStyle(el);
    return st.visibility !== 'hidden' && st.display !== 'none' && st.pointerEvents !== 'none';
  };
  const isCashoutEl = (el) => !!(el && el.closest && el.closest('.m-cashout, [class*="cashout" i], [data-op*="cashout" i], [class*="open_bets" i]'));
  const isDepositText = (t) => !!t && /\\b(deposit|top[\\s-]?up|recharge|fund|add\\s*funds?|deposit\\s*&\\s*bet)\\b/i.test(t);
  const isPlaceBetText = (t) => {
    if (!t || isDepositText(t)) return false;
    return (
      t.includes('place bet') || t.includes('placebet') ||
      t.includes('bet now') || t.includes('place a bet') ||
      t === 'bet' ||
      t.includes('accept change') || t.includes('accept changes') ||
      t.includes('save change') || t.includes('save changes') ||
      t === 'accept'
    );
  };
  const isStrictConfirmText = (t) => {
    if (!t || t.length > 80 || isDepositText(t)) return false;
    if (/^(cancel|close|back|no|decline|reject|exit|dismiss|later|×|✕)$/i.test(t)) return false;
    if (/\\b(cancel|close|keep looking|continue betting|place bet|placebet)\\b/i.test(t)) return false;
    if (/\\b(confirm bet|confirm to pay|confirm order|pay now)\\b/i.test(t)) return true;
    if (/^confirm\\b/i.test(t) || /\\bconfirm\\b/i.test(t)) return true;
    if (/\\b(agree|proceed|submit)\\b/i.test(t)) return true;
    return false;
  };
  const isRebetText = (t) => {
    if (!t || t.length > 50 || isDepositText(t)) return false;
    return /^re-?bet(\\s+(now|all|selections?))?$/i.test(t) || t === 'rebet' ||
      /\\b(re-?bet|bet again|keep selections?|repeat bet|duplicate bet|one more)\\b/i.test(t);
  };
  const isNavOrFooter = (el) => {
    if (!el) return false;
    if (el.closest('.m-fast-betslip, .m-fast-stake-wrapper, .m-fast-stake, [data-op="fast-betslip-container"], [data-op="fast-betslip-wrap"], [data-op*="fast-betslip" i], [class*="fast-betslip" i], .m-betslip, .m-bet-slip, [class*="betslip" i], [class*="bet-slip" i], .es-dialog, .m-dialog, .af-dialog, .m-pop-box, .m-pop, .m-modal, [role="dialog"], [class*="dialog" i], [class*="modal" i], [class*="popup" i], [class*="sheet" i]')) {
      return false;
    }
    return !!el.closest('footer, nav, .m-bottom-nav, .m-main-tab, .af-tabbar, .m-footer, header, .m-header, .m-nav-bar, .af-nav-bar, [class*="bottom-nav" i], [class*="tabbar" i]');
  };
  const isDepositElement = (el) => {
    try {
      if (!el) return false;
      const t = norm(el);
      if (isPlaceBetText(t) || isStrictConfirmText(t) || isRebetText(t)) return false;
      if (isNavOrFooter(el) || isDepositText(t)) return true;
      const op = String(el.getAttribute?.('data-op') || '').toLowerCase();
      if (op.includes('deposit') || op.includes('recharge') || op.includes('topup')) return true;
      if (op.includes('pay') && !op.includes('betslip') && !op.includes('confirm') && !op.includes('place')) return true;
      const href = String(el.getAttribute?.('href') || '').toLowerCase();
      if (href.includes('deposit') || href.includes('recharge')) return true;
      const cls = String(el.className || '').toLowerCase();
      if (cls.includes('deposit')) return true;
    } catch (_) {}
    return false;
  };
  const isSuccessModalOpen = () => {
    return !!Array.from(document.querySelectorAll(
      '[data-op="betslip-success-rebet"], [data-op="betslip-success"], .m-betslip-success, .m-success-box, [class*="betslip-success" i]'
    )).find(b => isVis(b) && !isCashoutEl(b));
  };
  const tryFindRebet = () => {
    const exact = Array.from(document.querySelectorAll(
      'button[data-op="betslip-success-rebet"], [data-op="betslip-success-rebet"], button.rebet, button[class*="rebet" i], [data-cms-key="rebet"], .rebet-text, [data-op*="rebet" i]'
    )).find(b => isVis(b) && !isDepositElement(b) && !isNavOrFooter(b) && !isCashoutEl(b));
    if (exact) return exact;
    const dialogs = Array.from(document.querySelectorAll(
      '.es-dialog, .m-dialog, .af-dialog, .m-pop-box, .m-pop, .m-modal, [role="dialog"], [class*="dialog" i], [class*="modal" i], [class*="success" i]'
    )).filter(d => isVis(d) && !isCashoutEl(d));
    for (const d of dialogs) {
      const hit = Array.from(d.querySelectorAll(
        'button, [role="button"], a, .m-btn, .af-button, [class*="btn" i], [class*="rebet" i], [data-op*="rebet" i]'
      )).filter(b => isVis(b) && !isDepositElement(b) && !isNavOrFooter(b) && !isCashoutEl(b))
        .find(el => {
          const op = String(el.getAttribute?.('data-op') || '').toLowerCase();
          return op.includes('rebet') || isRebetText(norm(el));
        });
      if (hit) return hit;
    }
    return null;
  };
  const findStrictConfirmCandidate = () => {
    if (isSuccessModalOpen()) return null;
    const exactSportyConfirm = Array.from(document.querySelectorAll(
      'button[data-op="betslip-confirm"], [data-op="betslip-confirm"], button.flexibet-confirm, .flexibet-confirm, [data-op="betslip-confirm-wrap"] [data-op="betslip-confirm"], button[data-op="betslip-confirm-to-pay-confirm"], [data-op="betslip-confirm-to-pay-confirm"], [data-op="betslip-confirm-to-pay-btn"], [data-op="confirm-to-pay-btn"], .m-fast-betslip button:has([data-cms-key="confirm"]), .m-betslip button:has([data-cms-key="confirm"]), [data-op*="betslip" i] button:has([data-cms-key="confirm"])'
    )).find(b => isVis(b) && !isDepositElement(b) && !isCashoutEl(b));
    if (exactSportyConfirm) return exactSportyConfirm;

    const modalContainers = Array.from(document.querySelectorAll(
      '.es-dialog, .m-dialog, .af-dialog, .m-pop-box, .m-pop, .m-modal, [role="dialog"], [class*="dialog" i], [class*="modal" i], [class*="popup" i], [class*="sheet" i], [class*="confirm" i]'
    )).filter(m => isVis(m) && !isCashoutEl(m));

    for (const modal of modalContainers) {
      const modalTxt = norm(modal);
      if (/insufficient\\s*(funds|balance)|not\\s*enough\\s*balance|please\\s*deposit|low\\s*balance/i.test(modalTxt)) continue;
      if (modalTxt.includes('auto-accept odds change') || (modalTxt.includes('odds change next time') && modalTxt.includes('bet settings'))) continue;
      if (/\\bcash\\s*out\\b|\\bcashout\\b/i.test(modalTxt)) continue;
      if (modal.querySelector('[data-op="betslip-success-rebet"], [data-op="betslip-success"], .m-betslip-success')) continue;
      const candidates = Array.from(modal.querySelectorAll(
        'button, [role="button"], .m-btn, .af-button, .es-button, [class*="btn" i], [class*="confirm" i], [class*="pay" i]'
      )).filter(c => isVis(c) && !isDepositElement(c) && !isCashoutEl(c));
      const hit = candidates.find(c => {
        if (c.tagName !== 'BUTTON' && c.querySelector('button, [role="button"]')) return false;
        const t = norm(c);
        if (isDepositText(t) || isRebetText(t)) return false;
        const op = String(c.getAttribute('data-op') || '').toLowerCase();
        if (op.includes('deposit') || op.includes('recharge') || op.includes('rebet') || op.includes('placebet')) return false;
        if (op.includes('confirm') || op.includes('pay')) return true;
        return isStrictConfirmText(t);
      });
      if (hit) return hit;
    }

    const slipRoot = document.querySelector('.m-bet-slip, .m-betslip, [class*="betslip" i], [class*="bet-slip" i], #betslip');
    if (slipRoot && isVis(slipRoot) && !isNavOrFooter(slipRoot) && !isCashoutEl(slipRoot)) {
      const candidates = Array.from(slipRoot.querySelectorAll(
        'button, [role="button"], .m-btn, .af-button, .es-button, [class*="btn" i], [class*="confirm" i]'
      )).filter(c => isVis(c) && !isDepositElement(c) && !isNavOrFooter(c) && !isCashoutEl(c));
      const hit = candidates.find(c => {
        if (c.tagName !== 'BUTTON' && c.querySelector('button, [role="button"]')) return false;
        const t = norm(c);
        if (isDepositText(t) || isRebetText(t) || isPlaceBetText(t)) return false;
        const op = String(c.getAttribute('data-op') || '').toLowerCase();
        if (op.includes('deposit') || op.includes('recharge') || op.includes('placebet')) return false;
        if (op.includes('confirm')) return true;
        return isStrictConfirmText(t);
      });
      if (hit) return hit;
    }
    return null;
  };
  const findPlaceBetBtn = () => {
    const isFootball = /football\\.com/i.test(location.hostname || '');
    if (isFootball) {
      const sheet = Array.from(document.querySelectorAll('[data-op="betslip-bottom-sheet"]')).find(isVis);
      const fast = Array.from(document.querySelectorAll('[data-op="fast-betslip-container"]')).find(isVis);
      const sheetBtn = sheet && Array.from(sheet.querySelectorAll('[data-op="betslip-placebet"]')).find(b => isVis(b) && !isDepositElement(b) && !isCashoutEl(b));
      const fastBtn = fast && Array.from(fast.querySelectorAll('[data-op="fast-betslip-single-bottom-row-right-content"], [data-op="betslip-placebet"]')).find(b => isVis(b) && !isDepositElement(b) && !isCashoutEl(b));
      return sheetBtn || fastBtn || Array.from(document.querySelectorAll('[data-op="betslip-placebet"], [data-op="fast-betslip-single-bottom-row-right-content"]')).find(b => isVis(b) && !isDepositElement(b) && !isCashoutEl(b));
    }
    const fastSlip = Array.from(document.querySelectorAll(
      '.m-fast-betslip, .m-fast-stake-wrapper, .m-fast-stake, [data-op="fast-betslip-container"], [data-op="fast-betslip-wrap"], [data-op*="fast-betslip" i], [class*="fast-betslip" i]'
    )).find(isVis);
    if (fastSlip) {
      const candidates = Array.from(fastSlip.querySelectorAll(
        '.place-bet, [class*="place-bet" i], .required-change, [data-op="single-placebet"], [data-op="single-placebet-text"], [data-op="fast-betslip-single-bottom-row-right-content"], [data-op="betslip-placebet"], button, [role="button"], .m-btn, [class*="btn" i]'
      )).filter(b => isVis(b) && !isDepositElement(b) && !isNavOrFooter(b) && !isCashoutEl(b));
      const match = candidates.find(b => isPlaceBetText(norm(b)));
      if (match) return match;
    }
    const directFast = Array.from(document.querySelectorAll(
      '[data-op="fast-betslip-single-bottom-row-right-content"], [data-op="single-placebet"], .place-bet, [class*="place-bet" i]'
    )).find(b => isVis(b) && !isDepositElement(b) && !isNavOrFooter(b) && !isCashoutEl(b) && isPlaceBetText(norm(b)));
    if (directFast) return directFast;
    const rawExactPlace = Array.from(document.querySelectorAll(
      'button[data-op="betslip-placebet"], [data-op="betslip-placebet"], button:has([data-cms-key="place_bet"]), button:has([data-cms-key="placebet"]), button.place-bet, [data-op*="placebet" i]'
    )).find(b => isVis(b) && !isNavOrFooter(b) && !isDepositElement(b) && !isCashoutEl(b));
    if (rawExactPlace) return rawExactPlace;
    const slipRoot = document.querySelector('.m-bet-slip, .m-betslip, [class*="betslip" i], [class*="bet-slip" i], #betslip');
    if (slipRoot && isVis(slipRoot) && !isCashoutEl(slipRoot)) {
      const btns = Array.from(slipRoot.querySelectorAll(
        'button, [role="button"], .m-btn, .af-button, .es-button, [class*="btn" i], [class*="submit" i], [class*="place" i]'
      )).filter(b => isVis(b) && !isDepositElement(b) && !isNavOrFooter(b) && !isCashoutEl(b) && isPlaceBetText(norm(b)));
      if (btns.length > 0) return btns[btns.length - 1];
    }
    return null;
  };
  const triggerClick = (target) => {
    if (!target || isDepositElement(target) || isCashoutEl(target)) return null;
    const btn = (target.tagName === 'BUTTON' || target.getAttribute('role') === 'button')
      ? target
      : (target.closest('button, [role="button"]') || target);
    if (isDepositElement(btn) || isCashoutEl(btn)) return null;
    try { btn.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (_) {}
    const r = btn.getBoundingClientRect();
    const cx = Math.round(r.left + r.width / 2);
    const cy = Math.round(r.top + r.height / 2);
    const evInit = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, button: 0, buttons: 1 };
    const tapTarget = btn.matches?.('.place-bet, [class*="place-bet" i], .flexibet-confirm, [data-op*="confirm" i]')
      ? btn
      : (btn.closest?.('.place-bet, [class*="place-bet" i], .flexibet-confirm, [data-op*="confirm" i]')
         || btn.querySelector?.('.place-bet, [class*="place-bet" i], .flexibet-confirm, [data-op*="confirm" i]')
         || btn);
    const safeTap = tapTarget?.__safe_tap_state__ || btn?.__safe_tap_state__;
    if (safeTap && safeTap.config && typeof safeTap.config.onTap === 'function') {
      try { safeTap.config.onTap(new MouseEvent('click', evInit)); } catch (_) {}
    }
    try {
      btn.dispatchEvent(new PointerEvent('pointerdown', { ...evInit, pointerType: 'touch', isPrimary: true }));
      btn.dispatchEvent(new PointerEvent('pointerup', { ...evInit, pointerType: 'touch', isPrimary: true }));
    } catch (_) {}
    try {
      btn.dispatchEvent(new MouseEvent('mousedown', evInit));
      btn.dispatchEvent(new MouseEvent('mouseup', evInit));
    } catch (_) {}
    try { btn.click(); } catch (_) {}
    if (target !== btn && !isDepositElement(target)) {
      try { target.click(); } catch (_) {}
    }
    return { x: cx, y: cy };
  };
`;

const INSPECT_SINGLE_BET_STATE_JS = `
  (() => {
    ${SINGLE_BET_DOM_HELPERS}
    const confirmBtn = findStrictConfirmCandidate();
    if (confirmBtn) {
      return { state: 'awaiting_confirm', label: norm(confirmBtn) };
    }
    if (isSuccessModalOpen() || tryFindRebet()) {
      return { state: 'completed' };
    }
    const placeBtn = findPlaceBetBtn();
    if (placeBtn) {
      return { state: 'placeable', label: norm(placeBtn) };
    }
    const slipBar = document.querySelector('.m-betslip-bar, [class*="betslip-bar" i], .m-slip-bar, [class*="slip-bar" i], [data-op="betslip-bar"]');
    if (slipBar && isVis(slipBar)) {
      return { state: 'placeable', label: 'betslip-bar' };
    }
    return { state: 'idle_empty' };
  })()
`;

const SINGLE_BET_PLACE_ONLY_JS = `
  (async () => {
    ${SINGLE_BET_DOM_HELPERS}
    if (findStrictConfirmCandidate()) {
      return { placed: false, awaitingConfirm: true, alreadyAwaitingConfirm: true };
    }
    if (isSuccessModalOpen() || tryFindRebet()) {
      return { placed: false, completed: true };
    }

    const slipBar = document.querySelector('.m-betslip-bar, [class*="betslip-bar" i], .m-slip-bar, [class*="slip-bar" i], [data-op="betslip-bar"]');
    let placeBtn = findPlaceBetBtn();
    if (!placeBtn && slipBar && isVis(slipBar)) {
      try { slipBar.click(); } catch (_) {}
      for (let w = 0; w < 250; w++) {
        await wait(4);
        placeBtn = findPlaceBetBtn();
        if (placeBtn) break;
      }
    }
    if (!placeBtn) {
      return { placed: false, error: 'no_place_btn' };
    }

    const initialTxt = norm(placeBtn);
    const wasAcceptChange = initialTxt.includes('accept change') || initialTxt.includes('save change') || initialTxt === 'accept';
    triggerClick(placeBtn);

    if (wasAcceptChange) {
      for (let ac = 0; ac < 120; ac++) {
        await wait(6);
        const nextPlace = findPlaceBetBtn();
        if (nextPlace && !norm(nextPlace).includes('accept')) {
          triggerClick(nextPlace);
          placeBtn = nextPlace;
          break;
        }
      }
    }

    let settled = null;
    if (findStrictConfirmCandidate()) settled = { placed: true, awaitingConfirm: true };
    else if (isSuccessModalOpen() || tryFindRebet()) settled = { placed: true, completed: true };

    if (!settled) {
      settled = await new Promise((resolve) => {
        let done = false;
        let obs = null;
        let timer = null;
        const finish = (res) => {
          if (done) return;
          done = true;
          if (obs) try { obs.disconnect(); } catch (_) {}
          if (timer) clearTimeout(timer);
          resolve(res);
        };
        const check = () => {
          if (findStrictConfirmCandidate()) finish({ placed: true, awaitingConfirm: true });
          else if (isSuccessModalOpen() || tryFindRebet()) finish({ placed: true, completed: true });
        };
        try {
          obs = new MutationObserver(check);
          if (document.documentElement) {
            obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'data-op'] });
          }
        } catch (_) {}
        timer = setTimeout(() => finish({ placed: true, awaitingConfirm: !!findStrictConfirmCandidate(), completed: !!(isSuccessModalOpen() || tryFindRebet()) }), 850);
      });
    }
    return settled;
  })()
`;

const SINGLE_BET_CONFIRM_ONLY_JS = `
  (async () => {
    ${SINGLE_BET_DOM_HELPERS}
    const confirmBtn = findStrictConfirmCandidate();
    if (!confirmBtn) {
      return { confirmed: false, error: 'no_confirm_candidate' };
    }
    triggerClick(confirmBtn);

    for (let sub = 0; sub < 15; sub++) {
      await wait(10);
      const nextC = findStrictConfirmCandidate();
      if (nextC && nextC !== confirmBtn) {
        triggerClick(nextC);
        break;
      }
    }

    if (isSuccessModalOpen() || tryFindRebet() || !findStrictConfirmCandidate()) {
      return { confirmed: true, completed: !!(isSuccessModalOpen() || tryFindRebet()) };
    }
    return await new Promise((resolve) => {
      let done = false;
      let obs = null;
      let timer = null;
      const finish = (res) => {
        if (done) return;
        done = true;
        if (obs) try { obs.disconnect(); } catch (_) {}
        if (timer) clearTimeout(timer);
        resolve(res);
      };
      const check = () => {
        if (isSuccessModalOpen() || tryFindRebet()) {
          finish({ confirmed: true, completed: true });
        } else if (!findStrictConfirmCandidate()) {
          finish({ confirmed: true, completed: false });
        }
      };
      try {
        obs = new MutationObserver(check);
        if (document.documentElement) {
          obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'data-op'] });
        }
      } catch (_) {}
      timer = setTimeout(() => finish({ confirmed: true, completed: !!(isSuccessModalOpen() || tryFindRebet()) }), 850);
    });
  })()
`;

module.exports = {
  normalizeSite,
  normalizeCountry,
  siteFromUrl,
  countryFromUrl,
  buildHomeUrl,
  buildOpenBetsUrl,
  normalizeUrlForProfile,
  rewriteCountryOnUrl,
  rewriteUrlForProfile,
  minStakeForProfile,
  FIND_STAKE_INPUT_JS,
  IS_CONFIRM_OPEN_JS,
  KEYBOARD_CONTAINER_SELECTOR,
  MONITOR_URLS,
  oddsReadCode,
  readFieldCode,
  FAST_REBET_CYCLE_JS,
  EXECUTE_ATTACK_CYCLE_JS,
  INSPECT_SINGLE_BET_STATE_JS,
  SINGLE_BET_PLACE_ONLY_JS,
  SINGLE_BET_CONFIRM_ONLY_JS,
  NAV_OPEN_BETS_JS,
  INSPECT_OPEN_BETS_STATE_JS,
  PREPARE_CASHOUT_CLICK_JS,
  FIND_CASHOUT_CONFIRM_JS,
  CLICK_CASHOUT_CONFIRM_JS,
  FAST_SET_STAKE_JS,
  loginCode,
};

