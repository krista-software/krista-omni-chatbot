// Single source of truth for local dev: edit src/dev-config.json only.
// backendHost is the API/chatbot/media host; routingId is consumed by the
// browser app (app.config.ts) to build the URL path.
const devConfig = require('./src/dev-config.json');

const chatbotHost = devConfig.backendHost;
const apiHost = devConfig.backendHost;
const mediaHost = devConfig.backendHost;

// SSE streams are served from the extension host. For cloud hosts this is the
// "extension." subdomain (e.g. https://extension.qa-in.eng.krista.app); for a
// localhost backend there is no such subdomain, so use the host as-is.
const isLocalhost = /\/\/(localhost|127\.0\.0\.1)([:\/]|$)/.test(devConfig.backendHost);
const extensionHost = isLocalhost
  ? devConfig.backendHost
  : devConfig.backendHost.replace('https://', 'https://extension.');

const PROXY_CONFIG = [
  {
    context: ['/extension/**'],
    target: chatbotHost,
    secure: false,
    changeOrigin: true,
    logLevel: 'debug',
    ws: true, // Enable WebSocket proxying
  },
  {
    context: ['/api/**'],
    target: apiHost,
    secure: false,
    changeOrigin: true,
    logLevel: 'debug',
  },
  {
    context: ['/media/**'],
    target: mediaHost,
    secure: false,
    changeOrigin: true,
    logLevel: 'debug',
  },
  {
    // StreamProvider creates URLs like /{nodeName}/sse/workspaces/{workspaceId}/streams/{streamId}
    // These SSE endpoints are served from the extension host (same origin as React app)
    context: ['/**/sse/workspaces/**'],
    target: extensionHost,
    secure: false,
    changeOrigin: true,
    logLevel: 'debug',
    // Forward cookies to the backend
    onProxyReq: (proxyReq, req, res) => {
      // Log the request for debugging
      console.log('[SSE Proxy] Request:', req.method, req.url);
      console.log('[SSE Proxy] Cookies:', req.headers.cookie);

      // Ensure cookies are forwarded
      if (req.headers.cookie) {
        proxyReq.setHeader('Cookie', req.headers.cookie);
      }
    },
    onProxyRes: (proxyRes, req, res) => {
      console.log('[SSE Proxy] Response status:', proxyRes.statusCode);
    },
    onError: (err, req, res) => {
      console.error('[SSE Proxy] Error:', err.message);
    }
  }
];

module.exports = PROXY_CONFIG;
