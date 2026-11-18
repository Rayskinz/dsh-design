// Fails if any tracked text file starts with a UTF-8 byte-order mark (EF BB BF).
// DSH parses package.json with JSON.parse, which rejects a leading BOM.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const skip = new Set(['.git', 'node_modules']);
const bad = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else {
      const b = readFileSync(p);
      if (b.length >= 3 && b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) {
        bad.push(relative(root, p));
      }
    }
  }
}

walk(root);
if (bad.length) {
  console.error('UTF-8 BOM found in:\n  ' + bad.join('\n  '));
  process.exit(1);
}
console.log('bom-check: ok (no UTF-8 BOM in repo files)');
