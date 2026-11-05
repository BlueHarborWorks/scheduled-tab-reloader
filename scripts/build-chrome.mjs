// Builds the Chrome Web Store package from extension/: the same files, with a Chrome manifest.
// Firefox runs background.js as an event page; Chrome runs the same file as a service worker.
//
//   npm run build:chrome  ->  dist/chrome-mv3/ and dist/scheduled_tab_reloader-<version>-chrome.zip

import { cpSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "extension");
const out = path.join(root, "dist", "chrome-mv3");

rmSync(out, { recursive: true, force: true });
cpSync(src, out, { recursive: true, filter: (p) => path.basename(p) !== ".DS_Store" });

const manifest = JSON.parse(readFileSync(path.join(src, "manifest.json"), "utf8"));
delete manifest.browser_specific_settings;
manifest.background = { service_worker: "background.js" };
// Chrome 120 lowered the alarm floor to 30 seconds, which background.js relies on.
manifest.minimum_chrome_version = "120";
writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

const zip = path.join(root, "dist", `scheduled_tab_reloader-${manifest.version}-chrome.zip`);
rmSync(zip, { force: true });
execFileSync("zip", ["-r", "-X", "-q", zip, "."], { cwd: out });
console.log(`Built ${path.relative(root, out)}/ and ${path.relative(root, zip)}`);
