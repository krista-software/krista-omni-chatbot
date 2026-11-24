// =============================================================================
// Launcher embed-compatibility E2E suite (64 checks)
//
// Verifies the launcher bootstrap contract (bootstrap/launcher.ts +
// bootstrap/launcher-core.ts) against every embed style seen in the field:
//
//   legacy       function-scoped options + new Chatbot(options).init() at
//                doc-ready (old "Get Script Element" pattern) — fast AND slow
//                core download (stub-capture path)
//   modern       top-level global `options`, no manual init (documented snippet)
//   bare         one-line <script launcher.js> only (Integration Settings page)
//   adminBare    one-liner + admin-configured bubble served via /config
//                (Integration Settings chatBubble icon/text/position/color)
//   precedence   defaults < admin chatBubble < user chatBubble merge order
//   legacyLate   customer init long after auto-init already rendered defaults
//   adani        launcher.js included TWICE (static + dynamically injected)
//   aemlbot      real-world AEMLBot.js pattern: init() then SYNCHRONOUS one-shot
//                DOM injection into .bubble-btn (must survive config re-render)
//   aemlbotFast  same injection the instant the real class exists (sync shell)
//   noHost       new Chatbot({}) relying on location-derived host
//   serviceUnavailable  cached app boots but its APIs are down -> app reports,
//                launcher shows the "We'll be back soon" overlay
//   reloadHealthy / reloadToErrorPage  in-place iframe reloads mid-session
//                (header Restart / language change): healthy -> no overlay &
//                iframe stays visible; landing on a raw 502 page -> overlay
//
// How to run (from omni-chatbot/src/main/omni-angular):
//   npm run build-launcher        # build bootstrap/launcher.js + core first
//   npm run test:launcher
//
// Requirements: Node >= 18 and a locally installed Google Chrome
// (playwright-core drives it via channel "chrome" — no browser download).
// Override the browser with CHROMIUM_PATH=/path/to/chrome if needed.
// =============================================================================
import http from 'http';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url))); // omni-angular/
const BOOT = path.join(ROOT, 'bootstrap');

// Launcher core filename follows LAUNCHER_VERSION in .env (single source).
const envFile = readFileSync(path.join(ROOT, '.env'), 'utf8');
const LAUNCHER_VERSION = (envFile.match(/^LAUNCHER_VERSION=(\S+)/m) || [])[1] || 'v1';
const CORE_FILENAME = `launcher-core-${LAUNCHER_VERSION}.js`;

let launcherJs, coreJs;
try {
  launcherJs = readFileSync(path.join(BOOT, 'launcher.js'), 'utf8')
    .replaceAll('__chatbotBasePath__', '/')
    .replaceAll('__cdnCacheVersion__', '0');
  coreJs = readFileSync(path.join(BOOT, CORE_FILENAME), 'utf8');
} catch (e) {
  console.error(`Missing built launcher artifacts (${e.message}).`);
  console.error('Run "npm run build-launcher" first.');
  process.exit(2);
}

const CUSTOM_ICON = '<svg id="customIcon" width="10" height="10"></svg>';

function hostPage(mode) {
  const embeds = {
    legacy: `
      <script>
        function createChatbotClient() {
          const options = {
            position: 'bottomLeft',
            host: '/chatbot/0/',
            chatBubble: { cssClass: 'bubble-btn kristaBubble', icon: '${CUSTOM_ICON}' }
          };
          window.kristaChat = new Chatbot(options);
          window.kristaChat.init();
        }
        // simulate jQuery $(document).ready
        document.addEventListener('DOMContentLoaded', function () { setTimeout(createChatbotClient, 30); });
      </script>`,
    modern: `
      <script>
        var options = {
          host: '/chatbot/0/',
          chatBubble: { cssClass: 'bubble-btn kristaBubble', icon: '${CUSTOM_ICON}', position: 'bottomLeft' }
        };
      </script>`,
    bare: '',
    legacyLate: `
      <script>
        setTimeout(function () {
          const options = {
            position: 'bottomLeft',
            host: '/chatbot/0/',
            chatBubble: { cssClass: 'bubble-btn kristaBubble', icon: '${CUSTOM_ICON}' }
          };
          window.kristaChat = new Chatbot(options);
          window.kristaChat.init();
        }, 1500);
      </script>`,
    // Replica of the REAL Adani page: launcher.js twice (static head +
    // AEMLBot.js dynamic injection) + AEMLBot's own new Chatbot(options).init()
    // fired at jQuery-doc-ready timing (inside the settle window).
    adani: `
      <script>
        setTimeout(function () {
          var s = document.createElement('script');
          s.src = '/chatbot/ui/launcher.js';
          document.head.appendChild(s);
        }, 150);
        document.addEventListener('DOMContentLoaded', function () {
          setTimeout(function () {
            const options = {
              position: 'bottomRight',
              host: '/chatbot/0/',
              chatBubble: { cssClass: 'bubble-btn kristaBubble', icon: '${CUSTOM_ICON}' }
            };
            window.kristaChat = new Chatbot(options);
            window.kristaChat.init();
          }, 50);
        });
      </script>`,
    // FAITHFUL replica of AEMLBot.js: on window 'load', inject launcher.js
    // again; in its onload call new Chatbot(options).init() and then
    // SYNCHRONOUSLY inject .customizedChatBot into .bubble-btn (AskElectraText
    // pattern — one shot, bails out if no bubble exists). The injected tag
    // must survive the config-resolution re-render.
    aemlbot: `
      <script>
        function AskElectraText() {
          var bubbleBtn = document.getElementsByClassName('bubble-btn')[0];
          if (!document.body.contains(bubbleBtn)) return;
          var myDiv = document.createElement('div');
          myDiv.classList.add('customizedChatBot');
          var div = document.createElement('div');
          div.classList.add('sideText');
          var p = document.createElement('p');
          p.innerText = 'Chat with us';
          div.appendChild(p);
          myDiv.appendChild(div);
          bubbleBtn.appendChild(myDiv);
        }
        // Prod-representative timing: on the real site window 'load' fires
        // seconds AFTER the core is loaded and auto-init already rendered the
        // default bubble (localhost 'load' would fire before the core).
        window.addEventListener('load', function () {
          setTimeout(function () {
            var s = document.createElement('script');
            s.src = '/chatbot/ui/launcher.js';
            s.async = true;
            s.onload = function () {
              var options = {
                position: 'bottomRight',
                host: '/chatbot/0/',
                chatBubble: { icon: '${CUSTOM_ICON}' }
              };
              var kristaBot = new window.Chatbot(options);
              kristaBot.init();
              AskElectraText();
            };
            document.head.appendChild(s);
          }, 600);
        });
      </script>`,
    // Same AEMLBot pattern but init fires the moment the REAL class is
    // available — BEFORE any bubble was rendered. The synchronous shell in
    // init() must guarantee .bubble-btn exists when AskElectraText runs.
    aemlbotFast: `
      <script>
        function AskElectraText() {
          var bubbleBtn = document.getElementsByClassName('bubble-btn')[0];
          if (!document.body.contains(bubbleBtn)) return;
          var myDiv = document.createElement('div');
          myDiv.classList.add('customizedChatBot');
          var div = document.createElement('div');
          div.classList.add('sideText');
          var p = document.createElement('p');
          p.innerText = 'Chat with us';
          div.appendChild(p);
          myDiv.appendChild(div);
          bubbleBtn.appendChild(myDiv);
        }
        (function tryInit() {
          if (window.Chatbot && window.Chatbot.prototype && typeof window.Chatbot.prototype.init === 'function') {
            var kristaBot = new window.Chatbot({ host: '/chatbot/0/', chatBubble: { icon: '${CUSTOM_ICON}' } });
            kristaBot.init();
            AskElectraText();
          } else {
            setTimeout(tryInit, 10);
          }
        })();
      </script>`,
    // No host in options: the constructor must derive the host from the page
    // location and the sync shell/config merges must NOT clobber it with
    // defaultConfig's placeholder (http://localhost:3000).
    noHost: `
      <script>
        (function tryInit() {
          if (window.Chatbot && window.Chatbot.prototype && typeof window.Chatbot.prototype.init === 'function') {
            new window.Chatbot({ chatBubble: { icon: '${CUSTOM_ICON}' } }).init();
          } else {
            setTimeout(tryInit, 10);
          }
        })();
      </script>`,
    // Same as adani but the init fires LATE (well past the settle window) —
    // worst case: auto-init already ran with defaults; the late real init
    // must self-correct to the customer's bubble.
    adaniLate: `
      <script>
        setTimeout(function () {
          var s = document.createElement('script');
          s.src = '/chatbot/ui/launcher.js';
          document.head.appendChild(s);
        }, 150);
        setTimeout(function () {
          const options = {
            position: 'bottomRight',
            host: '/chatbot/0/',
            chatBubble: { cssClass: 'bubble-btn kristaBubble', icon: '${CUSTOM_ICON}' }
          };
          window.kristaChat = new Chatbot(options);
          window.kristaChat.init();
        }, 700);
      </script>`
  };
  return `<!DOCTYPE html><html><head>
    <script src="/chatbot/ui/launcher.js"></script>
    ${embeds[mode]}
  </head><body><h1>host page ${mode}</h1></body></html>`;
}

let configCalls = 0;
let launcherFileCalls = 0;
let adminBubble = false;
let uiDown = false;
let appApisDown = false;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  if (p === '/host.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(hostPage(url.searchParams.get('mode') || 'bare'));
  } else if (p === '/chatbot/ui/launcher.js') {
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    res.end(launcherJs);
  } else if (p === '/chatbot/0/launcher-file') {
    launcherFileCalls++;
    // slow-core mode: delay the core when the referring page has slow=1
    const delay = (req.headers.referer || '').includes('slow=1') ? 600 : 0;
    setTimeout(() => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(CORE_FILENAME);
    }, delay);
  } else if (p === `/chatbot/0/ui/${CORE_FILENAME}`) {
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    res.end(coreJs);
  } else if (p === '/chatbot/0/ui/') {
    if (uiDown) {
      // Simulated outage: the chat document itself is a raw proxy error
      // page — no script, so no htmlLoaded beacon can ever be posted.
      res.writeHead(502, { 'Content-Type': 'text/html' });
      res.end('<html><body><h1>502 Bad Gateway</h1><p>nginx</p></body></html>');
      return;
    }
    // Fake chat app document: boots normally (htmlLoaded beacon + initDone).
    // appApisDown -> afterwards reports that its boot-critical APIs cannot
    // reach the server (serviceUnavailable), like a CACHED app in an outage.
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!DOCTYPE html><html><head><script>
      parent.postMessage('{"messageType": "htmlLoaded"}', '*');
      window.addEventListener('load', function () {
        parent.postMessage('{"messageType": "initDone"}', '*');
        if (${appApisDown}) {
          setTimeout(function () {
            parent.postMessage('{"messageType": "serviceUnavailable"}', '*');
          }, 300);
        }
      });
    </script></head><body>fake chat app</body></html>`);
  } else if (p === '/setuidown') {
    uiDown = url.searchParams.get('down') === '1';
    appApisDown = url.searchParams.get('apis') === '1';
    res.writeHead(200); res.end('ok');
  } else if (p === '/chatbot/0/config') {
    configCalls++;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      config: adminBubble
        ? {
            startAsBubble: true,
            // Admin-configured bubble (Integration Settings -> uiConfigJson)
            chatBubble: {
              icon: '<svg id="adminIcon" width="10" height="10"></svg>',
              text: 'Namaste',
              position: 'topRight',
              backgroundColor: '#123456'
            }
          }
        : { startAsBubble: true }
    }));
  } else if (p === '/setconfig') {
    adminBubble = url.searchParams.get('admin') === '1';
    res.writeHead(200); res.end('ok');
  } else if (p === '/config') {
    // Served at the page root for the noHost scenario (location-derived host)
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ config: { startAsBubble: true } }));
  } else if (p === '/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ configCalls, launcherFileCalls }));
  } else if (p === '/reset') {
    configCalls = 0;
    launcherFileCalls = 0;
    res.writeHead(200); res.end('ok');
  } else {
    res.writeHead(404); res.end('nf: ' + p);
  }
});

function inspect() {
  const bubbles = document.querySelectorAll('.chat-bubble');
  const bubble = bubbles[0];
  return {
    bubbleCount: bubbles.length,
    bubbleClass: bubble ? bubble.className : null,
    customIcon: !!document.querySelector('.bubble-btn-icon #customIcon'),
    btnClass: document.querySelector('button[accesskey]') ? document.querySelector('button[accesskey]').className : null,
    started: window.__kristaChatbotStarted === true,
    hidden: bubble ? bubble.classList.contains('hide') : null
  };
}

const results = [];
function check(name, cond, detail) {
  results.push({ name, pass: !!cond, detail });
}

function launchBrowser() {
  if (process.env.CHROMIUM_PATH) {
    return chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  }
  // Use the locally installed Google Chrome — no browser download needed.
  return chromium.launch({ channel: 'chrome' });
}

async function run() {
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const browser = await launchBrowser();

  async function load(mode, settleMs, extraQuery = '') {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(`http://localhost:${port}/host.html?mode=${mode}${extraQuery}`);
    await page.waitForTimeout(settleMs);
    const state = await page.evaluate(inspect);
    await page.close();
    return { state, errors };
  }

  // 0) LEGACY + SLOW CORE: the common prod case — customer's
  //    new Chatbot(options).init() runs at doc-ready BEFORE the core script
  //    arrives, so it hits the STUB; capture must preserve their options.
  {
    const { state, errors } = await load('legacy', 2500, '&slow=1');
    check('legacy+slowCore: bubble rendered once', state.bubbleCount === 1, state);
    check('legacy+slowCore: custom icon applied via stub capture', state.customIcon, state);
    check('legacy+slowCore: top-level position honored (bottomLeft)', (state.bubbleClass || '').includes('bottomLeft'), state.bubbleClass);
    check('legacy+slowCore: no page errors', errors.length === 0, errors);
  }

  // 1) LEGACY: options must be captured from new Chatbot(options), incl. custom icon,
  //    top-level position honored, exactly one bubble, no page errors.
  {
    const { state, errors } = await load('legacy', 1200);
    check('legacy: bubble rendered once', state.bubbleCount === 1, state);
    check('legacy: custom icon applied (captured options)', state.customIcon, state);
    check('legacy: custom cssClass applied', state.btnClass === 'bubble-btn kristaBubble', state.btnClass);
    check('legacy: top-level position honored (bottomLeft)', (state.bubbleClass || '').includes('bottomLeft'), state.bubbleClass);
    check('legacy: bubble visible (hide removed)', state.hidden === false, state.hidden);
    check('legacy: no page errors', errors.length === 0, errors);
  }

  // 2) MODERN: top-level global options, no manual call.
  {
    const { state, errors } = await load('modern', 1200);
    check('modern: bubble rendered once', state.bubbleCount === 1, state);
    check('modern: custom icon applied (global options)', state.customIcon, state);
    check('modern: chatBubble.position honored (bottomLeft)', (state.bubbleClass || '').includes('bottomLeft'), state.bubbleClass);
    check('modern: no page errors', errors.length === 0, errors);
  }

  // 3) BARE: script tag only -> defaults, single init.
  {
    const { state, errors } = await load('bare', 1200);
    check('bare: bubble rendered once with defaults', state.bubbleCount === 1, state);
    check('bare: default icon (no custom icon)', !state.customIcon, state);
    check('bare: default position bottomRight', (state.bubbleClass || '').includes('bottomRight'), state.bubbleClass);
    check('bare: started flag set', state.started, state);
    check('bare: no page errors', errors.length === 0, errors);
  }

  // 3b) BARE + ADMIN CONFIG: one-liner embed where the /config response
  //     carries an admin-configured bubble (Integration Settings chatBubble).
  //     The bubble must render the ADMIN icon/text/position.
  {
    await fetch(`http://localhost:${port}/setconfig?admin=1`);
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(`http://localhost:${port}/host.html?mode=bare`);
    await page.waitForTimeout(1200);
    const state = await page.evaluate(() => ({
      bubbles: document.querySelectorAll('.chat-bubble').length,
      bubbleClass: document.querySelector('.chat-bubble')?.className || null,
      adminIcon: !!document.querySelector('.bubble-btn-icon #adminIcon'),
      text: document.querySelector('.bubble-btn-text')?.innerText || null,
      borderColor: document.querySelector('.bubble-btn')?.style.borderColor || null
    }));
    await page.close();
    check('adminBare: single bubble', state.bubbles === 1, state);
    check('adminBare: admin icon applied from /config', state.adminIcon, state);
    check('adminBare: admin bubble text applied', state.text === 'Namaste', state);
    check('adminBare: admin position applied (topRight)', (state.bubbleClass || '').includes('topRight'), state.bubbleClass);
    check('adminBare: admin backgroundColor branding applied', (state.borderColor || '').includes('18, 52, 86'), state.borderColor);
    check('adminBare: no page errors', errors.length === 0, errors);
  }

  // 3c) MERGE PRECEDENCE with admin config still active:
  //     defaults < admin chatBubble < user chatBubble. The legacy embed's
  //     chatBubble.icon must beat the admin icon; admin chatBubble.position
  //     (topRight) beats the embed's LEGACY top-level position (bottomLeft) —
  //     only user chatBubble.position would outrank it.
  {
    const { state, errors } = await load('legacy', 1200);
    check('precedence: user chatBubble.icon beats admin icon', state.customIcon, state);
    check('precedence: admin chatBubble.position beats legacy top-level position', (state.bubbleClass || '').includes('topRight'), state.bubbleClass);
    check('precedence: no page errors', errors.length === 0, errors);
    await fetch(`http://localhost:${port}/setconfig?admin=0`);
  }

  // 4) LEGACY-LATE: legacy call fires AFTER auto-init already ran with defaults.
  //    Old behavior: second real instance re-inits. Must not error, must keep a
  //    single bubble, and ends up with the customer's icon (self-corrects).
  {
    const { state, errors } = await load('legacyLate', 3000);
    check('legacyLate: still a single bubble', state.bubbleCount === 1, state);
    check('legacyLate: customer icon applied after late init', state.customIcon, state);
    check('legacyLate: no page errors', errors.length === 0, errors);
  }

  // 5) ADANI REPLICA: launcher.js included TWICE (static + AEMLBot-style
  //    dynamic injection) + their own new Chatbot(options).init() with a
  //    custom avatar. The unfixed launcher ran 3 inits and the last
  //    default-config render wiped the avatar ("flash then disappear").
  //    Fixed launcher must end with the avatar visible, a single bubble,
  //    and NO redundant default-config init.
  {
    await fetch(`http://localhost:${port}/reset`);
    const { state, errors } = await load('adani', 3000);
    const stats = await (await fetch(`http://localhost:${port}/stats`)).json();
    check('adani: single bubble', state.bubbleCount === 1, state);
    check('adani: avatar icon persists (no default stomp)', state.customIcon, state);
    check('adani: custom cssClass persists', state.btnClass === 'bubble-btn kristaBubble', state.btnClass);
    check('adani: no page errors (double launcher.js include)', errors.length === 0, errors);
    check('adani: exactly 1 config-driven init (was 3 in prod)', stats.configCalls === 1, stats);
    check('adani: exactly 1 bootstrap (launcher-file fetched once)', stats.launcherFileCalls === 1, stats);
  }

  // 6) AEMLBOT FAITHFUL replica: injection of .customizedChatBot right after
  //    init() (with bail-out guard) must survive the config re-render.
  //    This was the exact prod defect: tag flashed then was wiped.
  {
    await fetch(`http://localhost:${port}/reset`);
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(`http://localhost:${port}/host.html?mode=aemlbot`);
    await page.waitForTimeout(3000);
    const state = await page.evaluate(() => ({
      bubbles: document.querySelectorAll('.chat-bubble').length,
      avatar: !!document.querySelector('.bubble-btn-icon #customIcon'),
      tag: !!document.querySelector('.bubble-btn .customizedChatBot'),
      tagText: document.querySelector('.customizedChatBot .sideText p')?.innerText || null
    }));
    await page.close();
    check('aemlbot: single bubble', state.bubbles === 1, state);
    check('aemlbot: avatar applied by late init', state.avatar, state);
    check('aemlbot: customizedChatBot SURVIVES config re-render', state.tag, state);
    check('aemlbot: sideText content intact', state.tagText === 'Chat with us', state);
    check('aemlbot: no page errors', errors.length === 0, errors);
  }

  // 6b) AEMLBOT FAST: init the instant the real class exists (no bubble yet).
  //     init()'s synchronous shell must make .bubble-btn available immediately.
  {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(`http://localhost:${port}/host.html?mode=aemlbotFast`);
    await page.waitForTimeout(2000);
    const state = await page.evaluate(() => ({
      bubbles: document.querySelectorAll('.chat-bubble').length,
      avatar: !!document.querySelector('.bubble-btn-icon #customIcon'),
      tag: !!document.querySelector('.bubble-btn .customizedChatBot'),
      visible: document.querySelector('.chat-bubble') ? !document.querySelector('.chat-bubble').classList.contains('hide') : false
    }));
    await page.close();
    check('aemlbotFast: single bubble', state.bubbles === 1, state);
    check('aemlbotFast: avatar applied', state.avatar, state);
    check('aemlbotFast: injection into sync shell survives', state.tag, state);
    check('aemlbotFast: bubble revealed after config', state.visible, state);
    check('aemlbotFast: no page errors', errors.length === 0, errors);
  }

  // 6c) NO-HOST embed: constructor derives host from page location; the
  //     merges in init()/applyChatbotConfig must keep it (config must load
  //     from the derived origin, proven by the custom icon rendering).
  {
    const { state, errors } = await load('noHost', 2000);
    check('noHost: bubble rendered from location-derived host', state.bubbleCount === 1 && state.customIcon, state);
    check('noHost: bubble visible', state.hidden === false, state);
    check('noHost: no page errors', errors.length === 0, errors);
  }

  // 6d) SERVICE UNAVAILABLE reported by the chat app: during an outage the
  //     app often boots fine from cached assets and only its APIs fail (502).
  //     The launcher cannot see cross-origin API traffic, so the app posts
  //     'serviceUnavailable' — the launcher must hide the iframe and show the
  //     "We'll be back soon" overlay.
  {
    await fetch(`http://localhost:${port}/setuidown?apis=1`);
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(`http://localhost:${port}/host.html?mode=bare`);
    await page.waitForTimeout(800);
    await page.click('.bubble-btn');
    await page.waitForTimeout(1500);
    const state = await page.evaluate(() => ({
      overlay: !!document.querySelector('.chatbot-unavailable-overlay'),
      overlayTitle: document.querySelector('.chatbot-unavailable-title')?.innerText || null,
      iframeHidden: document.querySelector('#krista-chatbot-iFrame')?.style.visibility === 'hidden',
      retryBtn: !!document.querySelector('.chatbot-unavailable-retry-btn')
    }));
    await page.close();
    await fetch(`http://localhost:${port}/setuidown`);
    check('serviceUnavailable: overlay shown over broken chat', state.overlay, state);
    check('serviceUnavailable: iframe hidden', state.iframeHidden, state);
    check('serviceUnavailable: retry button present', state.retryBtn, state);
    check('serviceUnavailable: no page errors', errors.length === 0, errors);
  }

  // 6e) IN-PLACE RELOAD, healthy server: the app reloads itself mid-session
  //     (header Restart / language change). The fresh document posts a new
  //     beacon — NO overlay, iframe must stay visible (regression guard for
  //     the onload-vs-beacon task-ordering race: an eager hide here blanked
  //     a working chat until initDone).
  {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(`http://localhost:${port}/host.html?mode=bare`);
    await page.waitForTimeout(800);
    await page.click('.bubble-btn');
    await page.waitForTimeout(1000);
    const chatFrame = page.frames().find(f => f.url().includes('/chatbot/0/ui/'));
    await chatFrame.evaluate(() => window.location.reload());
    await page.waitForTimeout(1500);
    const state = await page.evaluate(() => ({
      overlay: !!document.querySelector('.chatbot-unavailable-overlay'),
      iframeVisible: document.querySelector('#krista-chatbot-iFrame')?.style.visibility !== 'hidden'
    }));
    await page.close();
    check('reloadHealthy: no overlay after in-place reload', !state.overlay, state);
    check('reloadHealthy: iframe stays visible', state.iframeVisible, state);
    check('reloadHealthy: no page errors', errors.length === 0, errors);
  }

  // 6f) IN-PLACE RELOAD onto an ERROR PAGE (server died mid-session, cold
  //     cache): the reload lands on a raw 502 page — no beacon, so the
  //     launcher must show the overlay instead of leaving the 502 visible.
  {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(`http://localhost:${port}/host.html?mode=bare`);
    await page.waitForTimeout(800);
    await page.click('.bubble-btn');
    await page.waitForTimeout(1000);
    await fetch(`http://localhost:${port}/setuidown?down=1`);
    const chatFrame = page.frames().find(f => f.url().includes('/chatbot/0/ui/'));
    await chatFrame.evaluate(() => window.location.reload());
    await page.waitForTimeout(1500);
    const state = await page.evaluate(() => ({
      overlay: !!document.querySelector('.chatbot-unavailable-overlay'),
      iframeHidden: document.querySelector('#krista-chatbot-iFrame')?.style.visibility === 'hidden'
    }));
    await page.close();
    await fetch(`http://localhost:${port}/setuidown`);
    check('reloadToErrorPage: overlay shown instead of raw 502', state.overlay, state);
    check('reloadToErrorPage: iframe hidden by overlay', state.iframeHidden, state);
    check('reloadToErrorPage: no page errors', errors.length === 0, errors);
  }

  // 7) ADANI LATE-INIT worst case: default bubble may briefly render, but the
  //    late customer init must win the final state; at most 2 inits total.
  {
    await fetch(`http://localhost:${port}/reset`);
    const { state, errors } = await load('adaniLate', 3000);
    const stats = await (await fetch(`http://localhost:${port}/stats`)).json();
    check('adaniLate: single bubble', state.bubbleCount === 1, state);
    check('adaniLate: avatar icon wins final state', state.customIcon, state);
    check('adaniLate: no page errors', errors.length === 0, errors);
    check('adaniLate: at most 2 inits (self-correcting)', stats.configCalls <= 2, stats);
  }

  await browser.close();
  server.close();

  let failed = 0;
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : '  -> ' + JSON.stringify(r.detail)}`);
    if (!r.pass) failed++;
  }
  console.log(failed === 0 ? `ALL ${results.length} TESTS PASSED (launcher ${LAUNCHER_VERSION})` : `${failed} TEST(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch(e => { console.error(e); process.exit(2); });
