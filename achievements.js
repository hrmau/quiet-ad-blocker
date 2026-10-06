// Anti-achievements, grouped into categories with tiers. Shared by background and popup.
// state = { totals, now }; totals as stored by background.js (older installs may lack bestPage/pauses/opens).
// Each category: measure(state) -> { n, ...params }. A tier unlocks once n reaches it.
// unit (optional) labels the progress count in the popup. Text templates fill {n} (formatted tier) and any params, e.g. {site}, {domain}.
const fmt = (n) => new Intl.NumberFormat('en-GB').format(n);
const short = (n) => (n >= 1e6 ? `${n / 1e6}m` : n >= 1e3 ? `${n / 1e3}k` : String(n));
const top = (obj = {}) => Object.entries(obj).reduce((best, e) => (e[1] > best[1] ? e : best), [null, 0]);
const fill = (s, p) => s.replace(/\{(\w+)\}/g, (_, k) => p[k] ?? '');

export const CATEGORIES = [
  {
    id: 'blocked', name: 'Letting go',
    measure: (s) => ({ n: s.totals.network + s.totals.youtube }),
    title: '{n} blocked',
    tiers: {
      10: 'The first few. They will not be missed.',
      100: 'A hundred small attachments, released.',
      1000: 'You have achieved nothing. Correctly.',
      10000: 'Ten thousand attachments released. The tabs remain.',
      100000: 'Enlightenment remains unavailable. So do the ads.',
      1000000: 'A million. Somewhere, a quarterly forecast is revised downwards.',
    },
  },
  {
    id: 'youtube', name: 'YouTube',
    measure: (s) => ({ n: s.totals.youtube }),
    title: '{n} YouTube ads', names: { 1: 'First YouTube ad gone' },
    tiers: {
      1: "Five seconds of your life, returned. Use them wisely. You won't.",
      10: 'Ten fewer reasons to hover over Skip.',
      100: 'Not one of them was urgent.',
      1000: 'Roughly a working day of adverts, returned. Spent on YouTube.',
      10000: 'You have now watched less advertising than anyone you know. Probably.',
    },
  },
  {
    id: 'page', name: 'Bad neighbourhoods',
    measure: (s) => ({ n: s.totals.bestPage?.n ?? 0, site: s.totals.bestPage?.site ?? 'One site' }),
    title: '{n} on one page',
    tiers: {
      5: '{site} tried five things at once. Gently, no.',
      10: '{site}: ten hands in your pockets.',
      50: '{site}: the worst neighbourhood on the internet. So far.',
      100: '{site} sent a hundred. One would have been plenty. None, ideally.',
      250: '{site}. Two hundred and fifty. Consider a book.',
    },
  },
  {
    id: 'pauses', name: 'Compromise',
    measure: (s) => ({ n: s.totals.pauses ?? 0 }),
    title: '{n} pauses', names: { 1: 'First pause' },
    tiers: {
      1: 'Even monks compromise.',
      5: 'Five times you let them watch. Acceptance is a practice.',
      10: 'Ten pauses. Flexible is a kind of strong. Allegedly.',
      100: "A hundred pauses. At this point it's a relationship.",
    },
  },
  {
    id: 'sites', name: 'Everywhere',
    measure: (s) => ({ n: Object.keys(s.totals.bySite ?? {}).length }),
    title: 'Blocked on {n} sites',
    tiers: {
      10: 'Ten sites in, and every one of them was watching.',
      100: 'Everywhere you go, someone is watching. Not today.',
      1000: 'A thousand sites. The internet is mostly surveillance with articles attached.',
      5000: 'Five thousand sites. You have seen the internet. It has seen rather less of you.',
    },
  },
  {
    id: 'persistent', name: 'The persistent ones',
    measure: (s) => { const [domain, n] = top(s.totals.byBlocked); return { n, domain: domain ?? 'A domain' }; },
    title: '{domain}, {n} times', locked: 'One domain, {n} times',
    tiers: {
      100: '{domain} has asked a hundred times. The answer remains no.',
      500: '{domain} does not take no for an answer. Neither do you.',
      1000: '{domain}, a thousand times. Admirable, in a bleak way.',
      10000: "{domain}: ten thousand attempts. This isn't business any more. It's devotion.",
    },
  },
  {
    id: 'days', name: 'Practice', unit: 'days',
    measure: (s) => ({ n: Math.max(0, Math.floor((s.now - s.totals.since) / 864e5)) }),
    title: '{n} days', names: { 7: 'A week', 30: 'A month', 365: 'A year' },
    tiers: {
      7: 'A week of practice. The ads have noticed nothing.',
      30: 'A month. Habits form. Theirs, mostly.',
      100: 'A hundred days of not being the product.',
      365: 'A year. The trackers have aged. You have not. Much.',
    },
  },
  {
    id: 'opens', name: 'Checking in',
    measure: (s) => ({ n: s.totals.opens ?? 0 }),
    title: 'Checked in {n} times',
    tiers: {
      10: 'You keep checking. They keep trying. Balance.',
      100: 'A hundred check-ins. The count is fine. You can stop looking.',
      1000: 'A thousand check-ins. This is your meditation now.',
    },
  },
];

export const TOTAL = CATEGORIES.reduce((n, c) => n + Object.keys(c.tiers).length, 0);
export const tierId = (cat, t) => `${cat.id}-${short(t)}`;
export const formatN = fmt;

// Pre-category ids -> current ids. (blocked-1k/10k/100k, youtube-1/100 kept their names.)
export const LEGACY = { stubborn: 'persistent-500', neighbourhood: 'page-50', everywhere: 'sites-100', 'first-pause': 'pauses-1' };

const tiersOf = (cat) => Object.keys(cat.tiers).map(Number).sort((a, b) => a - b);
const nameOf = (cat, t, p, unlocked = true) =>
  cat.names?.[t] ?? fill(!unlocked && cat.locked ? cat.locked : cat.title, { ...p, n: fmt(t) });

// Newly reached tiers, not yet in `unlocked`: [{ id, cat, tier, title, quip }].
export function newlyReached(state, unlocked) {
  const out = [];
  for (const cat of CATEGORIES) {
    const p = cat.measure(state);
    for (const t of tiersOf(cat)) {
      const id = tierId(cat, t);
      if (p.n >= t && !unlocked[id]) out.push({ id, cat: cat.id, tier: t, title: nameOf(cat, t, p), quip: fill(cat.tiers[t], p) });
    }
  }
  return out;
}

// For the popup: per-category progress and each tier's state.
export function progress(cat, state, unlocked) {
  const p = cat.measure(state);
  const ts = tiersOf(cat);
  const done = ts.filter((t) => unlocked[tierId(cat, t)]).length;
  const next = ts.find((t) => p.n < t) ?? null;
  const prev = [...ts].reverse().find((t) => p.n >= t) ?? 0;
  const frac = next == null ? 1 : (p.n - prev) / (next - prev);
  const tiers = ts.map((t) => {
    const got = unlocked[tierId(cat, t)];
    return got ? { state: 'done', title: got.title, quip: got.quip }
      : { state: t === next ? 'next' : 'later', title: nameOf(cat, t, p, false), toGo: t - p.n };
  });
  return { n: p.n, next, done, count: ts.length, frac: Math.max(0, Math.min(1, frac)), tiers };
}
