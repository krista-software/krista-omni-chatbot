/* =========================================================
   Chatbot Safe Stub
   Prevents ReferenceError if host page executes early.
   Legacy embed support: many host pages still call
   `new Chatbot(options); instance.init();` themselves (often inside
   $(document).ready with a function-scoped options object). The stub
   captures those options and the init intent so auto-init can replay
   them once the real launcher core is loaded — the host page needs
   no changes.
   ========================================================= */
(function () {
  if (window.Chatbot) {
    return;
  }

  window.Chatbot = function (legacyOptions) {
    return {
      init() {
        // Capture at init time (not construction): only an instance the host
        // page actually init()s may drive the chatbot — matching the old
        // launcher, where init() on an instance is what rendered it. When
        // multiple instances are init'ed, the last one wins (also old behavior).
        window.__kristaLegacyOptions = legacyOptions || null;
        window.__kristaLegacyInit = true;
        // Core already loaded and waiting? Start immediately with these options.
        if (typeof window.__kristaRunAutoInit === 'function') {
          window.__kristaRunAutoInit();
        }
      }
    };
  };
})();

/* =========================================================
   Global typing
   (this file is a plain script — a top-level interface merges
   with the global Window; `declare global` is only valid in
   modules and silently never applied here)
   ========================================================= */
interface Window {
  Chatbot: any;
  __kristaLegacyOptions?: any;
  __kristaLegacyInit?: boolean;
  __kristaRunAutoInit?: () => void;
  __kristaChatbotStarted?: boolean;
  __kristaLauncherBootstrapped?: boolean;
}

/* =========================================================
   Load and inject CSS styles
   ========================================================= */
async function loadStyles(): Promise<void> {
  if (document.getElementById('chatbot-launcher-styles')) {
    return;
  }
  // Load as an external stylesheet (CSP-compatible) instead of fetch()+inline <style>.
  // A cross-origin <link rel="stylesheet"> is not CORS-gated and is governed by the
  // host's style-src allowlist rather than requiring 'unsafe-inline' — mirrors the
  // launcher-core script fix in KR-20773. On error we resolve (not reject) so the
  // launcher still proceeds, unstyled, exactly as the previous try/catch did.
  await new Promise<void>((resolve) => {
    const linkElement: HTMLLinkElement = document.createElement('link');
    linkElement.id = 'chatbot-launcher-styles';
    linkElement.rel = 'stylesheet';
    linkElement.href = '__chatbotBasePath__chatbot/__cdnCacheVersion__/ui/launcher.css';
    linkElement.onload = () => resolve();
    linkElement.onerror = () => {
      console.error('Failed to load chatbot styles');
      resolve();
    };
    (document.head || document.body).appendChild(linkElement);
  });
}

/* =========================================================
   Load chatbot launcher dynamically
   ========================================================= */
async function loadChatbotLauncher(): Promise<void> {
  // A page may include launcher.js more than once (seen in the wild: a static
  // tag plus a bootstrap script injecting it again). Bootstrap only once —
  // the extra include would just refetch launcher-file and the core script
  // for nothing. A failed attempt clears the flag so a later include can retry.
  if (window.__kristaLauncherBootstrapped) {
    return;
  }
  window.__kristaLauncherBootstrapped = true;
  try {
    // Load CSS styles first
    await loadStyles();

    // Get launcher filename
    const response: Response = await fetch('__chatbotBasePath__chatbot/__cdnCacheVersion__/launcher-file');
    const filename: string = await response.text();

    // Load launcher script as external src (CSP-compatible)
    const scriptElement: HTMLScriptElement = document.createElement('script');
    scriptElement.type = 'text/javascript';
    scriptElement.src = `__chatbotBasePath__chatbot/__cdnCacheVersion__/ui/${filename}`;

    await new Promise<void>((resolve, reject) => {
      scriptElement.onload = () => {
        resolve();
      };
      scriptElement.onerror = () => reject(new Error('Failed to load launcher core script'));
      (document.head || document.body).appendChild(scriptElement);
    });

    // Wait until REAL Chatbot replaces stub
    await waitForRealChatbot();

    // Initialize chatbot (deferred until the host page had its chance
    // to provide options — see scheduleChatbotInitialization)
    scheduleChatbotInitialization();

  } catch (error) {
    // Allow a later launcher.js include to retry the bootstrap.
    window.__kristaLauncherBootstrapped = false;
    console.error('Failed to load chatbot launcher:', error);
  }
}

/* =========================================================
   Schedule chatbot initialization
   Legacy embeds call `new Chatbot(options).init()` from their own
   scripts (often inside $(document).ready). The stub captures that
   call; here we make sure auto-init starts AFTER the host page had
   its chance to provide options, whichever happens first:
     - a legacy init call arrives -> start immediately (stub triggers
       __kristaRunAutoInit)
     - DOM ready + short settle   -> start with whatever was captured
   initializeChatbot() is guarded to run exactly once.
   ========================================================= */
function scheduleChatbotInitialization(): void {
  // A legacy init call arriving after the core loaded starts the chatbot
  // right away instead of waiting for the settle timer.
  window.__kristaRunAutoInit = () => initializeChatbot();

  if (window.__kristaLegacyInit) {
    // Host page already called new Chatbot(options).init() — start now.
    initializeChatbot();
    return;
  }

  // Give the host page's inline/document.ready scripts a chance to run
  // first. The 200ms settle also covers jQuery ready handlers, which are
  // dispatched asynchronously after DOMContentLoaded.
  // A legacy init arriving AFTER the settle already ran is still safe: by
  // then window.Chatbot is the real class, so the call re-initializes
  // directly with the caller's options (old-launcher re-init semantics) —
  // options are never lost, worst case is one extra config fetch.
  const startAfterSettle = () => setTimeout(() => initializeChatbot(), 200);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startAfterSettle, { once: true });
  } else {
    startAfterSettle();
  }
}

/* =========================================================
   Wait until real Chatbot implementation is available
   ========================================================= */
function waitForRealChatbot(): Promise<void> {
  return new Promise((resolve) => {
    // The stub is a plain function whose instances get init via an object
    // literal, so the stub has NO prototype.init — only the real class does.
    const isRealChatbot = () =>
      window.Chatbot &&
      window.Chatbot.prototype &&
      typeof window.Chatbot.prototype.init === 'function';

    if (isRealChatbot()) {
      resolve();
      return;
    }

    const interval = setInterval(() => {
      if (isRealChatbot()) {
        clearInterval(interval);
        resolve();
      }
    }, 50);

    // Safety timeout
    setTimeout(() => {
      clearInterval(interval);
      console.warn('Chatbot load timeout – proceeding anyway');
      resolve();
    }, 5000);
  });
}

/* =========================================================
   Utility helpers
   ========================================================= */
function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item);
}

function deepMerge(target: any, source: any): any {
  const output = { ...target };

  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        output[key] = key in target
          ? deepMerge(target[key], source[key])
          : source[key];
      } else {
        output[key] = source[key];
      }
    });
  }

  return output;
}

/* =========================================================
   Extract query parameters from launcher.js script URL
   ========================================================= */
function extractQueryParameters(): Record<string, string> {
  const queryParams: Record<string, string> = {};

  try {
    // Find the current script tag (launcher.js)
    const scripts = document.getElementsByTagName('script');
    let launcherScriptUrl: string | null = null;

    for (let i = 0; i < scripts.length; i++) {
      const src = scripts[i].src;
      if (src && src.includes('/chatbot/ui/launcher.js')) {
        launcherScriptUrl = src;
        break;
      }
    }

    if (!launcherScriptUrl) {
      console.warn('Launcher script URL not found');
      return queryParams;
    }

    // Parse URL and extract query parameters
    const url = new URL(launcherScriptUrl);
    url.searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });

    console.log('Extracted query parameters from launcher.js:', queryParams);

  } catch (error) {
    console.error('Failed to extract query parameters:', error);
  }

  return queryParams;
}

/* =========================================================
   Initialize Chatbot
   ========================================================= */
function initializeChatbot(): void {
  // Run exactly once, no matter how many triggers fire (legacy init call,
  // DOMContentLoaded settle timer, readyState fallback).
  if (window.__kristaChatbotStarted) {
    return;
  }
  window.__kristaChatbotStarted = true;
  try {
    if (!window.Chatbot) {
      console.error('Chatbot class not found');
      return;
    }

    // Default config
    const defaultOptions: any = {
      host: '__chatbotBasePath__chatbot/__cdnCacheVersion__/',
      chatBubble: {
        cssClass: 'bubble-btn'
      }
    };

    // Extract query parameters from launcher.js URL
    const queryParameters = extractQueryParameters();

    // Add metadata only if there are query parameters
    if (Object.keys(queryParameters).length > 0) {
      defaultOptions.metadata = queryParameters;
    }

    // Read host page options safely. Options captured from a legacy
    // `new Chatbot(options)` call take precedence (they are the most
    // explicit), then a top-level global `options` object (current
    // documented pattern). In the documented snippet both are the same
    // object, so precedence never changes its behavior.
    let scriptOptions: {};
    if (window.__kristaLegacyOptions) {
      scriptOptions = window.__kristaLegacyOptions;
    } else {
      try {
        // @ts-ignore
        scriptOptions = options || {};
      } catch {
        scriptOptions = {};
      }
    }

    // Merge configs (scriptOptions will override defaults, including metadata)
    const chatbotConfig = deepMerge(defaultOptions, scriptOptions);
    // Initialize real chatbot
    const kristaChatbot = new window.Chatbot(chatbotConfig);
    kristaChatbot.init();

    if (Object.keys(queryParameters).length > 0) {
      console.log('Chatbot initialized successfully with metadata:', queryParameters);
    } else {
      console.log('Chatbot initialized successfully');
    }

  } catch (error) {
    console.error('Failed to initialize chatbot:', error);
  }
}

/* =========================================================
   Auto-start
   ========================================================= */
loadChatbotLauncher();


/*
Keep below code, it is old code for launcher.js, few old customer are still using below script

// advice to include CSS and JS scripts in header
<link rel="stylesheet" href="https://extension.qa-in.eng.krista.app/extension/api/snVYUUmguQ7cu_pt2vxSs9w_e_e/chatbot/ui/launcher.css"/>
<script src="https://extension.qa-in.eng.krista.app/extension/api/snVYUUmguQ7cu_pt2vxSs9w_e_e/chatbot/ui/launcher.js"></script>

    // place this right before the closing body tag
    <script>
const options = {
  position: 'bottomRight', // bottomRight, centerLeft, centerRight, topLeft, topRight
  metadata: {"hp-test-1":"ABCD"}, // Optional, data will be stored in person attributes
  host:"https://extension.qa-in.eng.krista.app/extension/api/snVYUUmguQ7cu_pt2vxSs9w_e_e/chatbot/",
  chatBubble: {
    cssClass: 'bubble-btn',
    icon: `<svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fill- rule="evenodd" clip - rule="evenodd" d = "M30 0C13.4315 0 0 13.4315 0 30C0 46.5685 13.4315 60 30 60C35.0129 60 39.7387 58.7705 43.8922 56.5965C44.3533 56.3552 44.8874 56.2858 45.3902 56.4205L55.7458 59.1953C57.2329 59.5938 58.5938 58.2329 58.1953 56.7458L55.563 46.9219C55.418 46.3809 55.5096 45.8058 55.7961 45.3245C58.4663 40.8394 60 35.5988 60 30C60 13.4315 46.5685 0 30 0Z" fill="#3F3920" />
            <path fill-rule="evenodd" clip-rule="evenodd" d="M26 34.0898V37C26 37.5523 26.4477 38 27 38H35.5858C35.851 38 36.1054 38.1054 36.2929 38.2929L38.4879 40.4879C38.6769 40.6769 39 40.543 39 40.2757V32C39 31.4477 38.5523 31 38 31V33C38 33.5523 37.5523 34 37 34H26.4142C26.2699 34 26.1288 34.0312 26 34.0898Z" fill="white" />
            <path d="M21 23C21 22.4477 21.4477 22 22 22H35C35.5523 22 36 22.4477 36 23V31C36 31.5523 35.5523 32 35 32H24.4142C24.149 32 23.8946 32.1054 23.7071 32.2929L21.5121 34.4879C21.3231 34.6769 21 34.543 21 34.2757V23Z" fill="white" />
          </svg >`
  }
}

const kristaChatbot = new Chatbot(options);
kristaChatbot.init();

</script>
*/

