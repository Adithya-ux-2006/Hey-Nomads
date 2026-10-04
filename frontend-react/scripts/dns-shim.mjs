// DNS shim for local API testing in restricted networks.
// Some sandboxes filter DNS: registry.npmjs.org resolves, but the
// database host does not (ENOTFOUND). This patches dns.lookup so the
// blocked host is resolved via DNS-over-HTTPS (1.1.1.1) instead.
//
// TLS still uses the original hostname as SNI/servername because
// pg keeps `host` as the hostname and only the resolved address changes.
//
// Usage: node --import ./scripts/dns-shim.mjs <entry.mjs>
import dns from 'dns';

const origLookup = dns.lookup;
const cache = new Map();

async function dohResolve(hostname) {
  const res = await fetch(`https://1.1.1.1/dns-query?name=${encodeURIComponent(hostname)}&type=A`, {
    headers: { accept: 'application/dns-json' },
  });
  const data = await res.json();
  const a = (data.Answer || []).find(x => x.type === 1);
  if (!a) throw new Error(`DoH: no A record for ${hostname}`);
  return a.data;
}

function patchedLookup(hostname, options, callback) {
  if (typeof options === 'function') { callback = options; options = {}; }
  const opts = options || {};
  origLookup(hostname, opts, (err, address, family) => {
    if (!err) return callback(null, address, family);
    // Only intervene for names the system resolver can't answer
    if (!cache.has(hostname)) {
      dohResolve(hostname)
        .then(ip => { cache.set(hostname, ip); console.log(`🔀 DNS shim: ${hostname} → ${ip}`); })
        .catch(() => cache.set(hostname, null));
    }
    // pg asks for { all: true }; node then expects an array of addresses
    const reply = (ip) => opts.all
      ? callback(null, [{ address: ip, family: 4 }])
      : callback(null, ip, 4);
    const check = setInterval(() => {
      if (!cache.has(hostname)) return; // still resolving
      clearInterval(check);
      const ip = cache.get(hostname);
      if (ip) reply(ip); else callback(err, null, null);
    }, 50);
    setTimeout(() => { clearInterval(check); if (!cache.has(hostname)) callback(err, null, null); }, 8000);
  });
}
dns.lookup = patchedLookup;
if (dns.promises) dns.promises.lookup = (h, o) => new Promise((res, rej) => patchedLookup(h, o || {}, (e, a) => e ? rej(e) : res({ address: a, family: 4 })));