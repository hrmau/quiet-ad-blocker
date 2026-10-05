// Server sync. Leave ENDPOINT empty to keep all stats on this device.
// If you set it, also add the server's origin to "host_permissions" in manifest.json,
// e.g. "https://stats.example.com/*".
export const ENDPOINT = '';
export const SYNC_MINUTES = 60;
// Per-site counts are effectively browsing history. Keep false unless you really need them.
export const INCLUDE_SITES = false;
