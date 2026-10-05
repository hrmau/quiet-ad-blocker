// Filter lists -> declarativeNetRequest rules.
// Shared by the extension (weekly self-update) and scripts/build-rules.mjs (bundled fallback).
//
// Supports the network subset of Adblock Plus syntax that DNR can express natively:
//   ||domain^            -> grouped into requestDomains rules (1,000 domains per rule)
//   ||domain/path, *, ^  -> urlFilter rules (DNR uses the same pattern syntax)
//   @@...                -> allow rules
//   $third-party, $script, $domain=a|~b, $important, $match-case ... -> rule conditions
// Anything else (cosmetic ##, scriptlets, $redirect, $removeparam, regex rules...) is skipped.

export const SOURCES = [
  { id: 'easylist', name: 'EasyList', format: 'abp',
    url: 'https://raw.githubusercontent.com/easylist/easylist/gh-pages/easylist.txt' },
  { id: 'easyprivacy', name: 'EasyPrivacy', format: 'abp',
    url: 'https://raw.githubusercontent.com/easylist/easylist/gh-pages/easyprivacy.txt' },
  { id: 'ubo-privacy', name: 'uBlock filters - Privacy', format: 'abp',
    url: 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/privacy.txt' },
  { id: 'ubo-badware', name: 'uBlock filters - Badware risks', format: 'abp',
    url: 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/badware.txt' },
  { id: 'stevenblack', name: 'StevenBlack hosts', format: 'hosts',
    url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts' },
];

// Rule ID ranges: block rules below ALLOW_BASE, allow rules from it.
export const ALLOW_BASE = 50000;
export const PAUSE_ID = 100000;
export const MAX_RULES = 29000; // Chrome guarantees 30,000 static and 30,000 dynamic "safe" rules

const CHUNK = 1000;
const DOMAIN = /^(?=.{1,253}$)([a-z0-9-]{1,63}\.)+[a-z0-9-]{2,63}$/;
const HOST_SKIP = new Set(['localhost', 'localhost.localdomain', 'local', 'broadcasthost', 'ip6-localhost', 'ip6-loopback']);

const TYPES = {
  script: 'script', image: 'image', stylesheet: 'stylesheet', css: 'stylesheet', object: 'object',
  xmlhttprequest: 'xmlhttprequest', xhr: 'xmlhttprequest', subdocument: 'sub_frame', frame: 'sub_frame',
  ping: 'ping', beacon: 'ping', media: 'media', font: 'font', websocket: 'websocket', other: 'other',
};
const ALL_TYPES = [...new Set(Object.values(TYPES))];

export const parseAllowlist = (text) =>
  text.split('\n').map((s) => s.trim().toLowerCase()).filter((s) => s && !s.startsWith('#'));

// One ABP line -> { allow, domain?, urlFilter?, cond, important } or null if unsupported.
function parseAbp(line) {
  if (!line || line.startsWith('!') || line.startsWith('[')) return null;
  if (/#[@?$%]?#|#\+js/.test(line)) return null;            // cosmetic / scriptlet
  let allow = false;
  if (line.startsWith('@@')) { allow = true; line = line.slice(2); }

  let pattern = line, opts = '';
  const dollar = line.lastIndexOf('$');
  if (dollar > 0 && !/^\/.*\/$/.test(line)) { pattern = line.slice(0, dollar); opts = line.slice(dollar + 1); }
  if (!pattern || pattern.startsWith('/') && pattern.endsWith('/')) return null; // regex rules
  if (/[^\x20-\x7e]/.test(pattern)) return null;                                // non-ASCII

  const cond = {}; let important = false;
  const types = [], notTypes = [];
  for (const raw of opts ? opts.split(',') : []) {
    const neg = raw.startsWith('~'); const o = neg ? raw.slice(1) : raw;
    const [key, val] = o.split('=');
    if (TYPES[key]) { (neg ? notTypes : types).push(TYPES[key]); continue; }
    if (key === 'third-party' || key === '3p') { cond.domainType = neg ? 'firstParty' : 'thirdParty'; continue; }
    if (key === 'first-party' || key === '1p') { cond.domainType = neg ? 'thirdParty' : 'firstParty'; continue; }
    if (key === 'important') { important = true; continue; }
    if (key === 'match-case') { cond.isUrlFilterCaseSensitive = true; continue; }
    if (key === 'domain' && val) {
      const inc = [], exc = [];
      for (const d of val.split('|')) {
        const x = d.startsWith('~') ? d.slice(1) : d;
        if (!DOMAIN.test(x)) return null;                     // entity (google.*) or junk
        (d.startsWith('~') ? exc : inc).push(x);
      }
      if (inc.length) cond.initiatorDomains = inc;
      if (exc.length) cond.excludedInitiatorDomains = exc;
      continue;
    }
    return null; // redirect, removeparam, csp, popup, badfilter, ... -> not expressible, skip
  }
  if (types.length) cond.resourceTypes = [...new Set(types)];
  else if (notTypes.length) cond.resourceTypes = ALL_TYPES.filter((t) => !notTypes.includes(t));

  const m = pattern.match(/^\|\|([a-z0-9.-]+)\^?$/);
  if (m && DOMAIN.test(m[1])) { delete cond.isUrlFilterCaseSensitive; return { allow, important, domain: m[1], cond }; }
  if (pattern === '*' || pattern.startsWith('||*') || pattern.length < 4) return null; // too broad
  const core = pattern.replace(/^\|\|?/, '').replace(/\|$/, '');
  if (core.includes('|')) return null; // DNR only allows | anchors at the start or end
  return { allow, important, urlFilter: pattern, cond };
}

function parseHosts(text, out) {
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    const parts = line.split(/\s+/);
    const host = (parts.length > 1 ? parts[1] : parts[0]).toLowerCase();
    if (!HOST_SKIP.has(host) && DOMAIN.test(host)) out.push({ allow: false, important: false, domain: host, cond: {} });
  }
}

// texts: { [sourceId]: string }. Returns { rules, stats }.
export function buildRules(texts, allowlist = []) {
  const entries = [];
  const perSource = {};
  for (const src of SOURCES) {
    const text = texts[src.id];
    if (!text) continue;
    const before = entries.length;
    if (src.format === 'hosts') parseHosts(text, entries);
    else for (const line of text.split('\n')) { const e = parseAbp(line.trim()); if (e) entries.push(e); }
    perSource[src.id] = entries.length - before;
  }

  // Group domain-only entries with identical conditions; keep URL filters as single rules.
  const groups = new Map(); const urlRules = new Map();
  for (const e of entries) {
    const priority = e.allow ? (e.important ? 4 : 2) : (e.important ? 3 : 1);
    const meta = JSON.stringify({ allow: e.allow, priority, cond: e.cond });
    if (e.domain) {
      if (!groups.has(meta)) groups.set(meta, new Set());
      groups.get(meta).add(e.domain);
    } else {
      urlRules.set(`${meta}|${e.urlFilter}`, { allow: e.allow, priority, cond: { urlFilter: e.urlFilter, ...e.cond } });
    }
  }

  const blocks = [], allows = [];
  for (const [meta, set] of groups) {
    const { allow, priority, cond } = JSON.parse(meta);
    // requestDomains matches subdomains, so drop domains whose parent is already in the group.
    const covered = (d) => { const p = d.split('.'); for (let i = 1; i < p.length - 1; i++) if (set.has(p.slice(i).join('.'))) return true; return false; };
    const domains = [...set].filter((d) => !covered(d)).sort();
    for (let i = 0; i < domains.length; i += CHUNK) {
      (allow ? allows : blocks).push({ priority, action: { type: allow ? 'allow' : 'block' },
        condition: { ...cond, requestDomains: domains.slice(i, i + CHUNK) } });
    }
  }
  for (const r of urlRules.values()) {
    (r.allow ? allows : blocks).push({ priority: r.priority, action: { type: r.allow ? 'allow' : 'block' }, condition: r.cond });
  }
  // Your allowlist beats every list rule.
  if (allowlist.length) allows.push({ priority: 900, action: { type: 'allow' }, condition: { requestDomains: allowlist } });

  // Never block the top-level page itself.
  for (const r of blocks) if (!r.condition.resourceTypes) r.condition.excludedResourceTypes = ['main_frame'];

  // Stay inside Chrome's limits: if over, drop the least valuable rules (generic URL patterns) first.
  const budget = MAX_RULES - allows.length;
  blocks.sort((a, b) => (b.condition.requestDomains ? 1 : 0) - (a.condition.requestDomains ? 1 : 0));
  const kept = blocks.slice(0, budget);

  const rules = [
    ...kept.map((r, i) => ({ id: 1 + i, ...r })),
    ...allows.map((r, i) => ({ id: ALLOW_BASE + i, ...r })),
  ];
  return {
    rules,
    stats: { blockRules: kept.length, allowRules: allows.length, dropped: blocks.length - kept.length, perSource,
      domains: [...groups.values()].reduce((n, s) => n + s.size, 0) },
  };
}
