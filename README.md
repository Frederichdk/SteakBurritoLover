# 🔒 For Kate only

A tiny site that asks Kate out for Korean BBQ. It's locked behind her Chipotle order.

- `src/lock.html`: the public lock screen (the Chipotle order picker)
- `src/menu.json`: the order categories and options
- `private/`: the real page and the accepted order(s). **Git-ignored, never published.**
- `build.mjs`: encrypts `private/content.html` so only an accepted order can unlock it, then writes `docs/index.html`
- `docs/`: what GitHub Pages serves

## Change the order / page

Edit `private/secret.json` (use option ids from `src/menu.json`) or `private/content.html`, then:

```bash
node build.mjs
```

Preview locally with `node serve.mjs` → http://localhost:4173

## Publish

GitHub Pages → Settings → Pages → Deploy from branch → `main` / `/docs`.
For a custom domain, add it there (it creates `docs/CNAME`) and point your DNS at GitHub.
