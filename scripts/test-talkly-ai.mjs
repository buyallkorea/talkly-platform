// Each suite gets its own process and ephemeral database. No remote DB is used.
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const files = readdirSync(new URL("../tests/talkly-ai/", import.meta.url))
  .filter((file) => file.endsWith(".mjs"))
  .sort();
if (!files.length) throw new Error("No TALKLY AI suites discovered");
const failed = [];
for (const file of files) {
  const result = spawnSync(process.execPath, ["tests/talkly-ai/" + file], {
    cwd: root,
    encoding: "utf8",
    timeout: 60_000,
    maxBuffer: 4 * 1024 * 1024,
    env: process.env,
  });
  if (result.status === 0) console.log("PASS " + file);
  else {
    failed.push(file);
    console.error("FAIL " + file);
    console.error(result.stdout, result.stderr, result.error?.message ?? "");
  }
}
console.log(`${files.length - failed.length}/${files.length} TALKLY AI suites passed`);
if (failed.length) process.exitCode = 1;
