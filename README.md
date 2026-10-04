# 🔒 For Kate only

A tiny site that asks Kate out for Korean BBQ. It's locked behind her Chipotle order.

- `src/index.html`: the whole page (the Chipotle lock, Porky, the grill game, the question, the ticket)
- `src/menu.json`: the order categories and options
- `private/secret.json`: Fred's phone number and the accepted order(s). **Git-ignored, never published.**
- `build.mjs`: encrypts the phone number so only an accepted order can decrypt it, then writes `docs/index.html`
- `docs/`: what GitHub Pages serves

## Change the order / page

Edit `private/secret.json` (use option ids from `src/menu.json`) or `src/index.html`, then:

```bash
node build.mjs
```

Preview locally with `node serve.mjs` → http://localhost:4173

## Publish

GitHub Pages → Settings → Pages → Deploy from branch → `main` / `/docs`.
For a custom domain, add it there (it creates `docs/CNAME`) and point your DNS at GitHub.
