// Runs in the page context before YouTube's scripts.
// Renames ad keys in the raw player response text ("adPlacements" -> "no_ads"), mirroring uBO's
// current approach. Wrappers are Proxies so they still stringify as [native code].
(() => {
  const URL_RE = /\/youtubei\/v1\/(player|get_watch)|\/playlist\?/;
  const HAS_AD = /"(adPlacements|adSlots|playerAds)"/;
  const AD_G = /"(adPlacements|adSlots|playerAds)"/g;
  const clean = (text) => text.replace(AD_G, '"no_ads"');
  // Tell content/yt-skip.js (isolated world) so the popup can count it.
  const report = () => document.dispatchEvent(new CustomEvent('quiet:yt'));

  // 1. Initial page load: ytInitialPlayerResponse is assigned by an inline script.
  let initial;
  Object.defineProperty(window, 'ytInitialPlayerResponse', {
    configurable: true,
    get: () => initial,
    set: (v) => {
      if (v && typeof v === 'object') {
        if (v.adPlacements || v.adSlots || v.playerAds) report();
        for (const k of ['adPlacements', 'adSlots', 'playerAds']) v[k] = undefined;
      }
      initial = v;
    },
  });

  // 2. fetch: rewrite matching responses.
  const patchedFetch = new Proxy(window.fetch, {
    apply: async (target, thisArg, args) => {
      const res = await Reflect.apply(target, thisArg, args);
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url ?? '';
      if (!URL_RE.test(url)) return res;
      const text = await res.clone().text();
      if (!HAS_AD.test(text)) return res;
      report();
      const out = new Response(clean(text), { status: res.status, statusText: res.statusText, headers: res.headers });
      Object.defineProperty(out, 'url', { value: res.url });
      return out;
    },
  });
  window.fetch = patchedFetch;

  // 3. XHR: rewrite responseText/response on completed matching requests.
  const xhrUrl = new WeakMap();
  const reported = new WeakSet(); // responseText can be read many times - count once
  const XP = XMLHttpRequest.prototype;
  XP.open = new Proxy(XP.open, {
    apply: (t, xhr, args) => { xhrUrl.set(xhr, String(args[1])); return Reflect.apply(t, xhr, args); },
  });
  for (const prop of ['responseText', 'response']) {
    const d = Object.getOwnPropertyDescriptor(XP, prop);
    Object.defineProperty(XP, prop, {
      ...d,
      get: new Proxy(d.get, {
        apply: (t, xhr, args) => {
          const v = Reflect.apply(t, xhr, args);
          if (typeof v !== 'string' || xhr.readyState !== 4 || !URL_RE.test(xhrUrl.get(xhr) || '') || !HAS_AD.test(v)) return v;
          if (!reported.has(xhr)) { reported.add(xhr); report(); }
          return clean(v);
        },
      }),
    });
  }

  // 4. YouTube grabs untouched fetch/XHR from a fresh iframe to bypass hooks. Patch new iframes too.
  const patchFrame = (node) => {
    const frames = node.tagName === 'IFRAME' ? [node] : node.querySelectorAll?.('iframe') ?? [];
    for (const f of frames) {
      try {
        f.contentWindow.fetch = patchedFetch;
        f.contentWindow.XMLHttpRequest = window.XMLHttpRequest;
      } catch { /* cross-origin, ignore */ }
    }
  };
  Node.prototype.appendChild = new Proxy(Node.prototype.appendChild, {
    apply: (t, parent, args) => {
      const r = Reflect.apply(t, parent, args);
      if (args[0] instanceof Element) patchFrame(args[0]);
      return r;
    },
  });
})();
