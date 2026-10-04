// Builds docs/index.html: the public lock screen with the private page
// encrypted inside it. Only an order listed in private/secret.json unlocks it.
//
//   node build.mjs
//
// How it works: the private page is encrypted with a random content key
// (AES-GCM). That key is then wrapped once per accepted order, using a key
// derived from the order with PBKDF2. The lock screen derives a key from
// whatever Kate picks and tries to unwrap; no plaintext ever ships.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { webcrypto as crypto } from "node:crypto";

const ITERATIONS = 400_000;
const { subtle } = crypto;

const menu = JSON.parse(readFileSync("src/menu.json", "utf8"));
const secret = JSON.parse(readFileSync("private/secret.json", "utf8"));
const content = readFileSync("private/content.html", "utf8");
const lock = readFileSync("src/lock.html", "utf8");

// Must match canonical() in src/lock.html exactly.
function canonical(order) {
  return (
    "kate-v1|" +
    menu
      .map((cat) => {
        const v = order[cat.id];
        if (cat.multi) return [...(v || [])].sort().join(",");
        return v || "";
      })
      .join("|")
  );
}

function validate(order, i) {
  for (const cat of menu) {
    const ids = new Set(cat.options.map((o) => o.id));
    const v = order[cat.id];
    const picks = cat.multi ? v || [] : [v];
    for (const p of picks) {
      if (!ids.has(p)) {
        throw new Error(
          `orders[${i}].${cat.id}: "${p}" is not a valid option. Valid: ${[...ids].join(", ")}`
        );
      }
    }
  }
}

const b64 = (buf) => Buffer.from(buf).toString("base64");
const rand = (n) => crypto.getRandomValues(new Uint8Array(n));

async function deriveKek(password, salt) {
  const base = await subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
}

if (!secret.orders?.length) throw new Error("private/secret.json needs at least one order");
secret.orders.forEach(validate);

const contentKeyRaw = rand(32);
const contentKey = await subtle.importKey("raw", contentKeyRaw, "AES-GCM", false, ["encrypt"]);
const iv = rand(12);
const data = await subtle.encrypt({ name: "AES-GCM", iv }, contentKey, new TextEncoder().encode(content));

const salt = rand(16);
const keys = [];
for (const order of secret.orders) {
  const kek = await deriveKek(canonical(order), salt);
  const wrapIv = rand(12);
  const ct = await subtle.encrypt({ name: "AES-GCM", iv: wrapIv }, kek, contentKeyRaw);
  keys.push({ iv: b64(wrapIv), ct: b64(ct) });
}

const payload = { iter: ITERATIONS, salt: b64(salt), iv: b64(iv), data: b64(data), keys };

const out = lock
  .replace("/*__MENU__*/[]", () => JSON.stringify(menu))
  .replace("/*__PAYLOAD__*/null", () => JSON.stringify(payload));

mkdirSync("docs", { recursive: true });
writeFileSync("docs/index.html", out);
console.log(`Built docs/index.html — ${secret.orders.length} accepted order(s), ${(out.length / 1024).toFixed(1)} KB`);
