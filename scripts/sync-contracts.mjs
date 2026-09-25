// Copy the API's contracts/ into src/contracts. `--check` fails if the copy is stale.
// Source: $API_CONTRACTS_DIR, or ../recruit-crm-api/contracts (sibling checkout).
import { cpSync, existsSync, readdirSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const src = resolve(process.env.API_CONTRACTS_DIR ?? "../recruit-crm-api/contracts");
const dest = resolve("src/contracts");
const check = process.argv.includes("--check");

if (!existsSync(src)) {
  console.error(`Contracts source not found at ${src}. Clone recruit-crm-api next to this repo or set API_CONTRACTS_DIR.`);
  process.exit(1);
}

const files = (root) => (existsSync(root) ? walkFrom(root) : []);
function walkFrom(root) {
  const out = [];
  const go = (d) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) go(p);
      else out.push(relative(root, p));
    }
  };
  go(root);
  return out.sort();
}

if (check) {
  const a = files(src);
  const b = files(dest);
  const stale = a.filter((f) => !b.includes(f) || readFileSync(join(src, f), "utf8") !== readFileSync(join(dest, f), "utf8"));
  const extra = b.filter((f) => !a.includes(f));
  if (stale.length || extra.length) {
    console.error(`src/contracts is out of date with ${src}:\n${[...stale, ...extra].map((f) => `  - ${f}`).join("\n")}\nRun: npm run contracts:sync`);
    process.exit(1);
  }
  console.log("contracts are up to date");
} else {
  // Copy then swap, so concurrent readers never see a half-written folder.
  const tmp = `${dest}.tmp-${process.pid}`;
  const old = `${dest}.old-${process.pid}`;
  cpSync(src, tmp, { recursive: true });
  if (existsSync(dest)) renameSync(dest, old);
  renameSync(tmp, dest);
  rmSync(old, { recursive: true, force: true });
  console.log(`synced ${files(dest).length} files from ${src}`);
}
