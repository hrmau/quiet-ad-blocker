# Privacy policy

*Quiet - last updated 6 October 2026*

Quiet is an ad and tracker blocker. It is built to keep things on your device, and it does.

## What Quiet stores, and where

Quiet keeps a small amount of information in your browser's own extension storage, on your device:

- **Counts of blocked requests:** how many requests were blocked on the current page, since install, per blocked domain (for example `doubleclick.net`) and per website you visited where something was blocked.
- **Sites you have paused** Quiet on.
- **Milestones** you have unlocked, and when.
- **Filter list status:** when the lists were last refreshed and how many rules they produced.
- **A random install ID**, used only by the optional sync feature described below.

To count blocked requests, Quiet sees the address of each request it blocks and the page that made it. It keeps only the domain names and counts above, never full addresses, page content, form data or anything you type.

## What leaves your device

Nothing, by default.

- Quiet does not collect, sell, share or transmit any personal data or browsing data.
- It has no analytics, no telemetry, no ads and no accounts.
- The only network requests Quiet itself makes are to download public filter lists (EasyList, EasyPrivacy, uBlock Origin's lists and StevenBlack's hosts file) from `raw.githubusercontent.com`. These are plain downloads; nothing about you is sent with them beyond what any web request carries, such as your IP address, which GitHub receives and Quiet never sees.

## Optional server sync

The source code includes an optional sync feature for people who run their own server. It is switched off in every published build, and can only be switched on by editing the source code and loading it yourself. If someone does that, the extension sends their own counts and install ID to their own server. Per-site counts are excluded unless that is changed too.

## Removing your data

Uninstalling Quiet deletes everything it stored. Counts for the current page are also cleared when you leave the page or close the tab.

## Children

Quiet is not directed at children and collects no data from anyone.

## Changes

If this policy changes, the new version will be published here with a new date. The history of every change is visible in this repository.

## Contact

Questions: [open an issue](https://github.com/hrmau/quiet-ad-blocker/issues).
