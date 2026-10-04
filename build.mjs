// Builds docs/index.html from src/index.html.
//
//   node build.mjs
//
// The page itself is plain HTML. The only secret is Fred's phone number,
// which is encrypted once per accepted order (PBKDF2 → AES-GCM). The lock
// derives a key from whatever Kate picks and tries to decrypt it: success
// means the order was right, and hands the page the number for the iMessage
// button. Neither the order nor the number ships in plaintext.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { webcrypto as crypto } from "node:crypto";

const ITERATIONS = 400_000;
const { subtle } = crypto;

const menu = JSON.parse(readFileSync("src/menu.json", "utf8"));
const secret = JSON.parse(readFileSync("private/secret.json", "utf8"));
const page = readFileSync("src/index.html", "utf8");

// Must match canonical() in src/index.html exactly.
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

async function deriveKey(password, salt) {
  const base = await subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
}

if (!secret.phone) throw new Error('private/secret.json needs a "phone"');
if (!secret.orders?.length) throw new Error("private/secret.json needs at least one order");
secret.orders.forEach(validate);

const salt = rand(16);
const keys = [];
for (const order of secret.orders) {
  const key = await deriveKey(canonical(order), salt);
  const iv = rand(12);
  const ct = await subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(secret.phone));
  keys.push({ iv: b64(iv), ct: b64(ct) });
}

const payload = { iter: ITERATIONS, salt: b64(salt), keys };

const out = page
  .replace("/*__MENU__*/[]", () => JSON.stringify(menu))
  .replace("/*__PAYLOAD__*/null", () => JSON.stringify(payload));

if (out.includes(secret.phone.replace(/^\+1/, ""))) throw new Error("phone number leaked into the page");

mkdirSync("docs", { recursive: true });
writeFileSync("docs/index.html", out);
console.log(`Built docs/index.html — ${secret.orders.length} accepted order(s), ${(out.length / 1024).toFixed(1)} KB`);
