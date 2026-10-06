# Chrome Web Store listing

Everything the developer dashboard asks for, ready to paste. Images are in this folder.

## Package

- Upload `dist/quiet-store.zip` from `npm run package` (manifest at the zip root, as the store requires).
- Every later upload needs a higher `version` in `manifest.json`.

## Store listing tab

**Name:** Quiet (from the manifest)

**Summary** (from the manifest `description`, max 132 characters):
> Blocks ads and trackers, calmly. An ad blocker with the temperament of a guided meditation that has read the privacy policy.

**Category:** Privacy & Security

**Language:** English (UK)

**Description:**

> Settle into a comfortable position. Notice the banners, the pixels, the companies who would like to know how long you hovered over a pair of shoes. Observe them without judgement. Then block them.
>
> Quiet is a small ad and tracker blocker. It removes ads and trackers, counts what it has let go of, and offers a dry remark about it. It will not lecture you, notify you or ask for a rating.
>
> WHAT IT DOES
> • Blocks ads and trackers using EasyList, EasyPrivacy, uBlock Origin's Privacy and Badware lists and StevenBlack's hosts file. The lists refresh themselves weekly.
> • Hides common leftover ad containers, conservatively, so sites don't break.
> • Handles YouTube ads: removes them where it can, and mutes and skips the ones that slip through.
> • "Pause here" turns everything off for one site and reloads it. Acceptance is also a practice.
> • Shows what was blocked on the current page, what you've let go of since install, and which domains tried hardest.
> • Thirty-five dry anti-achievements in eight categories, with quiet progress bars. Shown once in the popup. No notifications.
>
> WHAT IT DOESN'T DO
> • Collect, sell or send your data. Counts stay on your device. No analytics, no accounts.
> • Promise perfection. It blocks most things, not all things. YouTube is an ongoing negotiation.
>
> Quiet is free and open source (MIT): https://github.com/hrmau/quiet-ad-blocker
>
> Filter lists by EasyList, uBlock Origin and StevenBlack, downloaded from their public sources.

**Graphics:**
- Store icon: `icon-store-128.png` (96px artwork with 16px transparent padding)
- Screenshots: `screenshot-1.png`, `screenshot-2.png` (1280x800)
- Small promo tile: `promo-small-440x280.png`

**Homepage URL:** https://github.com/hrmau/quiet-ad-blocker

**Support URL:** https://github.com/hrmau/quiet-ad-blocker/issues

## Privacy practices tab

**Single purpose:**
> Quiet blocks ads and trackers on web pages, and shows the user what was blocked.

**Permission justifications:**

| Permission | Justification |
| --- | --- |
| `declarativeNetRequest` | Blocks ad and tracker requests using rules converted from public filter lists, and allows everything on sites the user has paused. |
| `webRequest` | Observes, without modifying, requests that were blocked, so the popup can show how many were blocked on the current page and which domains they went to. Counts are stored on the device only. |
| `storage` | Stores block counts, paused sites, unlocked milestones and filter list status locally. |
| `webNavigation` | Resets the per-page count when a tab navigates to a new page. |
| `alarms` | Refreshes the filter lists weekly, and retries an hour later if a download fails. |
| `favicon` | Shows the current site's icon in the popup. |
| `scripting` | Registers the ad-hiding stylesheet and YouTube ad-handling scripts at runtime, so that sites the user has paused can be excluded. |
| Host permission `<all_urls>` | Ads and trackers appear on any website, so blocking and hiding must work on all of them. Also used to download the filter lists from raw.githubusercontent.com. |

**Are you using remote code?**
> No. Filter lists are downloaded as plain text data and converted into declarativeNetRequest rules. No JavaScript or WebAssembly is fetched or executed; all code is in the package.

**Data usage:** tick none of the categories. Nothing is transmitted off the device. *Assumption to check: the store's definition of "collect" is about data leaving the device. If the form's wording suggests locally stored per-site counts count as "Web history", tick that and say it never leaves the device.*

**Certifications:** tick all three (not sold to third parties; not used for unrelated purposes; not used for creditworthiness or lending).

**Privacy policy URL:** https://github.com/hrmau/quiet-ad-blocker/blob/main/PRIVACY.md

## Distribution tab

- Free, all regions.
- Visibility: Public (or Unlisted for a quiet first week - only people with the link can find it).

## Test instructions tab

Not needed - no account or login. Optionally:
> Install, visit any news site, then open the popup to see the count and the blocked domains. "Pause here" disables blocking on that site and reloads it.
