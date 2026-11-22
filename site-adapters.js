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

const FIND_STAKE_INPUT_JS = `
  (() => {
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
      if (countBadge && !hasSheet && !hasFast) {
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

    // 1. Auto-expand SportyBet betslip if collapsed/minimized
    const slipBar = document.querySelector('.m-betslip-bar, [class*="betslip-bar" i], .m-slip-bar, [class*="slip-bar" i]');
    if (slipBar && isVis(slipBar)) {
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

const PLACE_BET_JS = `
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
      if (/\b(cancel|close|keep looking|continue betting)\b/i.test(t)) return false;
      if (/\b(confirm|pay now|accept|agree|proceed|submit)\b/i.test(t)) return true;
      if (/\b(confirm bet|confirm to pay|confirm order|place bet)\b/i.test(t)) return true;
      if (/^(ok|yes|continue|next|i understand|got it)$/i.test(t)) return true;
      if (/^accept\b/i.test(t) || /^confirm\b/i.test(t)) return true;
      return false;
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

    const checkInsufficientBalance = () => {
      if (location.pathname.includes('/deposit') || location.href.includes('/deposit')) {
        try { if (window.history.length > 1) window.history.back(); } catch (_) {}
        return { error: 'on_deposit_page', msg: 'View is currently on Deposit page' };
      }
      const dialogs = Array.from(document.querySelectorAll(
        '.es-dialog, .m-dialog, .af-dialog, .m-pop-box, .m-pop, .m-modal, [role="dialog"], [class*="dialog" i], [class*="modal" i], [class*="popup" i]'
      )).filter(isVis);
      for (const d of dialogs) {
        const txt = norm(d);
        if (/insufficient\s*(funds|balance)|not\s*enough\s*balance|please\s*deposit|low\s*balance|balance\s*is\s*too\s*low|top[\s-]?up\s*to\s*continue/i.test(txt)) {
          return { error: 'insufficient_balance', msg: 'Insufficient balance dialog is open' };
        }
      }
      const alerts = Array.from(document.querySelectorAll('.m-msg, .af-msg, .es-msg, [class*="toast" i], [class*="notice" i], [class*="alert" i]')).filter(isVis);
      for (const a of alerts) {
        const txt = norm(a);
        if (/insufficient\s*(funds|balance)|not\s*enough\s*balance|please\s*deposit/i.test(txt)) {
          return { error: 'insufficient_balance', msg: 'Insufficient balance alert detected' };
        }
      }
      return null;
    };

    const checkOddsLocked = () => {
      // ONLY inspect inside the active betslip container - NEVER search the entire document or live match list!
      const slipRoot = document.querySelector('.m-bet-slip, .m-betslip, [class*="betslip" i], [class*="bet-slip" i], #betslip');
      if (!slipRoot || !isVis(slipRoot)) return null;

      // Check if any bet selection item inside the betslip has a locked/suspended status
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

      // Check if betslip has an explicit error banner indicating all odds are suspended
      const slipNotice = Array.from(slipRoot.querySelectorAll('.m-msg, .af-msg, .es-msg, [class*="notice" i], [class*="alert" i]')).find(isVis);
      if (slipNotice) {
        const noticeTxt = norm(slipNotice);
        if (/\b(selection(s)?\s*suspended|market\s*suspended|market\s*closed|odds\s*unavailable)\b/i.test(noticeTxt)) {
          return { error: 'odds_locked', oddsLocked: true, msg: noticeTxt };
        }
      }

      return null;
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

    const findConfirmCandidate = (initialBtn) => {
      // 0. Direct match on user-provided exact SportyBet selector:
      const exactSportyConfirm = Array.from(document.querySelectorAll(
        'button[data-op="betslip-confirm"], [data-op="betslip-confirm"], button.flexibet-confirm, .flexibet-confirm, [data-op="betslip-confirm-wrap"] [data-op="betslip-confirm"], button:has([data-cms-key="confirm"]), [data-cms-key="confirm"], [data-op="betslip-confirm-to-pay-btn"]'
      )).find(b => isVis(b) && !isDepositElement(b));
      if (exactSportyConfirm) return exactSportyConfirm;

      // 0b. Direct match on Football.com confirm button:
      const exactFootballConfirm = Array.from(document.querySelectorAll(
        'button[data-op="betslip-confirm-to-pay-confirm"], [data-op="betslip-confirm-to-pay-confirm"], [data-op="betslip-confirm-to-pay-sheet"] [data-op*="confirm" i]'
      )).find(b => isVis(b) && !isDepositElement(b));
      if (exactFootballConfirm) return exactFootballConfirm;

      // 1. Search inside any open dialog/modal container first (highest priority)
      const modalContainers = Array.from(document.querySelectorAll(
        '.es-dialog, .m-dialog, .af-dialog, .m-pop-box, .m-pop, .m-modal, [role="dialog"], [class*="dialog" i], [class*="modal" i], [class*="popup" i], [class*="sheet" i], [class*="confirm" i]'
      )).filter(isVis);

      for (const modal of modalContainers) {
        const modalTxt = norm(modal);
        if (/insufficient\s*(funds|balance)|not\s*enough\s*balance|please\s*deposit|low\s*balance/i.test(modalTxt)) {
          continue; // Insufficient balance modal: do not click confirmation inside!
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

      // 2. Search inside active betslip root ONLY (never search global document or footer!)
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

    // 0. Pre-flight Insufficient Balance, Odds Locked, and Deposit Page check
    const preCheck = checkInsufficientBalance();
    if (preCheck) return { placed: false, confirmed: false, ...preCheck };

    const lockedCheck = checkOddsLocked();
    if (lockedCheck) return { placed: false, confirmed: false, ...lockedCheck };

    // Helper to ensure visible stake in DOM is committed directly to Vue 3/Vuex model right before submit click
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

        // Standard input: ensure value matches
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

        // Vue 3 component & store synchronization
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

    const findCollapsedPlaceBtn = () => {
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

      return null;
    };

    // 1. Reactive polling for Place Bet button to become enabled and ready (up to 4.0s)
    let initialBtn = null;
    let placeCoords = null;
    const isFootball = /football\.com/i.test(location.hostname || '');

    // Auto-expand betslip if collapsed/minimized into floating bar ONLY if collapsed button not already present
    const slipBar = document.querySelector('.m-betslip-bar, [class*="betslip-bar" i], .m-slip-bar, [class*="slip-bar" i], [data-op="betslip-bar"]');
    const collapsedPre = findCollapsedPlaceBtn();
    const expandedPre = Array.from(document.querySelectorAll('.m-betslip, .m-bet-slip, [class*="betslip" i], [class*="bet-slip" i]')).find(el => {
      if (el === slipBar || slipBar?.contains(el)) return false;
      const cls = String(el.className || '');
      return !/(bar|entry|icon|badge|count)/i.test(cls) && isVis(el);
    });
    logTrace('Initial Betslip Status:', {
      slipBar: !!slipBar,
      slipBarVis: isVis(slipBar),
      collapsedPlaceBtn: !!collapsedPre,
      collapsedBtnText: collapsedPre ? norm(collapsedPre) : null,
      expandedSlip: !!expandedPre,
      expandedSlipClass: expandedPre ? expandedPre.className : null
    });

    try {
      if (slipBar && isVis(slipBar) && !collapsedPre) {
        if (!expandedPre) {
          const t0 = Date.now();
          logTrace('Initial: slipBar visible & not expanded -> clicking slipBar to expand');
          try { slipBar.click(); } catch (_) {}
          await wait(100);
          logTrace('Initial expand wait completed in ' + (Date.now() - t0) + 'ms');
        } else {
          logTrace('Initial: betslip already expanded -> no-op to prevent accidental re-collapse');
        }
      }
    } catch (err) {
      logTrace('[PlaceBet:Error] Initial expand in PLACE_BET_JS threw:', String(err));
    }

    for (let pAttempt = 0; pAttempt < 350; pAttempt++) {
      // 0. Collapsed fast betslip button first (direct submission without requiring expansion)
      const collapsedBtn = findCollapsedPlaceBtn();
      if (collapsedBtn) {
        if (isDepositElement(collapsedBtn)) {
          logTrace('Collapsed place btn found but is deposit:', norm(collapsedBtn));
          return { placed: false, confirmed: false, error: 'insufficient_balance', msg: 'Place Bet button shows Deposit (balance < stake)', traceLogs };
        }
        logTrace('pAttempt ' + pAttempt + ': Found button via findCollapsedPlaceBtn():', norm(collapsedBtn));
        initialBtn = collapsedBtn;
      } else {
        if (pAttempt % 20 === 0 && slipBar && isVis(slipBar)) {
          // Guard: only click slipBar if betslip is NOT already expanded (prevents re-collapsing)
          const isCurrentlyExpanded = !!Array.from(document.querySelectorAll('.m-betslip, .m-bet-slip, [class*="betslip" i], [class*="bet-slip" i]')).find(el => {
            if (el === slipBar || slipBar?.contains(el)) return false;
            const cls = String(el.className || '');
            return !/(bar|entry|icon|badge|count)/i.test(cls) && isVis(el);
          });
          if (!isCurrentlyExpanded) {
            logTrace('pAttempt ' + pAttempt + ': Periodic slipBar click to expand');
            try { slipBar.click(); } catch (_) {}
          }
        }
        if (isFootball) {
          const sheet = Array.from(document.querySelectorAll('[data-op="betslip-bottom-sheet"]')).find(isVis);
          const fast = Array.from(document.querySelectorAll('[data-op="fast-betslip-container"]')).find(isVis);
          const sheetBtn = sheet && Array.from(sheet.querySelectorAll('[data-op="betslip-placebet"]')).find(b => isVis(b) && !isDepositElement(b));
          const fastBtn = fast && Array.from(fast.querySelectorAll('[data-op="fast-betslip-single-bottom-row-right-content"], [data-op="betslip-placebet"]')).find(b => isVis(b) && !isDepositElement(b));
          initialBtn = sheetBtn || fastBtn || Array.from(document.querySelectorAll('[data-op="betslip-placebet"], [data-op="fast-betslip-single-bottom-row-right-content"]')).find(b => isVis(b) && !isDepositElement(b));
        } else {
          // Direct match on SportyBet Place Bet button
          const rawExactPlace = Array.from(document.querySelectorAll(
            'button[data-op="betslip-placebet"], [data-op="betslip-placebet"], button:has([data-cms-key="place_bet"]), button:has([data-cms-key="placebet"]), button:has([data-cms-key*="place" i]), button.place-bet, [data-op*="placebet" i]'
          )).find(b => isVis(b) && !isNavOrFooter(b));

          if (rawExactPlace) {
            if (isDepositElement(rawExactPlace)) {
              logTrace('rawExactPlace is deposit:', norm(rawExactPlace));
              return { placed: false, confirmed: false, error: 'insufficient_balance', msg: 'Place Bet button shows Deposit (balance < stake)', traceLogs };
            }
            const candidateBtn = (rawExactPlace.tagName === 'BUTTON' || rawExactPlace.getAttribute('role') === 'button')
              ? rawExactPlace
              : (rawExactPlace.closest('button, [role="button"]') || rawExactPlace);
            if (isDepositElement(candidateBtn)) {
              logTrace('candidateBtn is deposit:', norm(candidateBtn));
              return { placed: false, confirmed: false, error: 'insufficient_balance', msg: 'Place Bet button shows Deposit (balance < stake)', traceLogs };
            }
            logTrace('pAttempt ' + pAttempt + ': Found button via rawExactPlace:', norm(candidateBtn));
            initialBtn = candidateBtn;
          } else {
            // Check on-screen keyboard Place Bet button
            const kbPlace = Array.from(document.querySelectorAll('div.stake-keyboard [data-op="betslip-placebet"], div.stake-keyboard [data-op="done-bottom"], div.m-keyboard [data-op="betslip-placebet"]')).find(b => isVis(b) && !isDepositElement(b));
            if (kbPlace) {
              logTrace('pAttempt ' + pAttempt + ': Found button via kbPlace:', norm(kbPlace));
              initialBtn = kbPlace;
            } else {
              const slipRoot = document.querySelector('.m-bet-slip, .m-betslip, [class*="betslip" i], [class*="bet-slip" i], #betslip');
              const scope = slipRoot || document;
              const btns = Array.from(scope.querySelectorAll(
                'button, [role="button"], .m-btn, .af-button, .es-button, [class*="btn" i], [class*="submit" i], [class*="place" i]'
              )).filter(b => isVis(b) && !isDepositElement(b) && !isNavOrFooter(b) && isPlaceBetText(norm(b)));

              if (btns.length > 0) {
                logTrace('pAttempt ' + pAttempt + ': Found button via scope text match:', norm(btns[btns.length - 1]));
                initialBtn = btns[btns.length - 1];
              }
            }
          }
        }
      }

      if (initialBtn) {
        syncVisibleStakeToModel();
        const initialTxt = norm(initialBtn);
        const wasAcceptChange = initialTxt.includes('accept change') || initialTxt.includes('save change') || initialTxt === 'accept';
        logTrace('Triggering click on initialBtn. wasAcceptChange:', wasAcceptChange);
        placeCoords = triggerClick(initialBtn);

        if (wasAcceptChange) {
          // Poll for button to transition into "Place Bet" and click it
          for (let ac = 0; ac < 150; ac++) {
            await wait(10);
            const nextPlace = findCollapsedPlaceBtn() || Array.from(document.querySelectorAll(
              'button[data-op="betslip-placebet"], [data-op="betslip-placebet"], .place-bet, [class*="place-bet" i]'
            )).find(b => isVis(b) && !isDepositElement(b) && isPlaceBetText(norm(b)));
            if (nextPlace && !norm(nextPlace).includes('accept')) {
              syncVisibleStakeToModel();
              logTrace('Accept change clicked, now clicking transitioned place button:', norm(nextPlace));
              placeCoords = triggerClick(nextPlace);
              initialBtn = nextPlace;
              break;
            }
          }
        }
        break;
      }
      await wait(8);
    }

    if (!initialBtn) {
      const allBtns = Array.from(document.querySelectorAll('button, [role="button"], .m-btn, .place-bet')).filter(isVis).map(b => ({
        tag: b.tagName,
        cls: b.className?.slice(0, 40),
        txt: norm(b).slice(0, 30)
      }));
      logTrace('FAILED to locate initialBtn after 350 attempts. Visible buttons:', allBtns);
      const lockedAfter = checkOddsLocked();
      if (lockedAfter) return { placed: false, confirmed: false, ...lockedAfter, traceLogs };
      const preConfirm = findConfirmCandidate(null);
      if (preConfirm) {
        logTrace('Found preConfirm candidate:', norm(preConfirm));
        const coords = triggerClick(preConfirm);
        return { placed: true, confirmed: true, confirmX: coords?.x, confirmY: coords?.y, label: norm(preConfirm), traceLogs };
      }
      return { placed: false, confirmed: false, traceLogs };
    }

    // Step 2: Continuous polling loop to detect and click Confirm immediately (up to 4.0s)
    let confirmedHit = null;
    let confirmCoords = null;
    let step2Observer = null;
    logTrace('Starting Step 2 (confirm/success detection)...');

    // 1. Instant check on attempt 0 (0ms)
    const instantCheck = findConfirmCandidate(initialBtn);
    if (instantCheck) {
      logTrace('Step 2: Instant confirm candidate found at t=0:', norm(instantCheck));
      confirmCoords = triggerClick(instantCheck);
      confirmedHit = instantCheck;
      for (let sub = 0; sub < 15; sub++) {
        await wait(5);
        const nextHit = findConfirmCandidate(instantCheck);
        if (nextHit && nextHit !== instantCheck) {
          logTrace('Step 2: Secondary confirm found on sub-attempt ' + sub + ':', norm(nextHit));
          confirmCoords = triggerClick(nextHit);
          confirmedHit = nextHit;
          break;
        }
      }
      return {
        placed: true,
        confirmed: true,
        placeX: placeCoords?.x,
        placeY: placeCoords?.y,
        confirmX: confirmCoords?.x,
        confirmY: confirmCoords?.y,
        label: norm(confirmedHit),
        traceLogs
      };
    }

    // 2. Microtask MutationObserver for zero-paint confirmation
    try {
      step2Observer = new MutationObserver(() => {
        if (!confirmedHit) {
          const hit = findConfirmCandidate(initialBtn);
          if (hit) {
            logTrace('Step 2: MutationObserver caught confirm candidate in microtask:', norm(hit));
            confirmCoords = triggerClick(hit);
            confirmedHit = hit;
          }
        }
      });
      if (document.documentElement) {
        step2Observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['class', 'style', 'data-op']
        });
      }
    } catch (_) {}

    try {
      for (let attempt = 0; attempt < 350; attempt++) {
        if (confirmedHit) {
          logTrace('Step 2: confirmedHit registered via observer on attempt ' + attempt);
          for (let sub = 0; sub < 15; sub++) {
            await wait(5);
            const nextHit = findConfirmCandidate(confirmedHit);
            if (nextHit && nextHit !== confirmedHit) {
              logTrace('Step 2: Secondary confirm found on sub-attempt ' + sub + ':', norm(nextHit));
              confirmCoords = triggerClick(nextHit);
              confirmedHit = nextHit;
              break;
            }
          }
          return {
            placed: true,
            confirmed: true,
            placeX: placeCoords?.x,
            placeY: placeCoords?.y,
            confirmX: confirmCoords?.x,
            confirmY: confirmCoords?.y,
            label: norm(confirmedHit),
            traceLogs
          };
        }

        // Check if success card or rebet button already appeared (instant bet placement)
        const successModal = Array.from(document.querySelectorAll(
          '[data-op="betslip-success-rebet"], [data-op="betslip-success"], .m-betslip-success, .m-success-box, [class*="betslip-success" i]'
        )).find(isVis);
        if (successModal) {
          logTrace('Step 2: Instant Success screen detected on attempt ' + attempt);
          return {
            placed: true,
            confirmed: true,
            placeX: placeCoords?.x,
            placeY: placeCoords?.y,
            singleClickSuccess: true,
            label: 'Success Screen',
            traceLogs
          };
        }

        const hit = findConfirmCandidate(initialBtn);
        if (hit) {
          logTrace('Step 2: Found confirm candidate on attempt ' + attempt + ':', norm(hit));
          confirmCoords = triggerClick(hit);
          confirmedHit = hit;

          // Check if secondary confirm appears (e.g. odds change modal -> then payment modal)
          for (let sub = 0; sub < 15; sub++) {
            await wait(10);
            const nextHit = findConfirmCandidate(hit);
            if (nextHit && nextHit !== hit) {
              logTrace('Step 2: Secondary confirm found on sub-attempt ' + sub + ':', norm(nextHit));
              confirmCoords = triggerClick(nextHit);
              confirmedHit = nextHit;
              break;
            }
          }
          return {
            placed: true,
            confirmed: true,
            placeX: placeCoords?.x,
            placeY: placeCoords?.y,
            confirmX: confirmCoords?.x,
            confirmY: confirmCoords?.y,
            label: norm(confirmedHit),
            traceLogs
          };
        }
        await wait(6);
      }
    } finally {
      if (step2Observer) {
        try { step2Observer.disconnect(); } catch (_) {}
      }
    }

    const openDialogs = Array.from(document.querySelectorAll('.es-dialog, .m-dialog, .af-dialog, [role="dialog"], [class*="modal" i]')).filter(isVis).map(d => ({
      cls: d.className?.slice(0, 40),
      txt: norm(d).slice(0, 50)
    }));
    logTrace('Step 2 ended without confirm candidate. Visible dialogs:', openDialogs);

    return {
      placed: true,
      confirmed: false,
      placeX: placeCoords?.x,
      placeY: placeCoords?.y,
      traceLogs
    };
  })()
`;

const CLICK_ANY_CONFIRM_JS = `
  (() => {
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

    const isConfirmText = (t) => {
      if (!t || t.length > 80 || isDepositText(t)) return false;
      if (/^(cancel|close|back|no|decline|reject|exit|dismiss|×|✕)$/i.test(t)) return false;
      if (/\b(cancel|close|keep looking|continue betting)\b/i.test(t)) return false;
      if (/\b(confirm|pay now|accept|agree|proceed|submit)\b/i.test(t)) return true;
      if (/\b(confirm bet|confirm to pay|confirm order)\b/i.test(t)) return true;
      if (/^(ok|yes|continue|next|i understand|got it)$/i.test(t)) return true;
      if (/^accept\b/i.test(t) || /^confirm\b/i.test(t)) return true;
      return false;
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
        if (typeof isConfirmText === 'function' && isConfirmText(t)) return false;
        if (isNavOrFooter(el)) return true;
        if (isDepositText(t)) return true;
        const op = String(el.getAttribute?.('data-op') || '').toLowerCase();
        if (op.includes('deposit') || op.includes('recharge') || op.includes('topup')) return true;
        if (op.includes('pay') && !op.includes('betslip') && !op.includes('confirm')) return true;
        const href = String(el.getAttribute?.('href') || '').toLowerCase();
        if (href.includes('deposit') || href.includes('recharge')) return true;
        const cls = String(el.className || '').toLowerCase();
        if (cls.includes('deposit')) return true;
      } catch (err) {
        logTrace('[PlaceBet:Error] isDepositElement error:', String(err));
      }
      return false;
    };

    if (location.pathname.includes('/deposit') || location.href.includes('/deposit')) {
      try { if (window.history.length > 1) window.history.back(); } catch (_) {}
      return { clicked: false, error: 'on_deposit_page' };
    }

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

    // 0. Direct match on user-provided exact SportyBet selector:
    const exactSportyConfirm = Array.from(document.querySelectorAll(
      'button[data-op="betslip-confirm"], [data-op="betslip-confirm"], button.flexibet-confirm, .flexibet-confirm, button:has([data-cms-key="confirm"]), [data-cms-key="confirm"], [data-op="betslip-confirm-to-pay-btn"]'
    )).find(b => isVis(b) && !isDepositElement(b));
    if (exactSportyConfirm) {
      const coords = triggerClick(exactSportyConfirm);
      return { clicked: true, x: coords?.x, y: coords?.y, label: 'SportyBet Confirm' };
    }

    // 1. Search inside any open dialog/modal container first
    const modalContainers = Array.from(document.querySelectorAll(
      '.es-dialog, .m-dialog, .af-dialog, .m-pop-box, .m-pop, .m-modal, [role="dialog"], [class*="dialog" i], [class*="modal" i], [class*="popup" i], [class*="sheet" i], [class*="confirm" i]'
    )).filter(isVis);

    for (const modal of modalContainers) {
      const modalTxt = norm(modal);
      if (/insufficient\s*(funds|balance)|not\s*enough\s*balance|please\s*deposit|low\s*balance/i.test(modalTxt)) {
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
      if (hit) {
        const coords = triggerClick(hit);
        return { clicked: true, x: coords?.x, y: coords?.y, label: norm(hit) };
      }
    }

    // 2. Search inside active betslip root ONLY (never global document or footer!)
    const slipRoot = document.querySelector('.m-bet-slip, .m-betslip, [class*="betslip" i], [class*="bet-slip" i], #betslip');
    if (slipRoot && isVis(slipRoot) && !isNavOrFooter(slipRoot)) {
      const candidates = Array.from(slipRoot.querySelectorAll(
        'button, [role="button"], .m-btn, .af-button, .es-button, [class*="btn" i], [class*="confirm" i]'
      )).filter(c => isVis(c) && !isDepositElement(c) && !isNavOrFooter(c));

      const hit = candidates.find(c => {
        if (c.tagName !== 'BUTTON' && c.querySelector('button, [role="button"]')) return false;
        const t = norm(c);
        if (isDepositText(t)) return false;
        const op = String(c.getAttribute('data-op') || '').toLowerCase();
        if (op.includes('deposit') || op.includes('recharge')) return false;
        if (op.includes('confirm') || op.includes('accept')) return true;
        return isConfirmText(t);
      });
      if (hit) {
        const coords = triggerClick(hit);
        return { clicked: true, x: coords?.x, y: coords?.y, label: norm(hit) };
      }
    }

    return { clicked: false };
  })()
`;

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


    // 1. Instant-fire polling for Rebet button (every 4ms, up to 10s)
    // As soon as ANYTHING matching "rebet" is visible → click it immediately, no waiting
    let rebetClicked = false;
    let rebetCoords = null;
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

    for (let attempt = 0; attempt < 2500; attempt++) {
      const btn = tryFindRebet();
      if (btn) {
        rebetCoords = triggerClick(btn);
        // Fire click 3 times immediately to guarantee it registers
        try { btn.click(); } catch (_) {}
        try { btn.click(); } catch (_) {}
        rebetClicked = true;
        break;
      }

      // Betslip already remounted with selections (rebet already processed)
      // Guard: only check after at least 80 attempts (160ms) to ensure the previous betslip isn't falsely matched
      if (attempt > 80) {
        if (!isFootball) {
          const slipRoot = document.querySelector('.m-bet-slip, .m-betslip, [class*="betslip" i], [class*="bet-slip" i]');
          if (slipRoot && isVis(slipRoot)) {
            const hasItems = !!slipRoot.querySelector('.m-bet-item, .m-item, .slip-item, [class*="bet-item" i]');
            const hasInput = (${FIND_STAKE_INPUT_JS})();
            if (hasItems && hasInput && isVis(hasInput)) {
              rebetClicked = true;
              break;
            }
          }
        } else {
          const input = (${FIND_STAKE_INPUT_JS})();
          if (input && isVis(input)) { rebetClicked = true; break; }
        }
      }

      await wait(2);
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

    return { ok: true, rebetClicked, rebetX: rebetCoords?.x, rebetY: rebetCoords?.y, inputUpdated, stake: val };
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

const REBET_JS = `
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

    // Instant-fire polling for Rebet button (every 4ms, up to 10s) — same logic as FAST_REBET_CYCLE_JS
    const isFootball = /football\.com/i.test(location.hostname || '');
    for (let attempt = 0; attempt < 2500; attempt++) {
      // Tier 1: Exact SportyBet rebet selectors
      const exact = Array.from(document.querySelectorAll(
        'button[data-op="betslip-success-rebet"], [data-op="betslip-success-rebet"], button.rebet, button[class*="rebet" i], [data-cms-key="rebet"], .rebet-text, [data-op*="rebet" i]'
      )).find(b => isVis(b) && !isDepositElement(b) && !isNavOrFooter(b));
      if (exact) {
        triggerClick(exact);
        try { exact.click(); } catch (_) {}
        try { exact.click(); } catch (_) {}
        return true;
      }

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
        if (hit) {
          triggerClick(hit);
          try { hit.click(); } catch (_) {}
          return true;
        }
      }

      // Tier 3: Text-match anywhere on page
      const textHit = Array.from(document.querySelectorAll(
        '[data-op*="rebet" i], [data-test-id*="rebet" i], [class*="rebet" i], button, a, [role="button"], div, span, .m-btn, .af-button, .es-button, [class*="btn" i]'
      )).filter(b => isVis(b) && !isDepositElement(b) && !isNavOrFooter(b))
        .find(el => {
          const op = (el.getAttribute('data-op') || '').toLowerCase();
          return op.includes('rebet') || isRebetText(norm(el));
        });
      if (textHit) {
        triggerClick(textHit);
        try { textHit.click(); } catch (_) {}
        return true;
      }

      // Betslip already remounted with selections
      const slipRoot = document.querySelector('.m-bet-slip, .m-betslip, [class*="betslip" i], [class*="bet-slip" i]');
      if (slipRoot && isVis(slipRoot)) {
        const hasItems = !!slipRoot.querySelector('.m-bet-item, .m-item, .slip-item, [class*="bet-item" i]');
        const hasInput = (${FIND_STAKE_INPUT_JS})();
        if (hasItems && hasInput && isVis(hasInput)) return true;
      }
      if (isFootball) {
        const stakeInput = (${FIND_STAKE_INPUT_JS})();
        if (stakeInput && isVis(stakeInput)) return true;
      }

      await wait(2);
    }

    return false;
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
          return t === 'open bets' || t === 'open bet';
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

    const navScope = document.querySelector('.m-bottom-fixed, [class*="bottom-fixed" i], [class*="bottom-nav" i]') || document;
    const navLabels = Array.from(navScope.querySelectorAll('span.label, .m-btn-button, a, button, [role="tab"], [role="button"], li, div')).filter((el) => {
      if (!isVis(el)) return false;
      const t = norm(el);
      return t === 'open bets' || t === 'open bet' || /^open\\s*bets(\\s*\\(?\\d+\\)?)?$/.test(t);
    });

    if (navLabels.length > 0) {
      const labelEl = navLabels[navLabels.length - 1];
      const target = labelEl.closest('.m-btn-button, a, button, [role="tab"], [role="button"]') || labelEl;
      try { target.click(); } catch (_) {}
      return { status: 'navigated', via: 'bottom-nav', href: location.href };
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

const CASHOUT_CONFIRM_ROOT_SEL = '.m-cashout, [data-op*="cashout" i][role="dialog"], [data-op*="confirm" i], [class*="cashout-dialog" i], [class*="cashout-confirm" i], [role="dialog"], .es-dialog, .drawer__content, .bottom-panel-drawer, [class*="confirm" i], [class*="dialog" i], [class*="modal" i], [class*="popup" i]';

const PREPARE_CASHOUT_CLICK_JS = `
  (() => {
    const norm = (el) => (el?.innerText || el?.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase();
    const isVis = (el) => {
      if (!el || el.disabled) return false;
      if (el.closest('[disabled], [aria-disabled="true"], .is-disabled, .disabled')) return false;
      const r = el.getBoundingClientRect();
      const st = window.getComputedStyle(el);
      return r.width > 20 && r.height > 16 && st.visibility !== 'hidden' && st.display !== 'none' && st.pointerEvents !== 'none' && st.opacity !== '0';
    };

    const isConfirmBtnText = (ct) => {
      if (!ct || ct.length > 44 || ct.includes('?')) return false;
      if (/\\b(cancel|close|back|partial|auto[\\s-]*cash|rule|how to|what is|learn|no)\\b/i.test(ct)) return false;
      return ct === 'confirm' || ct === 'confirm cashout' || ct === 'confirm cash out' ||
        ct === 'cashout' || ct === 'cash out' || /^confirm\\b/i.test(ct) || /^cash\\s*out\\b/i.test(ct);
    };

    const openDialogs = Array.from(document.querySelectorAll(${JSON.stringify(CASHOUT_CONFIRM_ROOT_SEL)})).filter(isVis);
    for (const dlg of openDialogs) {
      const cBtns = Array.from(dlg.querySelectorAll('button, [role="button"], .m-btn, .af-button, [data-op*="confirm" i], [data-op*="cashout" i]')).filter((cb) => {
        if (!isVis(cb)) return false;
        if (cb.tagName !== 'BUTTON' && cb.querySelector('button, [role="button"]')) return false;
        return isConfirmBtnText(norm(cb));
      });
      if (cBtns.length > 0) {
        const cb = cBtns[cBtns.length - 1];
        const r = cb.getBoundingClientRect();
        return { mode: 'confirm-only', x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), label: norm(cb) };
      }
    }

    const EXCLUDED_ANCESTORS = [
      'header', 'nav', 'footer',
      '.m-openbet-header', '[class*="openbet-header" i]', '[class*="open-bets-header" i]', '[class*="header-wrap" i]',
      '.m-bottom-fixed', '[class*="bottom-fixed" i]',
      '[class*="help" i]', '[class*="guide" i]', '[class*="faq" i]', '[class*="rule" i]',
      '[class*="auto-cashout" i]', '[class*="partial" i]', '[class*="history" i]', '.m-cashout'
    ].join(', ');

    const isTicketCashoutText = (t) => {
      if (!t || t.length > 48 || t.includes('?')) return false;
      if (/\\b(how to|what is|learn|more|auto[\\s-]*cash|partial|rule|faq|guide|history|terms|detail|open bets)\\b/i.test(t)) return false;
      return t === 'cashout' || t === 'cash out' || /^cash\\s*out\\b/i.test(t) || /^cashout\\b/i.test(t);
    };

    const ticketScope = document.querySelector('.m-sportBets, [class*="open-bet" i], [class*="openbet" i], [class*="bet-list" i], [class*="order" i], main, #__nuxt') || document;
    const candidates = Array.from(ticketScope.querySelectorAll(
      'button, [role="button"], .m-btn, .af-button, [data-op*="cashout" i], [class*="cashout" i], [class*="cash-out" i]'
    )).filter((el) => {
      if (!isVis(el)) return false;
      if (el.tagName === 'A' && el.hasAttribute('href')) return false;
      if (el.closest('a[href]')) return false;
      if (el.closest(EXCLUDED_ANCESTORS)) return false;
      if (el.tagName !== 'BUTTON' && el.querySelector('button, [role="button"], .m-btn, .af-button')) return false;
      return isTicketCashoutText(norm(el));
    });

    if (candidates.length === 0) return { mode: 'none' };

    const btn = candidates[0];
    try { btn.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (_) {}
    const r = btn.getBoundingClientRect();
    const label = norm(btn);
    try { btn.click(); } catch (_) {}
    return {
      mode: 'clicked-ticket',
      label,
      x: Math.round(r.left + r.width / 2),
      y: Math.round(r.top + r.height / 2),
    };
  })()
`;

const FIND_CASHOUT_CONFIRM_JS = `
  (() => {
    const norm = (el) => (el?.innerText || el?.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase();
    const isVis = (el) => {
      if (!el || el.disabled) return false;
      if (el.closest('[disabled], [aria-disabled="true"], .is-disabled, .disabled')) return false;
      const r = el.getBoundingClientRect();
      const st = window.getComputedStyle(el);
      return r.width > 20 && r.height > 16 && st.visibility !== 'hidden' && st.display !== 'none' && st.pointerEvents !== 'none' && st.opacity !== '0';
    };

    const roots = Array.from(document.querySelectorAll(${JSON.stringify(CASHOUT_CONFIRM_ROOT_SEL)})).filter(isVis);
    for (const root of roots) {
      const cBtns = Array.from(root.querySelectorAll('button, [role="button"], .m-btn, .af-button, [data-op*="confirm" i], [data-op*="cashout" i]')).filter((cb) => {
        if (!isVis(cb)) return false;
        if (cb.tagName !== 'BUTTON' && cb.querySelector('button, [role="button"]')) return false;
        const ct = norm(cb);
        if (!ct || ct.length > 44 || ct.includes('?')) return false;
        if (/\\b(cancel|close|back|partial|auto[\\s-]*cash|rule|how to|what is|learn|no)\\b/i.test(ct)) return false;
        return ct === 'confirm' || ct === 'confirm cashout' || ct === 'confirm cash out' ||
          ct === 'cashout' || ct === 'cash out' || /^confirm\\b/i.test(ct) || /^cash\\s*out\\b/i.test(ct);
      });
      if (cBtns.length > 0) {
        const cb = cBtns[cBtns.length - 1];
        try { cb.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (_) {}
        const r = cb.getBoundingClientRect();
        return { found: true, clickNow: true, label: norm(cb), x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
      }
    }
    return { found: false };
  })()
`;

const CLICK_CASHOUT_CONFIRM_JS = `
  (() => {
    const norm = (el) => (el?.innerText || el?.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase();
    const isVis = (el) => {
      if (!el || el.disabled) return false;
      if (el.closest('[disabled], [aria-disabled="true"], .is-disabled, .disabled')) return false;
      const r = el.getBoundingClientRect();
      const st = window.getComputedStyle(el);
      return r.width > 20 && r.height > 16 && st.visibility !== 'hidden' && st.display !== 'none' && st.pointerEvents !== 'none' && st.opacity !== '0';
    };

    const roots = Array.from(document.querySelectorAll(${JSON.stringify(CASHOUT_CONFIRM_ROOT_SEL)})).filter(isVis);
    for (const root of roots) {
      const cBtns = Array.from(root.querySelectorAll('button, [role="button"], .m-btn, .af-button, [data-op*="confirm" i], [data-op*="cashout" i]')).filter((cb) => {
        if (!isVis(cb)) return false;
        if (cb.tagName !== 'BUTTON' && cb.querySelector('button, [role="button"]')) return false;
        const ct = norm(cb);
        if (!ct || ct.length > 44 || ct.includes('?')) return false;
        if (/\\b(cancel|close|back|partial|auto[\\s-]*cash|rule|how to|what is|learn|no)\\b/i.test(ct)) return false;
        return ct === 'confirm' || ct === 'confirm cashout' || ct === 'confirm cash out' ||
          ct === 'cashout' || ct === 'cash out' || /^confirm\\b/i.test(ct) || /^cash\\s*out\\b/i.test(ct);
      });
      if (cBtns.length > 0) {
        const cb = cBtns[cBtns.length - 1];
        const r = cb.getBoundingClientRect();
        try { cb.click(); } catch (_) {}
        return { clicked: true, label: norm(cb), x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
      }
    }
    return { clicked: false };
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

    const isVis = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
    };

    let modelVerified = false;

    // 1. Direct standard or hidden <input> / <textarea>
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
        if (inp.value === vStr) modelVerified = true;
      } catch (_) {}
    }

    // 2. Mobile custom display elements (SportyBet span.m-keybord-input & Football.com)
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
          modelVerified = true;
        } else {
          // Traverse Vue 2 and Vue 3 component hierarchy
          let cur = el;
          while (cur && cur !== document.documentElement) {
            // Vue 3 component inspection (__vueParentComponent or __vnode.component)
            const comp = cur.__vueParentComponent || cur.__vnode?.component || cur._vnode?.component;
            if (comp) {
              try { comp.emit('input', vStr); } catch (_) {}
              try { comp.emit('update:modelValue', vStr); } catch (_) {}
              try { comp.emit('change', vStr); } catch (_) {}

              const proxy = comp.proxy || comp.ctx || comp.setupState;
              if (proxy) {
                if (typeof proxy.changeSingleStake === 'function') {
                  try { proxy.changeSingleStake(vStr); modelVerified = true; } catch (_) {}
                }
                if (typeof proxy.changeMultipleStake === 'function') {
                  try { proxy.changeMultipleStake(vStr); modelVerified = true; } catch (_) {}
                }
                if (proxy.bet && proxy.bet.key && proxy.singleStake) {
                  try { proxy.singleStake[proxy.bet.key] = vStr; modelVerified = true; } catch (_) {}
                }
              }

              if (comp.parent) {
                const pProxy = comp.parent.proxy || comp.parent.ctx || comp.parent.setupState;
                if (pProxy) {
                  if (typeof pProxy.changeSingleStake === 'function') {
                    try { pProxy.changeSingleStake(vStr); modelVerified = true; } catch (_) {}
                  }
                  if (typeof pProxy.changeMultipleStake === 'function') {
                    try { pProxy.changeMultipleStake(vStr); modelVerified = true; } catch (_) {}
                  }
                  if (pProxy.bet && pProxy.bet.key && pProxy.singleStake) {
                    try { pProxy.singleStake[pProxy.bet.key] = vStr; modelVerified = true; } catch (_) {}
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
              if (typeof vm.$emit === 'function') {
                vm.$emit('input', vStr);
                vm.$emit('change', vStr);
              }
              if (vm.$store && typeof vm.$store.commit === 'function') {
                try { vm.$store.commit('betslip/updateStake', vStr); } catch (_) {}
                try { vm.$store.commit('betslip/setStake', vStr); } catch (_) {}
                try { vm.$store.commit('setStake', vStr); } catch (_) {}
              }
              modelVerified = true;
              break;
            }
            cur = cur.parentElement;
          }

          // Vue 3 global store commit
          const appEl = document.querySelector('#app');
          if (appEl && appEl.__vue_app__) {
            const globalStore = appEl.__vue_app__.config?.globalProperties?.$store;
            if (globalStore) {
              try {
                if (globalStore.state?.betslipStake?.singleStake) {
                  for (const k of Object.keys(globalStore.state.betslipStake.singleStake)) {
                    globalStore.state.betslipStake.singleStake[k] = vStr;
                    modelVerified = true;
                  }
                }
                if (globalStore.state?.betslipStake && 'multipleStake' in globalStore.state.betslipStake) {
                  globalStore.state.betslipStake.multipleStake = vStr;
                  modelVerified = true;
                }
              } catch (_) {}
            }
          }
        }

        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (_) {}
    }

    // 3. Instant in-DOM Keypad click sequence WITHOUT OS pointer events or delays
    // If the keypad container is mounted, click buttons synchronously in <1ms
    const kb = document.querySelector('div.stake-keyboard, [data-op="stake-keyboard"], div.m-keyboard, div.m-keybord, [class*="m-keyboard" i]');
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

const UPDATE_DEFAULT_STAKE_SELECTOR =
  '[data-op="betslip-keyboard-update-default"], .update-default-stake, [data-op="r-default-stake-cb"]';

const TOGGLE_UPDATE_DEFAULT_STAKE_JS = `
  (() => {
    try {
      const el = document.querySelector(${JSON.stringify(UPDATE_DEFAULT_STAKE_SELECTOR)});
      if (!el) return false;
      const cb = el.querySelector('input[type="checkbox"]');
      if (cb && cb.checked) return true;
      if (el.getAttribute('data-fs-checked') === 'true') return true;
      const icon = el.querySelector('.m-icon-check') || el;
      if (icon.classList.contains('m-icon-check--checked') || icon.classList.contains('checked')) return true;

      const target = el.querySelector('input[type="checkbox"], [data-op="r-default-stake-cb"], .m-icon-check, p, span') || el;
      const r = target.getBoundingClientRect();
      const pt = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, cancelable: true };
      target.dispatchEvent(new PointerEvent('pointerdown', pt));
      target.dispatchEvent(new MouseEvent('mousedown', pt));
      target.dispatchEvent(new MouseEvent('mouseup', pt));
      target.dispatchEvent(new MouseEvent('click', pt));
      return true;
    } catch (_) {
      return false;
    }
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

const CHECK_BETPAWA_UNAVAILABLE_JS = `
  (() => {
    try {
      const isVis = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
      };

      // ─── CRITERION 1: Banner Text ──────────────────────────────────────────
      // Must contain exact banner text: "Odds or availability have recently changed."
      const fullText = (document.body ? (document.body.innerText || document.body.textContent || '') : '').toLowerCase();
      const hasText = /odds\\s+or\\s+availability\\s+have\\s+recently\\s+changed/i.test(fullText);
      if (!hasText) {
        return { triggered: false, missing: 'banner-text' };
      }

      // ─── CRITERION 2: Red Border ───────────────────────────────────────────
      // Must match (#ef4444, rgb(239, 68, 68), rgb(220, 38, 38)) or dominant red border
      const isRedBorderColor = (colorStr) => {
        if (!colorStr) return false;
        let r = 0, g = 0, b = 0;
        const mRgb = colorStr.match(/rgba?\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)/i);
        if (mRgb) {
          r = parseInt(mRgb[1], 10);
          g = parseInt(mRgb[2], 10);
          b = parseInt(mRgb[3], 10);
        } else if (colorStr.startsWith('#')) {
          const hex = colorStr.slice(1);
          if (hex.length >= 6) {
            r = parseInt(hex.slice(0, 2), 16);
            g = parseInt(hex.slice(2, 4), 16);
            b = parseInt(hex.slice(4, 6), 16);
          }
        } else {
          return false;
        }
        // Dominant red matching #ef4444, rgb(239, 68, 68), rgb(220, 38, 38)
        return (r >= 200 && g <= 90 && b <= 90);
      };

      const slip = document.querySelector(
        '[class*="BetslipSidebar" i], [class*="betslip" i], [data-test-id*="betslip" i], aside, [class*="slip" i]'
      ) || document.body;

      if (!slip) return { triggered: false, missing: 'no-body' };

      let hasRedBorder = false;
      let cardEl = null;
      let detectedBorderColor = '';
      const elements = Array.from(slip.querySelectorAll('div, section, article, li, [class*="card" i], [class*="item" i], [class*="selection" i]')).filter(isVis);
      for (const el of elements) {
        const st = window.getComputedStyle(el);
        const bCol = st.borderColor || st.borderTopColor || '';
        const bWidth = parseFloat(st.borderWidth || st.borderTopWidth || '0');
        const cls = String(el.className || '').toLowerCase();

        if (
          (bWidth > 0 && isRedBorderColor(bCol)) ||
          cls.includes('border-red-500') ||
          cls.includes('border-red-600') ||
          cls.includes('border-[#ef4444]') ||
          cls.includes('border-[#dc2626]')
        ) {
          hasRedBorder = true;
          cardEl = el;
          detectedBorderColor = bCol || 'red-500';
          break;
        }
      }

      if (!hasRedBorder) {
        return { triggered: false, missing: 'red-border' };
      }

      // ─── CRITERION 3: Status Icon ──────────────────────────────────────────
      // Must contain status wave/pulse/heartbeat icon in betslip card
      const searchScope = cardEl || slip;
      const isAmberOrOrangeOrRed = (c) => {
        if (!c) return false;
        const m = c.match(/rgba?\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)/i);
        if (m) {
          const r = parseInt(m[1], 10), g = parseInt(m[2], 10), b = parseInt(m[3], 10);
          return (r >= 180 && g >= 50 && g <= 200 && b <= 70) || (r >= 180 && g <= 80 && b <= 80);
        }
        if (c.startsWith('#')) {
          const hex = c.slice(1);
          if (hex.length >= 6) {
            const r = parseInt(hex.slice(0, 2), 16);
            const g = parseInt(hex.slice(2, 4), 16);
            const b = parseInt(hex.slice(4, 6), 16);
            return (r >= 180 && g >= 50 && g <= 200 && b <= 70) || (r >= 180 && g <= 80 && b <= 80);
          }
        }
        return false;
      };

      const icons = Array.from(searchScope.querySelectorAll('svg, path, [class*="icon" i], [class*="pulse" i], [class*="status" i]')).filter(isVis);
      let hasStatusIcon = false;
      let iconDetail = '';

      for (const ic of icons) {
        const cls = String(ic.className || ic.getAttribute('class') || '').toLowerCase();
        const aria = String(ic.getAttribute('aria-label') || '').toLowerCase();
        const testId = String(ic.getAttribute('data-test-id') || '').toLowerCase();
        const st = window.getComputedStyle(ic);
        const stroke = ic.getAttribute('stroke') || st.stroke || '';
        const fill = ic.getAttribute('fill') || st.fill || '';
        const color = st.color || '';

        // Class / aria / testId indicating pulse / status / activity / heartbeat
        if (
          cls.includes('pulse') || cls.includes('heartbeat') || cls.includes('activity') ||
          cls.includes('wave') || cls.includes('status') || cls.includes('indicator') ||
          cls.includes('warning') || cls.includes('changed') ||
          aria.includes('pulse') || aria.includes('status') || aria.includes('warning') || aria.includes('change') ||
          testId.includes('pulse') || testId.includes('status') || testId.includes('warning')
        ) {
          hasStatusIcon = true;
          iconDetail = cls || aria || testId;
          break;
        }

        // Amber/orange/red colored icon
        if (isAmberOrOrangeOrRed(stroke) || isAmberOrOrangeOrRed(fill) || isAmberOrOrangeOrRed(color)) {
          hasStatusIcon = true;
          iconDetail = 'colored-icon:' + (stroke || fill || color);
          break;
        }

        // SVG pulse / wave line inside card (not close/remove button)
        if (ic.tagName === 'svg' || ic.tagName === 'SVG') {
          if (!cls.includes('close') && !cls.includes('remove') && !cls.includes('delete') && !aria.includes('close') && !aria.includes('remove')) {
            hasStatusIcon = true;
            iconDetail = 'card-svg-status';
            break;
          }
        }
      }

      if (!hasStatusIcon) {
        return { triggered: false, missing: 'status-icon' };
      }

      // ─── ALL 3 CRITERIA MET SIMULTANEOUSLY ─────────────────────────────────
      return {
        triggered: true,
        match: \`All 3 Criteria Met: [Text: "Odds or availability have recently changed."] + [Border: \${detectedBorderColor}] + [Icon: \${iconDetail}]\`
      };
    } catch (e) {
      return { triggered: false, error: e.message };
    }
  })()
`;

const HIGHLIGHT_BETANO_OPTIONS_JS = `
  (() => {
    try {
      const styleId = '__betano_highlight_styles';
      if (!document.getElementById(styleId)) {
        const st = document.createElement('style');
        st.id = styleId;
        st.textContent = \`
          [data-qa="event-selection"],
          [data-qa="market-outcome"],
          .selections__selection,
          [class*="selection-horizontal-button"],
          [class*="event-selection"],
          [class*="market-outcome"] {
            border: 2.5px solid #f59e0b !important;
            box-shadow: 0 0 12px rgba(245, 158, 11, 0.7) !important;
            background: rgba(245, 158, 11, 0.14) !important;
            border-radius: 4px !important;
            transition: all 0.2s ease !important;
          }
        \`;
        document.head.appendChild(st);
      }
      const items = document.querySelectorAll(
        '[data-qa="event-selection"], [data-qa="market-outcome"], .selections__selection, [class*="selection-horizontal-button"]'
      );
      return { ok: true, count: items.length };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  })()
`;

const HIGHLIGHT_BETPAWA_NEXT_GOAL_JS = `
  (() => {
    try {
      const styleId = '__betpawa_nextgoal_styles';
      if (!document.getElementById(styleId)) {
        const st = document.createElement('style');
        st.id = styleId;
        st.textContent = \`
          .__pawa_next_goal_highlight {
            border: 2.5px solid #10b981 !important;
            box-shadow: 0 0 14px #10b981, 0 0 24px rgba(16, 185, 129, 0.4) !important;
            background: rgba(16, 185, 129, 0.15) !important;
            border-radius: 6px !important;
            position: relative !important;
            animation: pulsePawaNextGoal 1.2s infinite alternate !important;
          }
          @keyframes pulsePawaNextGoal {
            from { box-shadow: 0 0 8px #10b981; }
            to { box-shadow: 0 0 18px #10b981, 0 0 24px rgba(16, 185, 129, 0.5); }
          }
          .__pawa_next_goal_badge {
            position: absolute !important;
            top: -10px !important;
            right: 8px !important;
            background: #10b981 !important;
            color: #ffffff !important;
            font-weight: 800 !important;
            font-size: 10px !important;
            padding: 1px 6px !important;
            border-radius: 4px !important;
            z-index: 1000 !important;
            pointer-events: none !important;
            letter-spacing: 0.5px !important;
          }
        \`;
        document.head.appendChild(st);
      }

      // Find Next Goal market card or row
      const containers = Array.from(document.querySelectorAll('div, section, [class*="market" i], [class*="card" i]'));
      let targetContainer = null;
      for (const el of containers) {
        const text = (el.innerText || el.textContent || '').trim();
        if (/\\b(next\\s*goal|goal\\s*\\d+|who\\s*scores?\\s*next|team\\s*to\\s*score)\\b/i.test(text)) {
          const btns = el.querySelectorAll('button, [role="button"], [class*="selection" i], [class*="odd" i]');
          if (btns.length >= 2) {
            targetContainer = el;
            break;
          }
        }
      }

      if (targetContainer) {
        targetContainer.classList.add('__pawa_next_goal_highlight');
        if (!targetContainer.querySelector('.__pawa_next_goal_badge')) {
          const badge = document.createElement('span');
          badge.className = '__pawa_next_goal_badge';
          badge.textContent = 'NEXT GOAL';
          targetContainer.appendChild(badge);
        }
        try { targetContainer.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
        return { ok: true, found: 'container' };
      }

      // Fallback: look for individual selection buttons
      const btns = Array.from(document.querySelectorAll('button, [role="button"], [class*="selection" i]')).filter((b) => {
        const t = (b.innerText || b.textContent || '').toLowerCase();
        const a = (b.getAttribute('aria-label') || '').toLowerCase();
        return /next\\s*goal/i.test(t) || /next\\s*goal/i.test(a);
      });
      if (btns.length > 0) {
        btns.forEach((b) => b.classList.add('__pawa_next_goal_highlight'));
        try { btns[0].scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
        return { ok: true, found: 'buttons', count: btns.length };
      }
      return { ok: false, reason: 'not-found' };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  })()
`;

const SELECT_BETPAWA_NEXT_GOAL_AND_OPEN_SLIP_JS = `
  (async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const isVis = (el) => {
      if (!el || el.disabled) return false;
      const r = el.getBoundingClientRect();
      const st = window.getComputedStyle(el);
      return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
    };

    const simulateMouseClick = (target) => {
      if (!target) return false;
      try { target.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (_) {}
      const r = target.getBoundingClientRect();
      const cx = Math.round(r.left + r.width / 2);
      const cy = Math.round(r.top + r.height / 2);
      const ev = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, button: 0 };
      try {
        target.dispatchEvent(new PointerEvent('pointerdown', ev));
        target.dispatchEvent(new MouseEvent('mousedown', ev));
        target.dispatchEvent(new PointerEvent('pointerup', ev));
        target.dispatchEvent(new MouseEvent('mouseup', ev));
      } catch (_) {}
      target.click();
      return true;
    };

    // 1. Locate the Next Goal market container (poll up to 3.5s for dynamic load)
    let nextGoalContainer = null;
    let optionBtns = [];

    for (let attempt = 0; attempt < 35; attempt++) {
      const containers = Array.from(document.querySelectorAll('div, section, article, [class*="market" i], [class*="card" i]')).filter(isVis);
      for (const el of containers) {
        const text = (el.innerText || el.textContent || '').trim();
        if (/\\b(next\\s*goal|goal\\s*\\d+|who\\s*scores?\\s*next|team\\s*to\\s*score)\\b/i.test(text)) {
          const btns = Array.from(el.querySelectorAll('button, [role="button"], [class*="selection" i], [class*="odd" i]')).filter(isVis);
          if (btns.length >= 2) {
            nextGoalContainer = el;
            optionBtns = btns;
            break;
          }
        }
      }
      if (nextGoalContainer && optionBtns.length >= 2) break;
      await wait(100);
    }

    if (!nextGoalContainer || optionBtns.length === 0) {
      // Fallback: look for buttons with aria-label or text containing next goal
      const allBtns = Array.from(document.querySelectorAll('button, [role="button"], [class*="selection" i]')).filter(isVis);
      optionBtns = allBtns.filter((b) => {
        const t = (b.innerText || b.textContent || '').toLowerCase();
        const a = (b.getAttribute('aria-label') || '').toLowerCase();
        return /next\\s*goal/i.test(t) || /next\\s*goal/i.test(a);
      });
    }

    if (optionBtns.length > 0) {
      // Check if an option is ALREADY selected
      const alreadySelected = optionBtns.find(b => {
        const cls = String(b.className || '').toLowerCase();
        return b.getAttribute('aria-pressed') === 'true' || b.getAttribute('aria-selected') === 'true' ||
          cls.includes('selected') || cls.includes('active') || cls.includes('highlight');
      });

      if (!alreadySelected) {
        // Pick Option 2 if available (e.g. Away team or Goal 4 - 2 as shown in screenshot), else Option 1
        const pickTarget = optionBtns.length >= 3 ? optionBtns[2] : (optionBtns[1] || optionBtns[0]);
        simulateMouseClick(pickTarget);
        await wait(280);
      }
    }

    // 2. Open up Betslip in the bottom navigation
    const isSlipOpen = () => {
      const slip = document.querySelector('[class*="BetslipSidebar" i], [class*="betslip" i], [data-test-id*="betslip" i], aside');
      if (!slip) return false;
      const r = slip.getBoundingClientRect();
      return r.width > 120 && r.height > 200 && window.getComputedStyle(slip).visibility !== 'hidden';
    };

    if (isSlipOpen()) {
      return { ok: true, status: 'slip-already-open' };
    }

    // Find Betslip button in bottom nav bar
    for (let attempt = 0; attempt < 20; attempt++) {
      const bottomNav = document.querySelector('nav, [class*="bottom-nav" i], [class*="footer" i], [class*="bottom-bar" i], footer') || document;
      const navCandidates = Array.from(bottomNav.querySelectorAll('button, a, [role="tab"], [role="button"], div, span')).filter(isVis);

      const betslipBtn = navCandidates.find(el => {
        const t = (el.innerText || el.textContent || '').trim().toLowerCase();
        const h = (el.getAttribute('href') || '').toLowerCase();
        const op = (el.getAttribute('data-op') || '').toLowerCase();
        const testId = (el.getAttribute('data-test-id') || '').toLowerCase();
        const cls = String(el.className || '').toLowerCase();
        return (
          t === 'betslip' || t.startsWith('betslip') || h.includes('betslip') ||
          op.includes('betslip') || testId.includes('betslip') || cls.includes('betslip')
        );
      });

      if (betslipBtn) {
        simulateMouseClick(betslipBtn);
        await wait(200);
        if (isSlipOpen()) {
          return { ok: true, status: 'betslip-opened' };
        }
      }
      await wait(100);
    }

    return { ok: true, status: 'option-clicked-open-attempted' };
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
  KEYBOARD_CONTAINER_SELECTOR,
  UPDATE_DEFAULT_STAKE_SELECTOR,
  TOGGLE_UPDATE_DEFAULT_STAKE_JS,
  MONITOR_URLS,
  CHECK_BETPAWA_UNAVAILABLE_JS,
  HIGHLIGHT_BETANO_OPTIONS_JS,
  HIGHLIGHT_BETPAWA_NEXT_GOAL_JS,
  SELECT_BETPAWA_NEXT_GOAL_AND_OPEN_SLIP_JS,
  oddsReadCode,
  readFieldCode,
  PLACE_BET_JS,
  CLICK_ANY_CONFIRM_JS,
  REBET_JS,
  FAST_REBET_CYCLE_JS,
  EXECUTE_ATTACK_CYCLE_JS,
  NAV_OPEN_BETS_JS,
  PREPARE_CASHOUT_CLICK_JS,
  FIND_CASHOUT_CONFIRM_JS,
  CLICK_CASHOUT_CONFIRM_JS,
  FAST_SET_STAKE_JS,
  loginCode,
};

