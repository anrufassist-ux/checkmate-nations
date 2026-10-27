// node stills.mjs 0 3 6 ...  (server on 8765)
import { createRequire } from 'node:module'; import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
mkdirSync('stills', { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto('http://127.0.0.1:8765/index.html'); await p.evaluate(() => window.ready);
for (const t of process.argv.slice(2)) { await p.evaluate(t => window.seek(t), +t); await p.locator('#c').screenshot({ path: `stills/s_${t}.png` }); }
await b.close();
