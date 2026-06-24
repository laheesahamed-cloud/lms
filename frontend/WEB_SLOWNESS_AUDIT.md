# Web Slowness Audit — "site very slow after FE redeploy, Capacitor fine"

Date: 2026-06-20
Scope: why the **web** build of the LMS feels very slow to load while the
**Capacitor** native app stays fast.
Constraint: **no new features / no new behavior code, zero visual change.**

---

## TL;DR (measured)

- **Your recent frontend changes did NOT make the site heavier.** Committed JS
  is *flat-to-smaller* across the whole recent batch (HEAD **2330 KB** vs Jun-10
  **2361 KB**; `app-shared`, which loads on every page, **304 KB** vs **306 KB**).
  Bundle bloat is **ruled out**.
- **Delivery is fine in principle:** Brotli compression works (Cloudflare),
  hashed assets are `immutable` and edge-cached (`cf-cache-status: HIT`).
- **The real bottleneck is network round-trips**, and the **web pays them, the
  app doesn't.** The native app loads HTML + every JS/CSS chunk from the local
  bundle (zero network) and shows cached API data instantly; the web must fetch
  ~15–25 files over the wire.
- **The measuring machine's connection is currently badly degraded** (Google
  8.8s, Cloudflare 24s, TLS handshakes 1–1.5s), so absolute timings of the live
  site from here are **not trustworthy** and must be re-checked from a good
  network. On a slow link, "web downloads a lot / app downloads nothing" fully
  explains "web slow, app fine."
- **Two real, safe levers** (below): (1) stop the SW re-fetching cached
  immutable assets — *applied*; (2) optionally let Cloudflare edge-cache the HTML
  shell — *config, with a tradeoff*.

---

## 1. User-reported facts

| Question | Answer | Implication |
|---|---|---|
| When slow? | Whole site, always (incl. assets) | Per-load delivery cost, not one-off cold start |
| Keep-warm cron running? | Yes | Backend cold-boot **ruled out** |
| Recent FE redeploy? | Yes | Suspected the redeploy — but see §2, it didn't add weight |

Capacitor (same backend) is fast → the slow part is **frontend asset/shell
delivery over the network**, which the native app never does.

## 2. Network-independent evidence (reliable — not affected by my slow link)

```
Committed dist asset size over recent history (git ls-tree, no network):
HEAD     2026-06-18  JS 2330.9 KB / 78   CSS 963.4 KB / 13
467e798  2026-06-14  JS 2332.4 KB / 79   CSS 1002.5 KB / 14   (Release v4)
7aa4896  2026-06-16  JS 2321.5 KB / 78   CSS 958.5 KB / 13     (FSRS flashcards)
e1cba00  2026-06-10  JS 2361.3 KB / 130  CSS 1027.7 KB / 3
app-shared chunk: HEAD 304 KB  vs  306 KB previously
```

- Bundle did **not** grow. `sw.js` last changed in the v4 release (not in the
  recent batch). `index.html` structure unchanged (same CSS/boot hashes).
- ⇒ **No frontend regression** can account for a recent slowdown.

## 3. Live measurements (CONFOUNDED by this machine's bad network — directional only)

```
index.html (no-store, cf DYNAMIC): TTFB 2.0 / 2.7 / 7.3 / 4.1 / 2.8 s  (origin every time)
main CSS  (cf HIT, immutable, br): TTFB ~1.5–2.2 s  ← even a cache HIT is slow here
/api/health:                        TTFB ~3.3 s
BASELINE from same machine:         google.com TTFB 1.7s/total 8.8s ; cloudflare.com total 24s
TLS handshake (appconnect):         1.0–1.5 s  ← classic congested/lossy local link
```

Because Google/Cloudflare are *also* multi-second from this machine, I **cannot**
conclude the origin is overloaded. The honest read: the link itself is slow right
now, which punishes the request-heavy web path and spares the request-free app.
**Re-measure from a different network before blaming the server.**

## 4. Confirmed inefficiency — FIXED

**SW re-fetched every cached, content-hashed `immutable` asset on every load.**
`frontend/public/sw.js` versioned-asset branch fired `fetch()` unconditionally
even when serving from cache → ~20–30 redundant background requests per page,
every load. Harmless on fast links, painful on slow ones.

**Fix applied** (cache-first, no revalidation; new deploy = new hashes = natural
refresh). Removes code, zero visual/behavior change. Cache version bumped
`v13 → v14` so clients pick it up and prune old caches. **Needs `npm run build` +
deploy to go live.**

## 5. Optional lever — Cloudflare edge-cache the HTML shell (config, has a tradeoff)

`index.html` is `cache-control: no-store` ⇒ `cf-cache-status: DYNAMIC` ⇒ every
fresh load is a full origin round-trip (the slowest, most variable request). The
SW intentionally does network-first navigation to avoid stale HTML after a
deploy, and the origin sets `no-store` deliberately.

If first-load TTFB is confirmed slow on a *good* network, the highest-impact
change is to let Cloudflare cache the shell briefly (e.g. a Cache Rule:
"Cache Everything" + `Edge-Cache-TTL`/`s-maxage` ~60s + **purge on every
deploy**, keeping browser `no-store`). This cuts the origin hit to edge latency.
Tradeoff: requires a deploy-time Cloudflare purge or users can see ~60s-stale
HTML. **Do not apply blind — only if good-network testing shows the origin slow.**

## 6. Ruled out

- Backend cold-boot (keep-warm running; app uses same API and is fast).
- Bundle bloat / new render-blocking tag (§2).
- Broken `.htaccess` CSP placeholders — those exist only in the **uncommitted**
  working-tree rebuild; the **live** site serves the committed `.htaccess` with
  real hashes (confirmed: the working-tree chunk hash 404s on the host).
- Compression / asset edge-caching (both working).

## 7. Next steps

1. **Verify network vs server**: load the site on a phone over cellular / a
   different network. If fast there → it was the local link (external). If slow
   everywhere → proceed to §5 + check the origin host's `df -h` and Apache load.
2. **Deploy the SW fix** (§4): `npm run build` → confirm deployed `dist/sw.js`
   has the cache-first branch + `v14` + no `__LMS_` left in `.htaccess` → ship
   committed `dist` the usual way. Then re-measure request count (DevTools
   Network: cached assets should show **no** duplicate network row per chunk).
3. **Only if origin is slow on a good network**: apply §5 Cloudflare shell cache.
