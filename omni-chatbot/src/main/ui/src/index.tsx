import React from "react";
import ReactDOM from "react-dom";
import { KristaField, KristaButton, KristaLink } from "./toolkit-src";
import { App } from "./chatbot-src/pages/App";
import { RootProviders } from "./chatbot-src/providers/RootProviders";
import "./chatbot-src/assets/locale/i18";
import "./global.css";

declare global {
  interface Window {
    Authenticator: any;
    basePath: string;
  }
}

ReactDOM.render(
  <React.StrictMode>
    <RootProviders>
      <App />
    </RootProviders>
  </React.StrictMode>,
  document.getElementById("root")
);

customElements.define("krista-field", KristaField);
customElements.define("krista-button", KristaButton);
customElements.define("krista-link", KristaLink);
