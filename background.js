import { ENDPOINT, SYNC_MINUTES, INCLUDE_SITES } from './config.js';
import { SOURCES, ALLOW_BASE, PAUSE_ID, parseAllowlist, buildRules } from './lists.js';
import { ACHIEVEMENTS } from './achievements.js';

// Data model
//   storage.session  tab:<id>     = { network, youtube, byBlocked: {host: n}, site }  - current page
//   storage.local    totals       = { since, network, youtube, byBlocked, bySite }   - since install
//                    paused       = [host, ...]
//                    lists        = { updated, rules, domains, sources: [name] }
//                    achievements = { unlocked: { id: { at, title, quip } }, unseen: [id] }
//                    installId    = random UUID (only used for server sync)
// Rule IDs (static and dynamic): < ALLOW_BASE block, >= ALLOW_BASE allow, PAUSE_ID = paused sites.

const LIST_REFRESH_MINUTES = 7 * 24 * 60;
const LIST_RETRY_MINUTES = 60;
const DNR = chrome.declarativeNetRequest;
const ICON = { 16: 'icons/icon16.png', 32: 'icons/icon32.png' };
const ICON_DOT = { 16: 'icons/icon16-dot.png', 32: 'icons/icon32-dot.png' };

const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return null; } };
const bump = (obj, key, n = 1) => { if (key) obj[key] = (obj[key] || 0) + n; };
const merge = (into, from) => { for (const [k, n] of Object.entries(from)) bump(into, k, n); };
const emptyPage = () => ({ network: 0, youtube: 0, byBlocked: {}, site: null });
const emptyTotals = () => ({ since: Date.now(), network: 0, youtube: 0, byBlocked: {}, bySite: {} });
const badge = (n) => (n === 0 ? '' : n < 1000 ? String(n) : `${Math.floor(n / 1000)}k`);

// All storage and rule writes go through one queue so read-modify-write cycles never overlap.
let queue = Promise.resolve();
const serial = (fn) => (queue = queue.then(fn).catch((e) => console.error('[quiet]', e)));

// --- Counting --------------------------------------------------------------

let pending = { tabs: new Map(), totals: emptyTotals() };
let timer = null;

function record(tabId, site, kind, blockedHost, isTopFrame = false) {
  if (tabId >= 0) {
    if (!pending.tabs.has(tabId)) pending.tabs.set(tabId, emptyPage());
    const t = pending.tabs.get(tabId);
    t[kind]++;
    bump(t.byBlocked, blockedHost);
    if (isTopFrame && site) t.site = site;
  }
  const T = pending.totals;
  T[kind]++;
  bump(T.byBlocked, blockedHost);
  bump(T.bySite, site);
  if (!timer) timer = setTimeout(() => { timer = null; serial(flush); }, 750);
}

async function flush() {
  const { tabs, totals: add } = pending;
  pending = { tabs: new Map(), totals: emptyTotals() };
  const pages = [];

  if (tabs.size) {
    const keys = [...tabs.keys()].map((id) => `tab:${id}`);
    const current = await chrome.storage.session.get(keys);
    const out = {};
    for (const [id, d] of tabs) {
      const p = current[`tab:${id}`] ?? emptyPage();
      p.network += d.network;
      p.youtube += d.youtube;
      p.site = d.site ?? p.site;
      merge(p.byBlocked, d.byBlocked);
      out[`tab:${id}`] = p;
      pages.push({ total: p.network + p.youtube, site: p.site });
      chrome.action.setBadgeText({ tabId: id, text: badge(p.network + p.youtube) }).catch(() => {});
    }
    await chrome.storage.session.set(out);
  }

  if (add.network || add.youtube) {
    const { totals = emptyTotals() } = await chrome.storage.local.get('totals');
    totals.network += add.network;
    totals.youtube += add.youtube;
    merge(totals.byBlocked, add.byBlocked);
    merge(totals.bySite, add.bySite);
    await chrome.storage.local.set({ totals });
    await checkAchievements({ totals, pages });
  }
}

// Every matched rule. Only fires for unpacked extensions (see README). Allow rules aren't blocks.
DNR.onRuleMatchedDebug.addListener(({ request, rule }) => {
  if (rule.ruleId >= ALLOW_BASE) return;
  record(request.tabId, hostOf(request.initiator), 'network', hostOf(request.url), request.frameId === 0);
});

// --- Achievements ----------------------------------------------------------

async function checkAchievements({ totals, pages = [], paused }) {
  const store = await chrome.storage.local.get(['achievements', 'paused', 'totals']);
  const ach = store.achievements ?? { unlocked: {}, unseen: [] };
  const base = {
    totals: totals ?? store.totals ?? emptyTotals(),
    paused: paused ?? (store.paused ?? []).length,
  };
  const states = pages.length ? pages.map((page) => ({ ...base, page })) : [base];

  let changed = false;
  for (const a of ACHIEVEMENTS) {
    if (ach.unlocked[a.id]) continue;
    for (const s of states) {
      const hit = a.test(s);
      if (!hit) continue;
      const p = typeof hit === 'object' ? hit : {};
      ach.unlocked[a.id] = { at: Date.now(), title: a.title(p), quip: a.quip(p) };
      ach.unseen.push(a.id);
      changed = true;
      break;
    }
  }
  if (changed) {
    await chrome.storage.local.set({ achievements: ach });
    chrome.action.setIcon({ path: ICON_DOT }).catch(() => {});
  }
}

async function markSeen() {
  const { achievements: ach } = await chrome.storage.local.get('achievements');
  if (ach?.unseen.length) { ach.unseen = []; await chrome.storage.local.set({ achievements: ach }); }
  chrome.action.setIcon({ path: ICON }).catch(() => {});
}

async function restoreIcon() {
  const { achievements: ach } = await chrome.storage.local.get('achievements');
  chrome.action.setIcon({ path: ach?.unseen.length ? ICON_DOT : ICON }).catch(() => {});
}

// --- Pause per site --------------------------------------------------------

const CONTENT_SCRIPTS = [
  { id: 'cosmetic', matches: ['<all_urls>'], css: ['content/cosmetic.css'], runAt: 'document_start', allFrames: true },
  { id: 'yt-prune', matches: ['*://*.youtube.com/*'], js: ['content/yt-prune.js'], world: 'MAIN', runAt: 'document_start' },
  { id: 'yt-skip', matches: ['*://*.youtube.com/*'], js: ['content/yt-skip.js'], css: ['content/youtube.css'], runAt: 'document_start' },
];

async function applyPaused() {
  const { paused = [] } = await chrome.storage.local.get('paused');

  await DNR.updateDynamicRules({
    removeRuleIds: [PAUSE_ID],
    addRules: paused.length ? [{
      id: PAUSE_ID,
      priority: 1000,
      action: { type: 'allowAllRequests' },
      condition: { requestDomains: paused, resourceTypes: ['main_frame', 'sub_frame'] },
    }] : [],
  });

  const exclude = paused.map((h) => `*://*.${h}/*`); // *.host also matches host itself
  const existing = (await chrome.scripting.getRegisteredContentScripts()).map((s) => s.id);
  if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: existing });
  await chrome.scripting.registerContentScripts(
    CONTENT_SCRIPTS.map((s) => (exclude.length ? { ...s, excludeMatches: exclude } : s))
  );
}

async function setPaused(host, on) {
  const { paused = [] } = await chrome.storage.local.get('paused');
  const next = on ? [...new Set([...paused, host])] : paused.filter((h) => h !== host);
  await chrome.storage.local.set({ paused: next.sort() });
  await applyPaused();
  if (on) await checkAchievements({ paused: next.length });
}

// --- Self-updating filter lists --------------------------------------------

async function refreshLists() {
  const texts = {};
  await Promise.all(SOURCES.map(async (src) => {
    const res = await fetch(src.url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${src.name}: HTTP ${res.status}`);
    texts[src.id] = await res.text();
  }));
  const allow = parseAllowlist(await (await fetch(chrome.runtime.getURL('allowlist.txt'))).text());
  let { rules, stats } = buildRules(texts, allow);
  if (stats.domains < 10000) throw new Error(`lists look broken: only ${stats.domains} domains`);

  const old = (await DNR.getDynamicRules()).filter((r) => r.id !== PAUSE_ID).map((r) => r.id);

  // Chrome rejects the whole batch if one rule is invalid and names it. Drop it and retry.
  const skipped = [];
  for (let attempt = 0; ; attempt++) {
    try {
      await DNR.updateDynamicRules({ removeRuleIds: old, addRules: rules }); // atomic
      break;
    } catch (e) {
      const id = Number(String(e?.message).match(/id (\d+)/)?.[1]);
      if (!id || attempt >= 50) throw e;
      skipped.push(id);
      rules = rules.filter((r) => r.id !== id);
    }
  }
  if (skipped.length) console.warn('[quiet] skipped invalid rules:', skipped);

  await DNR.updateEnabledRulesets({ disableRulesetIds: ['ads'] }); // bundled fallback no longer needed
  await chrome.storage.local.set({
    lists: { updated: Date.now(), rules: rules.length, domains: stats.domains, sources: SOURCES.map((s) => s.name) },
  });
}

async function refreshListsOrRetry() {
  try {
    await refreshLists();
    chrome.alarms.clear('lists-retry');
  } catch (e) {
    console.error('[quiet] list refresh failed, retrying in an hour:', e);
    chrome.alarms.create('lists-retry', { delayInMinutes: LIST_RETRY_MINUTES });
  }
}

// Ruleset state resets on extension update, so switch the bundled copy off again if lists are installed.
async function reconcileRulesets() {
  const hasLists = (await DNR.getDynamicRules()).some((r) => r.id !== PAUSE_ID);
  await DNR.updateEnabledRulesets(hasLists ? { disableRulesetIds: ['ads'] } : { enableRulesetIds: ['ads'] });
  return hasLists;
}

// --- Messages --------------------------------------------------------------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'yt' && sender.tab) {
    record(sender.tab.id, hostOf(sender.url), 'youtube', null, sender.frameId === 0);
    return;
  }
  if (msg?.type === 'stats') {
    serial(async () => {
      await flush();
      const key = `tab:${msg.tabId}`;
      const [s, l] = await Promise.all([
        chrome.storage.session.get(key),
        chrome.storage.local.get(['totals', 'paused', 'lists', 'achievements']),
      ]);
      sendResponse({
        page: s[key] ?? emptyPage(),
        totals: l.totals ?? emptyTotals(),
        paused: l.paused ?? [],
        lists: l.lists ?? null,
        achievements: l.achievements ?? { unlocked: {}, unseen: [] },
      });
    });
    return true;
  }
  if (msg?.type === 'seen') {
    serial(markSeen);
    return;
  }
  if (msg?.type === 'pause') {
    serial(async () => {
      try { await setPaused(msg.host, msg.on); sendResponse({ ok: true }); }
      catch (e) { sendResponse({ ok: false, error: String(e) }); }
    });
    return true;
  }
});

// --- Tab lifecycle ---------------------------------------------------------

chrome.webNavigation.onCommitted.addListener(({ tabId, frameId }) => {
  if (frameId !== 0) return;
  pending.tabs.delete(tabId);
  serial(async () => {
    await chrome.storage.session.remove(`tab:${tabId}`);
    chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {});
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  pending.tabs.delete(tabId);
  serial(() => chrome.storage.session.remove(`tab:${tabId}`));
});

// --- Install / startup / alarms --------------------------------------------

chrome.runtime.onInstalled.addListener(({ reason }) => {
  chrome.action.setBadgeBackgroundColor({ color: '#5F8572' });
  chrome.action.setBadgeTextColor?.({ color: '#FFFFFF' });
  serial(async () => {
    const { totals, installId } = await chrome.storage.local.get(['totals', 'installId']);
    await chrome.storage.local.set({
      totals: reason === 'install' || !totals ? emptyTotals() : totals,
      installId: installId ?? crypto.randomUUID(),
    });
    await applyPaused();
    await reconcileRulesets();
    await refreshListsOrRetry();   // also upgrades older installs to the full list set
    await checkAchievements({});   // existing totals may already qualify
    await restoreIcon();
  });
});

chrome.runtime.onStartup.addListener(() => serial(async () => { await reconcileRulesets(); await restoreIcon(); }));

// Only create alarms if missing - recreating them on every worker start would reset the timers.
const ensureAlarm = (name, periodInMinutes) =>
  chrome.alarms.get(name).then((a) => a || chrome.alarms.create(name, { periodInMinutes }));

ensureAlarm('lists', LIST_REFRESH_MINUTES);
if (ENDPOINT) ensureAlarm('sync', SYNC_MINUTES);

chrome.alarms.onAlarm.addListener(({ name }) => {
  if (name === 'lists' || name === 'lists-retry') serial(refreshListsOrRetry);
  if (name === 'sync' && ENDPOINT) serial(sync);
});

// --- Optional server sync ---------------------------------------------------
// Sends a cumulative snapshot, so the server can simply upsert by installId.

async function sync() {
  const { totals, installId } = await chrome.storage.local.get(['totals', 'installId']);
  if (!totals || !installId) return;
  const body = {
    installId,
    version: chrome.runtime.getManifest().version,
    since: totals.since,
    network: totals.network,
    youtube: totals.youtube,
    byBlocked: totals.byBlocked,
    ...(INCLUDE_SITES && { bySite: totals.bySite }),
  };
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`sync failed: HTTP ${res.status}`);
}
