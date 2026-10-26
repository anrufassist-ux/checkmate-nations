// node render.mjs --fps 30 --dur 27 --sub 4   (server on 8765)
import { createRequire } from 'node:module'; import { spawn } from 'node:child_process'; import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? Number(process.argv[i + 1]) : d; };
const FPS = arg('fps', 30), DUR = arg('dur', 27), SUB = arg('sub', 4);
mkdirSync('out', { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('pageerror', e => console.log('ERR', e.message));
await page.goto('http://127.0.0.1:8765/index.html'); await page.evaluate(() => window.ready);
const vf = `tmix=frames=${SUB},select='eq(mod(n\\,${SUB})\\,${SUB - 1})',setpts=N/${FPS}/TB`;
const ff = spawn('ffmpeg', ['-y','-loglevel','error','-f','image2pipe','-framerate',String(FPS*SUB),'-i','-',
  '-vf', vf, '-r', String(FPS), '-c:v','libx264','-crf','16','-pix_fmt','yuv420p','out/silent.mp4'], { stdio: ['pipe','inherit','inherit'] });
const total = Math.round(DUR * FPS * SUB);
for (let i = 0; i < total; i++) {
  await page.evaluate(t => window.seek(t), i / (FPS * SUB));
  const img = await page.locator('#c').screenshot({ type: 'jpeg', quality: 92 });
  if (!ff.stdin.write(img)) await new Promise(r => ff.stdin.once('drain', r));
  if (i % (FPS * SUB * 5) === 0) console.log(`rendered ${i / (FPS * SUB)}s / ${DUR}s`);
}
ff.stdin.end(); await new Promise(r => ff.on('close', r)); await browser.close();
