// Anti-achievements. test(state) returns falsy, true, or a params object used in title/quip.
// state = { totals, page?: { total, site }, paused: number }
const fmt = (n) => new Intl.NumberFormat('en-GB').format(n);
const all = (s) => s.totals.network + s.totals.youtube;

export const ACHIEVEMENTS = [
  { id: 'blocked-1k', locked: '1,000 blocked',
    test: (s) => all(s) >= 1000,
    title: () => '1,000 blocked', quip: () => 'You have achieved nothing. Correctly.' },
  { id: 'blocked-10k', locked: '10,000 blocked',
    test: (s) => all(s) >= 10000,
    title: () => '10,000 blocked', quip: () => 'Ten thousand attachments released. The tabs remain.' },
  { id: 'blocked-100k', locked: '100,000 blocked',
    test: (s) => all(s) >= 100000,
    title: () => '100,000 blocked', quip: () => 'Enlightenment remains unavailable. So do the ads.' },
  { id: 'youtube-1', locked: 'First YouTube ad',
    test: (s) => s.totals.youtube >= 1,
    title: () => 'First YouTube ad gone', quip: () => "Five seconds of your life, returned. Use them wisely. You won't." },
  { id: 'youtube-100', locked: '100 YouTube ads',
    test: (s) => s.totals.youtube >= 100,
    title: () => '100 YouTube ads', quip: () => 'Not one of them was urgent.' },
  { id: 'stubborn', locked: 'The persistent one',
    test: (s) => { const e = Object.entries(s.totals.byBlocked).find(([, n]) => n >= 500); return e && { domain: e[0] }; },
    title: (p) => `${p.domain}, ${fmt(500)} times`, quip: (p) => `${p.domain} does not take no for an answer. Neither do you.` },
  { id: 'neighbourhood', locked: 'Bad neighbourhood',
    test: (s) => s.page && s.page.total >= 50 && s.page.site && { site: s.page.site },
    title: () => '50 on one page', quip: (p) => `${p.site}: the worst neighbourhood on the internet. So far.` },
  { id: 'everywhere', locked: '100 sites',
    test: (s) => Object.keys(s.totals.bySite).length >= 100,
    title: () => 'Blocked on 100 sites', quip: () => 'Everywhere you go, someone is watching. Not today.' },
  { id: 'first-pause', locked: 'First pause',
    test: (s) => s.paused >= 1,
    title: () => 'First pause', quip: () => 'Even monks compromise.' },
];
