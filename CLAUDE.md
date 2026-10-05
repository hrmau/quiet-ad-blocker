# Quiet - handover

A calm, slightly cynical MV3 ad blocker for Brave and Chrome. Personal project by Artur, loaded unpacked in Brave on macOS. Public repo, MIT.

## Working with Artur
- British English. Never use em dashes - use spaced hyphens.
- Be brief and direct. No flattery, no corporate filler. Push back when something is a bad idea.
- Don't invent facts. Verify Chrome/DNR API behaviour against the docs before relying on it, and flag assumptions briefly.

## Run it
- `npm run build-rules` - builds the bundled fallback `rules/ads.json` (gitignored; required before loading unpacked)
- `npm test` - background logic against a mocked `chrome` API, with real list downloads (needs network)
- Load: `brave://extensions` -> Developer mode -> Load unpacked. Reload after every change.
- Debug: the "service worker" link on the extension card opens the background console.

## Layout
- `background.js` - counting, badge, pause, list refresh, milestones, optional server sync. Module service worker.
- `lists.js` - list sources + ABP-to-DNR converter. Shared by the extension and `scripts/build-rules.mjs`.
- `achievements.js` - milestone definitions, shared by background and popup.
- `popup/` - toolbar popup. `content/` - cosmetic CSS and YouTube scripts. `icons/` - closed-eye icon, plus `-dot` variants.
- `config.js` - server sync (off by default). `allowlist.txt` - domains never blocked.

## How it works
- **Network blocking**: weekly (and on install) the background downloads EasyList, EasyPrivacy, uBO Privacy, uBO Badware and StevenBlack hosts, converts the network rules DNR can express, and installs ~14k dynamic rules atomically. `||domain^` rules are grouped 1,000 per rule via `requestDomains`. Cosmetic rules, scriptlets, `$redirect`, `$removeparam` and regex rules are skipped. If Chrome rejects a rule it names the id; we drop it and retry. On fetch failure we keep the old rules and retry in an hour. The bundled hosts-only ruleset `ads` is a fallback, disabled once dynamic rules exist (re-checked on update/startup because ruleset state resets).
- **Rule ID ranges** (static and dynamic): `< 50000` block, `>= 50000` allow, `100000` = the single paused-sites `allowAllRequests` rule. Only ids below 50000 are counted as blocks.
- **Content scripts** are registered at runtime with `chrome.scripting` (not in the manifest) so paused sites can be excluded via `excludeMatches`.
- **Pause per site**: one dynamic allow rule with all paused domains + content scripts re-registered. Popup reloads the tab.
- **Stats**: `onRuleMatchedDebug` (unpacked only - a Web Store build would lose per-domain stats). Buffered in memory, flushed every 750ms through a single serial queue. Per-page in `storage.session` (reset on top-frame navigation), totals in `storage.local`.
- **Milestones**: checked after each flush and after pausing. New ones go into `unseen`, the toolbar icon switches to the dot variant, the popup shows them once then sends `seen`. No notifications - deliberate, notification permissions look dodgy.

## YouTube - lessons learned
YouTube detects blockers and shows the "Ad blockers are not allowed" dialog. What we learned from uBO's live filters:
- Don't block `youtube.com/pagead` or `api/stats/ads`, and don't hide `#player-ads` - these trigger detection.
- Rename ad keys in raw response text (`"adPlacements"` -> `"no_ads"`) rather than deleting parsed keys.
- Wrap `fetch`/XHR with Proxies so they still stringify as native code; patch new iframes because YouTube grabs a clean `fetch` from one.
- Fallback `yt-skip.js` mutes/fast-forwards/skips and removes the dialog (`ytd-enforcement-message-view-model` - name unverified).
- Server-side detection exists; this will keep breaking. Check uBO's `uAssets` filters for current approaches.

## Design
- Voice: a guided meditation that has read the privacy policy. Dry, deadpan, never shouty. Quips live in `popup/popup.js` and `achievements.js`.
- Palette: pale sage-stone base `#e6ebe7`, ink `#2c3833`, sage `#5f8572`; dusk dark mode. Serif for the count and quips, system sans for the rest.
- One motion only: the slow breathing circle behind the count. Respect `prefers-reduced-motion`.
- Popup: count and label sit inside the circle; "Let go of" rows carry a static bar sized to their count; milestones show as beads (filled = unlocked). Small uppercase eyebrows for section labels.
- Icon: a closed eye, sage, transparent background. 16/32px use the bolder variant.

## Known unknowns
- The popup has only been rendered here with a mocked `chrome` API (fake data, no favicon). Ask for a real screenshot after UI changes. README screenshots live in `docs/`.
- The rule validator in `tests/` is a best-effort copy of Chrome's; real validation may be stricter.
- Dynamic rule storage size limits beyond the 30,000 rule count haven't been checked.

## Backlog (rough priority)
1. Site-specific cosmetic filtering from EasyList (`site.com##.selector`) - the biggest gap vs uBO.
2. Element zapper: right-click to hide an element, remembered per site.
3. CI: Playwright loading the unpacked extension, checking blocking and that the popup renders.
4. More milestones; server sync backend (Supabase table + edge function, upsert on `installId`, never send per-site counts by default - GDPR).

## Credits and licensing
EasyList/EasyPrivacy (GPLv3 / CC BY-SA 3.0) and uBO lists (GPLv3) are downloaded at runtime, not redistributed. The bundled fallback is StevenBlack only (MIT). Keep it that way unless the licence question is revisited.
