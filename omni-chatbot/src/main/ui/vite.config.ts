import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import { createHtmlPlugin } from "vite-plugin-html";
import { envConfig } from "./env/config";

const getHostUrl = (url) => {
  return url.lastIndexOf("/") === url.length - 1 ? url : `${url}/`;
};

const getChatBotBasePath = (mode) => {
  let basePath = envConfig.chatbotRoutingId;
  if (mode === "production") {
    basePath = "__chatbotBasePath__";
  }
  return basePath;
};

const getChatbotAuthenticator = (mode) => {
  let basePath = envConfig.chatbotRoutingId;
  if (mode === "production") {
    basePath = ".";
  }
  return basePath;
};


// https://vitejs.dev/config/
export default ({ mode }) => {
  return defineConfig({
    plugins: [
      react(),
      svgr(),
      createHtmlPlugin({
        minify: true,
        viteNext: true,
        inject: {
          data: {
            chatbotAuthenticator: getChatbotAuthenticator(mode),
            chatbotBasePath: getChatBotBasePath(mode),
          },
        },
      }),
    ],
    server: {
      proxy: {
        "/extension/api": {
          target: getHostUrl(envConfig.chatbotHost),
          changeOrigin: true,
          secure: false,
          ws: true
        },
        "/api": {
          target: getHostUrl(envConfig.apiHost),
          secure: false,
          changeOrigin: true,
        },
        "^/node\\d+/sse": {
          target: getHostUrl(envConfig.chatbotHost),
          changeOrigin: true,
          secure: false,
          ws: true,
          rewrite: (path) => path.replace(/^\/node\d+/, '')
        },
        "/sse": {
          target: getHostUrl(envConfig.chatbotHost),
          changeOrigin: true,
          secure: false,
          ws: true
        },
        "/media": {
          target: getHostUrl(envConfig.mediaHost),
          secure: false,
          changeOrigin: true,
        }
      },
    },
  });
};
