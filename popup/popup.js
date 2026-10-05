import { ACHIEVEMENTS } from '../achievements.js';

const $ = (id) => document.getElementById(id);
const num = new Intl.NumberFormat('en-GB');
const date = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const TOP = 5;

// A guided meditation that has read the privacy policy.
const QUIPS = {
  some: [
    'Breathe in. Breathe out. They\'re still trying.',
    'Let go of attachment. Especially the third-party kind.',
    'Observe the trackers without judgement. Then block them.',
    'Notice the urge to buy something. Let it pass. It was never yours.',
    'Be present. Nobody else is allowed to be.',
    'You are not the product. Today, at least.',
    'Release what no longer serves you. It was serving someone else.',
  ],
  none: [
    'Stillness. Suspicious, but stillness.',
    'Nothing to let go of. Enjoy it, it won\'t last.',
  ],
  internal: [
    'This page is beyond our practice.',
  ],
  paused: [
    'Paused here. Let them watch, briefly.',
    'Acceptance is also a practice.',
  ],
};

const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

let host = null;
try {
  const u = new URL(tab.url);
  if (u.protocol === 'http:' || u.protocol === 'https:') host = u.hostname.replace(/^www\./, '');
} catch { /* no URL, e.g. new tab */ }

$('host').textContent = host ?? 'Browser page';
if (host) {
  const fav = new URL(chrome.runtime.getURL('/_favicon/'));
  fav.searchParams.set('pageUrl', tab.url);
  fav.searchParams.set('size', '32');
  $('favicon').src = fav.href;
  $('favicon').onerror = () => $('favicon').remove();
} else {
  $('favicon').remove();
}

const { page, totals, paused, lists, achievements } = await chrome.runtime.sendMessage({ type: 'stats', tabId: tab.id });
const isPaused = !!host && paused.some((p) => host === p || host.endsWith('.' + p));
document.body.classList.toggle('is-paused', isPaused);

// Pause / resume on this site, then reload so the change takes effect.
if (host) {
  const btn = $('pause');
  btn.textContent = isPaused ? 'Resume' : 'Pause here';
  btn.title = isPaused ? `Start blocking on ${host} again` : `Stop blocking on ${host}`;
  btn.hidden = false;
  btn.onclick = async () => {
    btn.disabled = true;
    const target = isPaused ? paused.find((p) => host === p || host.endsWith('.' + p)) : host;
    const res = await chrome.runtime.sendMessage({ type: 'pause', host: target, on: !isPaused });
    if (!res?.ok) { btn.disabled = false; btn.textContent = 'Failed, try again'; return; }
    chrome.tabs.reload(tab.id);
    window.close();
  };
}

// This page
const pageTotal = page.network + page.youtube;
$('count').textContent = num.format(pageTotal);
$('quip').textContent = pick(!host ? QUIPS.internal : isPaused ? QUIPS.paused : pageTotal ? QUIPS.some : QUIPS.none);

const rows = Object.entries(page.byBlocked);
if (page.youtube) rows.push(['YouTube ads', page.youtube]);
rows.sort((a, b) => b[1] - a[1]);
const max = rows[0]?.[1] ?? 1; // each row gets a faint bar relative to the biggest

if (rows.length) {
  for (const [name, n] of rows.slice(0, TOP)) {
    const li = document.createElement('li');
    li.innerHTML = '<span class="name"></span><span class="n"></span>';
    li.querySelector('.name').textContent = name;
    li.querySelector('.name').title = name;
    li.querySelector('.n').textContent = num.format(n);
    li.style.setProperty('--w', `${Math.max(4, (n / max) * 100)}%`);
    $('list').append(li);
  }
  if (rows.length > TOP) {
    const extra = rows.length - TOP;
    $('more').textContent = `and ${extra} more ${extra === 1 ? 'attachment' : 'attachments'}`;
    $('more').hidden = false;
  }
  $('released').hidden = false;
}

// Since install
$('total').textContent = num.format(totals.network + totals.youtube);
$('since').textContent = date.format(totals.since);
if (totals.youtube) {
  $('total-yt').textContent = `${num.format(totals.youtube)} YouTube ads among them. None were urgent.`;
  $('total-yt').hidden = false;
}

if (lists) {
  const n = lists.rules ? `${num.format(lists.rules)} rules from ${lists.sources?.length ?? 1} lists` : `${num.format(lists.domains)} domains`;
  const days = Math.floor((Date.now() - lists.updated) / 864e5);
  const ago = days < 1 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
  $('lists').textContent = `${n} · refreshed ${ago}`;
  $('lists').title = lists.sources?.join(', ') ?? '';
  $('lists').hidden = false;
}

// Achievements: newly unlocked ones appear once, then count as seen.
const MAX_CARDS = 3;
const unseen = achievements.unseen.map((id) => ({ id, ...achievements.unlocked[id] })).filter((a) => a.title);
for (const a of unseen.slice(-MAX_CARDS).reverse()) {
  const card = document.createElement('div');
  card.className = 'ach';
  card.innerHTML = `
    <img src="../icons/icon32.png" width="18" height="18" alt="">
    <div class="ach-body">
      <p class="ach-eyebrow">Milestone reached</p>
      <p class="ach-title"></p>
      <p class="ach-quip"></p>
    </div>
    <button class="ach-close" type="button" aria-label="Dismiss">&times;</button>`;
  card.querySelector('.ach-title').textContent = a.title;
  card.querySelector('.ach-quip').textContent = a.quip;
  card.querySelector('.ach-close').onclick = () => card.remove();
  $('unlocked').append(card);
}
if (unseen.length > MAX_CARDS) {
  const more = document.createElement('p');
  more.className = 'fine';
  more.textContent = `and ${unseen.length - MAX_CARDS} more below, under milestones`;
  $('unlocked').append(more);
}
if (unseen.length) chrome.runtime.sendMessage({ type: 'seen' });

// Milestones list: unlocked with their line, locked by name only.
const done = ACHIEVEMENTS.filter((a) => achievements.unlocked[a.id]);
$('milestones-label').textContent = `${done.length} of ${ACHIEVEMENTS.length} milestones`;
$('beads').append(...ACHIEVEMENTS.map((_, i) => Object.assign(document.createElement('i'), { className: i < done.length ? 'on' : '' })));
for (const a of ACHIEVEMENTS) {
  const got = achievements.unlocked[a.id];
  const li = document.createElement('li');
  if (got) {
    li.className = 'done';
    li.innerHTML = '<span class="t"></span><br><span class="q"></span>';
    li.querySelector('.t').textContent = got.title;
    li.querySelector('.q').textContent = got.quip;
  } else {
    li.className = 'todo';
    li.textContent = `${a.locked} - not yet`;
  }
  $('milestone-list').append(li);
}
