// Builds the MPP Router listings from a catalog snapshot (docs/research/evidence/mpprouter-catalog.json):
//   catalog/mpprouter.mainnet.json        router manifest (toolport router --manifest ..., on stellar:pubnet)
//   apps/web/public/catalog/mpprouter.json compact list for the web catalog page
//   apps/web/public/catalog/icons/<host>.<ext> favicon of each docs host, served from our own origin
// Only payable services are kept. Hand-written manifest entries (exact input schemas) win over generated ones.
// Icons already on disk are reused; --refresh-icons fetches them all again (a host keeps its old icon if the new
// fetch finds none), --offline uses only the icons on disk. Provider icons are the providers' own marks and belong
// to their owners; the catalog shows them only to identify each API.
// Usage: node scripts/import-mpprouter.mjs [snapshot.json] [--refresh-icons | --offline]
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";

const args = process.argv.slice(2);
const refreshIcons = args.includes("--refresh-icons");
const offline = args.includes("--offline");
const snapshotPath = args.find((a) => !a.startsWith("--")) ?? "docs/research/evidence/mpprouter-catalog.json";
const manifestPath = "catalog/mpprouter.mainnet.json";
const webPath = "apps/web/public/catalog/mpprouter.json";
const iconDir = "apps/web/public/catalog/icons";
const curatedIds = new Set(["exa-search", "firecrawl-scrape"]);

const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
const base = snapshot.base_url.replace(/\/$/, "");
const services = snapshot.services.filter((s) => s.payment_enabled && s.network === "stellar-mainnet" && s.asset === "USDC");

const httpsUrl = (url) => {
  try {
    return new URL(url).protocol === "https:" ? url : undefined;
  } catch {
    return undefined;
  }
};

const title = (s) => (/[–:]/.test(s.name) ? s.name : `${s.name}: ${s.description.split(/[.(]/)[0].trim().slice(0, 70)}`);

/** No upstream schemas exist, so accept the router's HTTP argument shape; the provider docs say what goes in it. */
function inputSchema(s) {
  const properties = { query: { type: "object", description: "Query string parameters" } };
  if (s.method !== "GET") properties.body = { type: "object", description: "JSON request body; see the provider docs" };
  return { type: "object", properties, additionalProperties: false };
}

const curated = JSON.parse(await readFile(manifestPath, "utf8")).filter((t) => curatedIds.has(t.id));
const curatedUrls = new Set(curated.map((t) => t.url));
const generated = services
  .filter((s) => !curatedUrls.has(base + s.public_path))
  .map((s) => ({
    id: s.id,
    title: title(s),
    // Price and docs stay out of the description so they don't match every search.
    description: s.description,
    priceHint: s.price,
    docs: httpsUrl(s.docs?.llms_txt ?? s.docs_url),
    network: "stellar:pubnet",
    transport: "http",
    url: base + s.public_path,
    method: s.method === "GET" ? "GET" : "POST",
    inputSchema: inputSchema(s),
  }));
await writeFile(manifestPath, JSON.stringify([...curated, ...generated], null, 2) + "\n");

const webServices = services
  .map((s) => ({
    id: s.id,
    name: title(s),
    provider: s.name.split(/\s+[–-]\s+/)[0],
    category: s.category.toLowerCase(),
    description: s.description,
    price: s.price,
    method: s.method,
    verified: s.payment_status === "verified",
    docs: httpsUrl(s.docs?.homepage ?? s.docs_url),
  }))
  .sort((a, b) => Number(b.verified) - Number(a.verified) || a.name.localeCompare(b.name));

const ICON_TIMEOUT_MS = 8000;
const ICON_MAX_BYTES = 72 * 1024;
const ICON_CONCURRENCY = 8;
const HTML_MAX_BYTES = 512 * 1024;
const USER_AGENT = "Mozilla/5.0 (compatible; toolport-catalog-import; +https://toolport.042067.xyz)";
const genericDocsHosts = new Set([new URL(base).hostname]);

const docsHost = (url) => {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && !genericDocsHosts.has(u.hostname) ? u.hostname : null;
  } catch {
    return null;
  }
};

async function fetchLimited(url, maxBytes, accept) {
  const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(ICON_TIMEOUT_MS), headers: { "user-agent": USER_AGENT, accept } });
  if (!res.ok || !res.body) return null;
  const chunks = [];
  let size = 0;
  for await (const chunk of res.body) {
    size += chunk.length;
    if (size > maxBytes) return null;
    chunks.push(chunk);
  }
  return { url: res.url || url, body: Buffer.concat(chunks) };
}

function imageExt(b) {
  if (b.length < 12) return null;
  if (b[0] === 0x89 && b.toString("latin1", 1, 4) === "PNG") return "png";
  if (b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) return "ico";
  if (b.toString("latin1", 0, 3) === "GIF") return "gif";
  if (b[0] === 0xff && b[1] === 0xd8) return "jpg";
  if (b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP") return "webp";
  return null;
}

const attr = (tag, name) => tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"))?.slice(1).find((v) => v !== undefined);

function iconLinks(html, pageUrl) {
  const found = [];
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    const rels = (attr(tag, "rel") ?? "").toLowerCase().split(/\s+/);
    const href = attr(tag, "href");
    if (!href) continue;
    const touch = rels.some((r) => r.startsWith("apple-touch-icon"));
    if (!touch && !rels.includes("icon")) continue;
    if (/svg/i.test(attr(tag, "type") ?? "") || /\.svg(\?|#|$)/i.test(href)) continue;
    const size = Math.max(0, ...(attr(tag, "sizes") ?? "").split(/\s+/).map((v) => Number(v.split(/x/i)[0]) || 0));
    const score = touch ? 4 : size === 0 ? 1 : size >= 32 && size <= 96 ? 0 : size > 96 ? 2 : 3;
    try {
      found.push({ url: new URL(href.replace(/&amp;/g, "&"), pageUrl).href, score });
    } catch {}
  }
  return found.sort((a, b) => a.score - b.score).map((c) => c.url);
}

async function tryIcon(url) {
  try {
    const got = await fetchLimited(url, ICON_MAX_BYTES, "image/*");
    const ext = got && imageExt(got.body);
    return ext ? { ext, body: got.body } : null;
  } catch {
    return null;
  }
}

async function iconsFromPage(pageUrl) {
  try {
    const page = await fetchLimited(pageUrl, HTML_MAX_BYTES, "text/html");
    if (!page) return [];
    const html = page.body.toString("utf8");
    const baseHref = html.match(/<base\b[^>]*>/i)?.[0];
    return iconLinks(html, (baseHref && attr(baseHref, "href") && new URL(attr(baseHref, "href"), page.url).href) || page.url);
  } catch {
    return [];
  }
}

async function findIcon(host, docsUrl) {
  const labels = host.split(".");
  const parents = labels.slice(1, -1).map((_, i) => labels.slice(i + 1).join("."));
  const steps = [
    () => iconsFromPage(docsUrl),
    async () => [`https://${host}/favicon.ico`],
    ...parents.flatMap((p) => [() => iconsFromPage(`https://${p}/`), async () => [`https://${p}/favicon.ico`]]),
  ];
  const tried = new Set();
  for (const step of steps) {
    for (const url of await step()) {
      if (tried.has(url)) continue;
      tried.add(url);
      const icon = await tryIcon(url);
      if (icon) return icon;
    }
  }
  return null;
}

await mkdir(iconDir, { recursive: true });
const onDisk = new Map((await readdir(iconDir)).map((f) => [f.replace(/\.[a-z]+$/, ""), f]));
const docsByHost = new Map();
for (const s of webServices) {
  const host = docsHost(s.docs);
  if (host && !docsByHost.has(host)) docsByHost.set(host, s.docs);
}
const iconByHost = new Map();
const queue = [...docsByHost];
let fetched = 0;
await Promise.all(
  Array.from({ length: ICON_CONCURRENCY }, async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const [host, docsUrl] = next;
      if (onDisk.has(host) && (offline || !refreshIcons)) {
        iconByHost.set(host, onDisk.get(host));
        continue;
      }
      if (offline) continue;
      const icon = await findIcon(host, docsUrl);
      if (!icon) {
        if (onDisk.has(host)) iconByHost.set(host, onDisk.get(host));
        continue;
      }
      const file = `${host}.${icon.ext}`;
      if (onDisk.has(host) && onDisk.get(host) !== file) await unlink(`${iconDir}/${onDisk.get(host)}`);
      await writeFile(`${iconDir}/${file}`, icon.body);
      iconByHost.set(host, file);
      fetched++;
    }
  }),
);
for (const [host, file] of onDisk) if (!docsByHost.has(host)) await unlink(`${iconDir}/${file}`);

const web = webServices.map((s) => {
  const file = iconByHost.get(docsHost(s.docs));
  return file ? { ...s, icon: `/catalog/icons/${file}` } : s;
});
await mkdir("apps/web/public/catalog", { recursive: true });
await writeFile(webPath, JSON.stringify({ source: base, generatedAt: snapshot.generated_at, network: "stellar:pubnet", services: web }) + "\n");

console.log(`manifest: ${curated.length} curated + ${generated.length} generated; web: ${web.length} services (${web.filter((s) => s.verified).length} verified)`);
console.log(`icons: ${iconByHost.size} of ${docsByHost.size} docs hosts (${fetched} fetched now); ${web.filter((s) => s.icon).length} services with an icon, ${web.filter((s) => !s.icon).length} with the fallback`);
