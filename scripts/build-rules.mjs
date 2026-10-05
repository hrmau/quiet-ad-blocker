// Builds the bundled fallback (rules/ads.json): StevenBlack hosts only, domain rules only.
// The full set (EasyList, EasyPrivacy, uBO lists) is fetched by the extension on install and weekly.
// Usage: npm run build-rules   (Node 18+)
import { readFile, writeFile } from 'node:fs/promises';
import { SOURCES, parseAllowlist, buildRules } from '../lists.js';

const root = new URL('../', import.meta.url);
const allow = parseAllowlist(await readFile(new URL('allowlist.txt', root), 'utf8').catch(() => ''));
const hosts = SOURCES.find((s) => s.id === 'stevenblack');
const res = await fetch(hosts.url);
if (!res.ok) throw new Error(`${hosts.url} -> HTTP ${res.status}`);
const { rules, stats } = buildRules({ stevenblack: await res.text() }, allow);
await writeFile(new URL('rules/ads.json', root), JSON.stringify(rules));
console.log(`${stats.domains} domains -> ${rules.length} rules`);
