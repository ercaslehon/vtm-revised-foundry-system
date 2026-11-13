/** Pure checks for updating only untouched imported world reference items. */
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function originalDigest(entry) {
  const bytes = new TextEncoder().encode(canonicalJson(entry));
  if (!globalThis.crypto?.subtle) return sha256Fallback(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

// Foundry may run over HTTP on a LAN, where Web Crypto's subtle API is unavailable.
// SHA-256 constants are fractional square/cube roots of the first primes (FIPS 180-4).
function sha256Fallback(bytes) {
  const primes = [];
  for (let n = 2; primes.length < 64; n += 1) {
    if (primes.every(p => p > Math.sqrt(n) || n % p !== 0)) primes.push(n);
  }
  const fraction = n => ((n % 1) * 0x100000000) >>> 0;
  const state = primes.slice(0, 8).map(p => fraction(Math.sqrt(p)));
  const constants = primes.map(p => fraction(Math.cbrt(p)));
  const padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
  padded.set(bytes); padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bytes.length / 0x20000000));
  view.setUint32(padded.length - 4, (bytes.length * 8) >>> 0);
  const rotate = (value, bits) => (value >>> bits) | (value << (32 - bits));
  const words = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i += 1) words[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i += 1) {
      const x = words[i - 15], y = words[i - 2];
      words[i] = words[i - 16] + (rotate(x, 7) ^ rotate(x, 18) ^ (x >>> 3))
        + words[i - 7] + (rotate(y, 17) ^ rotate(y, 19) ^ (y >>> 10));
    }
    let [a, b, c, d, e, f, g, h] = state;
    for (let i = 0; i < 64; i += 1) {
      const t1 = (h + (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25))
        + ((e & f) ^ (~e & g)) + constants[i] + words[i]) >>> 0;
      const t2 = ((rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22))
        + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    [a, b, c, d, e, f, g, h].forEach((value, i) => { state[i] = (state[i] + value) >>> 0; });
  }
  return state.map(value => value.toString(16).padStart(8, "0")).join("");
}

// Foundry adds default model fields. Compare only fields emitted by the old importer.
export function matchesImportedBaseline(actual, expected) {
  if (expected && typeof expected === "object" && !Array.isArray(expected)) {
    return Object.entries(expected).every(([key, value]) => matchesImportedBaseline(actual?.[key], value));
  }
  if ((actual == null || actual === "") && (expected == null || expected === "")) return true;
  return canonicalJson(actual) === canonicalJson(expected);
}

export function isUntouchedImportedItem(item, buildSystemData) {
  const original = item?.flags?.["vtm-revised"]?.original;
  if (!original || item.name !== (original.name ?? original.title ?? original.slug)) return false;
  if (original.type && original.type !== item.type) return false;
  return matchesImportedBaseline(item.system, buildSystemData(item.type, original));
}
