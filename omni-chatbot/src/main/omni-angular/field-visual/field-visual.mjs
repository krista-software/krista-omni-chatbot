/**
 * Field visual-regression runner (local-only pilot).
 *
 * Serves the harness built by `ng build --configuration visual`, screenshots each
 * field case individually, and compares it against a committed baseline PNG.
 *
 * Usage:
 *   npm run build:visual        # build the harness first
 *   npm run test:visual         # compare against baselines
 *   npm run test:visual -- -u   # accept current rendering as the new baseline
 *
 * Deliberately LOCAL-ONLY and not wired into gradle or CI: font rasterisation
 * differs between macOS and CI Linux, so baselines generated here will not match
 * a Linux runner. Containerise before considering CI.
 *
 * Uses playwright-core against the SYSTEM Chrome (channel: 'chrome') so no
 * browser download is required — same approach as launcher-e2e.mjs.
 * Override with CHROMIUM_PATH=/path/to/chrome.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { PNG } = require('pngjs');
// pixelmatch v6 is ESM-first: under createRequire it arrives as a module
// namespace object, so the callable lives on .default.
const pixelmatchModule = require('pixelmatch');
const pixelmatch = typeof pixelmatchModule === 'function'
  ? pixelmatchModule
  : pixelmatchModule.default;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, '..', 'dist', 'visual', 'browser');
const BASELINE_DIR = path.join(__dirname, 'baselines');
const OUTPUT_DIR = path.join(__dirname, 'output');

const UPDATE = process.argv.includes('-u') || process.argv.includes('--update');

/** Per-pixel colour tolerance. Low enough to catch a 2px size change, high
 *  enough to absorb sub-pixel antialiasing jitter between runs. */
const PIXEL_THRESHOLD = 0.1;
/** Fraction of differing pixels tolerated before a case is reported as changed. */
const MAX_DIFF_RATIO = 0.001;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

/** The application builder names the emitted index after the configured source
 *  file, so this build produces index.visual.html rather than index.html. */
function resolveIndex() {
  for (const name of ['index.visual.html', 'index.html']) {
    if (fs.existsSync(path.join(DIST, name))) {
      return name;
    }
  }
  return null;
}

function serve(indexName) {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    let filePath = path.join(DIST, urlPath === '/' ? indexName : urlPath);
    if (!filePath.startsWith(DIST)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(DIST, indexName);
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
  return server;
}

function comparePng(baselineBuf, actualBuf, diffPath) {
  const baseline = PNG.sync.read(baselineBuf);
  const actual = PNG.sync.read(actualBuf);

  if (baseline.width !== actual.width || baseline.height !== actual.height) {
    return {
      changed: true,
      reason: `size ${baseline.width}x${baseline.height} -> ${actual.width}x${actual.height}`
    };
  }

  const diff = new PNG({ width: baseline.width, height: baseline.height });
  const differing = pixelmatch(
    baseline.data, actual.data, diff.data,
    baseline.width, baseline.height,
    { threshold: PIXEL_THRESHOLD }
  );
  const ratio = differing / (baseline.width * baseline.height);
  if (ratio > MAX_DIFF_RATIO) {
    fs.writeFileSync(diffPath, PNG.sync.write(diff));
    return { changed: true, reason: `${differing} px differ (${(ratio * 100).toFixed(3)}%)` };
  }
  return { changed: false };
}

async function main() {
  const indexName = resolveIndex();
  if (!indexName) {
    console.error(`Harness build not found at ${DIST}\nRun: npm run build:visual`);
    process.exit(1);
  }
  fs.mkdirSync(BASELINE_DIR, { recursive: true });
  fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const server = serve(indexName);
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;

  const browser = process.env.CHROMIUM_PATH
    ? await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
    : await chromium.launch({ channel: 'chrome' });

  // Pinned viewport + DPR: screenshot dimensions must not depend on the host display.
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1
  });

  let written = 0, unchanged = 0, changed = 0, added = 0;
  const failures = [];

  try {
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-vt]');

    const ids = await page.evaluate(() => window.__vtCaseIds || []);
    if (ids.length === 0) {
      throw new Error('no cases enumerated — harness failed to bootstrap');
    }

    for (const id of ids) {
      // One case per page load. Rendering all cases together let a height change
      // in one shift the rest, re-rasterising their text at different sub-pixel
      // offsets and reporting unrelated fields as changed.
      await page.goto(`http://127.0.0.1:${port}/?case=${encodeURIComponent(id)}`,
        { waitUntil: 'networkidle' });
      await page.waitForSelector(`[data-vt="${id}"]`);
      await page.evaluate(() => document.fonts.ready);

      const el = await page.$(`[data-vt="${id}"]`);
      const actual = await el.screenshot();
      const baselinePath = path.join(BASELINE_DIR, `${id}.png`);
      const actualPath = path.join(OUTPUT_DIR, `${id}.actual.png`);

      if (!fs.existsSync(baselinePath)) {
        fs.writeFileSync(baselinePath, actual);
        console.log(`  + ${id} (baseline created)`);
        added++;
        continue;
      }
      if (UPDATE) {
        fs.writeFileSync(baselinePath, actual);
        written++;
        continue;
      }

      const result = comparePng(
        fs.readFileSync(baselinePath), actual,
        path.join(OUTPUT_DIR, `${id}.diff.png`)
      );
      if (result.changed) {
        fs.writeFileSync(actualPath, actual);
        console.log(`  ✗ ${id} — ${result.reason}`);
        failures.push(id);
        changed++;
      } else {
        unchanged++;
      }
    }
  } finally {
    await browser.close();
    server.close();
  }

  console.log('');
  if (UPDATE) {
    console.log(`Baselines updated: ${written} (new: ${added})`);
    return;
  }
  console.log(`unchanged: ${unchanged}   changed: ${changed}   new baselines: ${added}`);
  if (changed > 0) {
    console.log(`\nDiffs written to ${path.relative(process.cwd(), OUTPUT_DIR)}`);
    console.log('Review each one. If the change is intentional: npm run test:visual -- -u');
    process.exit(1);
  }
  console.log('No visual changes.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
