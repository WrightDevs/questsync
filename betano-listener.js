'use strict';

function extractBetanoMatchKey(rawUrl) {
  try {
    const u = new URL(String(rawUrl || ''));
    const parts = u.pathname.split('/').filter(Boolean);
    for (let i = parts.length - 1; i >= 0; i--) {
      if (/^\d{4,14}$/.test(parts[i])) return `ev:${parts[i]}`;
    }
    return `path:${u.pathname}`;
  } catch (_) {
    return String(rawUrl || '').split(/[?#]/)[0] || 'unknown';
  }
}

function parseScorePair(scoreStr) {
  const m = /^(\d{1,3})\s*[-–—]\s*(\d{1,3})$/.exec(String(scoreStr || '').trim());
  if (!m) return null;
  const home = parseInt(m[1], 10);
  const away = parseInt(m[2], 10);
  if (Number.isNaN(home) || Number.isNaN(away)) return null;
  return {
    home,
    away,
    total: home + away,
    text: `${home} - ${away}`,
  };
}

function classifyScoreTransition(prevScore, nextScore) {
  const n = parseScorePair(nextScore);
  if (!n) return { type: 'invalid' };
  if (!prevScore) {
    return { type: 'baseline', next: n.text, home: n.home, away: n.away, total: n.total };
  }
  const p = parseScorePair(prevScore);
  if (!p) {
    return { type: 'baseline', next: n.text, home: n.home, away: n.away, total: n.total };
  }
  if (p.home === n.home && p.away === n.away) {
    return { type: 'noop', prev: p.text, next: n.text };
  }
  const deltaTotal = n.total - p.total;
  if (deltaTotal > 0 && n.home >= p.home && n.away >= p.away) {
    return {
      type: 'goal',
      prev: p.text,
      next: n.text,
      prevTotal: p.total,
      nextTotal: n.total,
      homeDelta: n.home - p.home,
      awayDelta: n.away - p.away,
    };
  }
  if (deltaTotal < 0 && (n.home < p.home || n.away < p.away)) {
    return {
      type: 'drop',
      prev: p.text,
      next: n.text,
      prevTotal: p.total,
      nextTotal: n.total,
      homeDelta: n.home - p.home,
      awayDelta: n.away - p.away,
    };
  }
  return {
    type: 'correction',
    prev: p.text,
    next: n.text,
    prevTotal: p.total,
    nextTotal: n.total,
  };
}

function createBetanoGoalTracker() {
  const seenTransitions = new Map(); // Map<matchKey, Set<"prev->next">>

  function handleTransition(matchKey, prevScore, nextScore) {
    const cls = classifyScoreTransition(prevScore, nextScore);
    if (cls.type === 'goal') {
      const key = `${cls.prev}->${cls.next}`;
      let set = seenTransitions.get(matchKey);
      if (!set) {
        set = new Set();
        seenTransitions.set(matchKey, set);
      }
      if (set.has(key)) {
        return { action: 'duplicate-goal', shouldFireBet: false, shouldCashout: false, transition: cls };
      }
      set.add(key);
      return { action: 'goal', shouldFireBet: true, shouldCashout: false, transition: cls };
    }

    if (cls.type === 'drop') {
      const set = seenTransitions.get(matchKey);
      let rearmedCount = 0;
      if (set && set.size > 0) {
        for (const entry of Array.from(set)) {
          const arrowIdx = entry.indexOf('->');
          const toScoreStr = arrowIdx >= 0 ? entry.slice(arrowIdx + 2) : '';
          const toPair = parseScorePair(toScoreStr);
          // Re-arm any previously fired goal whose score was disallowed (higher than current dropped score)
          if (!toPair || toPair.total > cls.nextTotal || entry.endsWith(`->${cls.prev}`)) {
            set.delete(entry);
            rearmedCount++;
          }
        }
      }
      return {
        action: 'drop',
        shouldFireBet: false,
        shouldCashout: true,
        rearmedCount,
        transition: cls,
      };
    }

    return { action: cls.type, shouldFireBet: false, shouldCashout: false, transition: cls };
  }

  function resetMatch(matchKey) {
    if (matchKey) seenTransitions.delete(matchKey);
    else seenTransitions.clear();
  }

  return {
    handleTransition,
    resetMatch,
    _seenTransitions: seenTransitions,
  };
}

module.exports = {
  extractBetanoMatchKey,
  parseScorePair,
  classifyScoreTransition,
  createBetanoGoalTracker,
};
