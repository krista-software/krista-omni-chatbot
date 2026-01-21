/* =========================================================
   Chatbot Safe Stub
   Prevents ReferenceError if host page executes early
   ========================================================= */
(function () {
  if (window.Chatbot) {
    return;
  }

  window.Chatbot = function () {
    return {
      init() {
        // no-op stub
      }
    };
  };
})();

/* =========================================================
   Global typing
   ========================================================= */
declare global {
  interface Window {
    Chatbot: any;
  }
}

/* =========================================================
   Load chatbot launcher dynamically
   ========================================================= */
async function loadChatbotLauncher(): Promise<void> {
  try {
    // Get launcher filename
    const response: Response = await fetch('__chatbotBasePath__chatbot/launcher-file');
    const filename: string = await response.text();

    // Fetch launcher script
    const scriptResponse: Response = await fetch(`__chatbotBasePath__chatbot/ui/${filename}`);
    const scriptContent: string = await scriptResponse.text();

    // Inject script
    const scriptElement: HTMLScriptElement = document.createElement('script');
    scriptElement.type = 'text/javascript';
    scriptElement.textContent = scriptContent;

    (document.head || document.body).appendChild(scriptElement);

    console.log('Chatbot launcher script injected');

    // Wait until REAL Chatbot replaces stub
    await waitForRealChatbot();

    // Initialize chatbot
    initializeChatbot();

  } catch (error) {
    console.error('Failed to load chatbot launcher:', error);
  }
}

/* =========================================================
   Wait until real Chatbot implementation is available
   ========================================================= */
function waitForRealChatbot(): Promise<void> {
  return new Promise((resolve) => {
    const isRealChatbot = () =>
      window.Chatbot &&
      window.Chatbot.prototype &&
      typeof window.Chatbot.prototype.init === 'function' &&
      window.Chatbot.prototype.init !== (() => {});

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
  try {
    if (!window.Chatbot) {
      console.error('Chatbot class not found');
      return;
    }

    // Default config
    const defaultOptions: any = {
      host: '__chatbotBasePath__chatbot/',
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

    // Read host page options safely
    let scriptOptions: {};
    try {
      // @ts-ignore
      scriptOptions = options || {};
    } catch {
      scriptOptions = {};
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
