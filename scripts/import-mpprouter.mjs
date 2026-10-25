// Builds the MPP Router listings from a catalog snapshot (docs/research/evidence/mpprouter-catalog.json):
//   catalog/mpprouter.mainnet.json        router manifest (toolport router --manifest ..., on stellar:pubnet)
//   apps/web/public/catalog/mpprouter.json compact list for the web catalog page
// Only payable services are kept. Hand-written manifest entries (exact input schemas) win over generated ones.
// Usage: node scripts/import-mpprouter.mjs [snapshot.json]
import { mkdir, readFile, writeFile } from "node:fs/promises";

const snapshotPath = process.argv[2] ?? "docs/research/evidence/mpprouter-catalog.json";
const manifestPath = "catalog/mpprouter.mainnet.json";
const webPath = "apps/web/public/catalog/mpprouter.json";
const curatedIds = new Set(["exa-search", "firecrawl-scrape"]);

const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
const base = snapshot.base_url.replace(/\/$/, "");
const services = snapshot.services.filter((s) => s.payment_enabled && s.network === "stellar-mainnet" && s.asset === "USDC");

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
    docs: s.docs?.llms_txt ?? s.docs_url,
    network: "stellar:pubnet",
    transport: "http",
    url: base + s.public_path,
    method: s.method === "GET" ? "GET" : "POST",
    inputSchema: inputSchema(s),
  }));
await writeFile(manifestPath, JSON.stringify([...curated, ...generated], null, 2) + "\n");

const web = services
  .map((s) => ({
    id: s.id,
    name: title(s),
    provider: s.name.split(/\s+[–-]\s+/)[0],
    category: s.category.toLowerCase(),
    description: s.description,
    price: s.price,
    method: s.method,
    verified: s.payment_status === "verified",
    docs: s.docs?.homepage ?? s.docs_url,
  }))
  .sort((a, b) => Number(b.verified) - Number(a.verified) || a.name.localeCompare(b.name));
await mkdir("apps/web/public/catalog", { recursive: true });
await writeFile(webPath, JSON.stringify({ source: base, generatedAt: snapshot.generated_at, network: "stellar:pubnet", services: web }) + "\n");

console.log(`manifest: ${curated.length} curated + ${generated.length} generated; web: ${web.length} services (${web.filter((s) => s.verified).length} verified)`);
