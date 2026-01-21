//@ts-nocheck
const supportedPosition = [
  "centerLeft",
  "centerRight",
  "topLeft",
  "topRight",
  "bottomLeft",
  "bottomRight",
];

const defaultConfig = {
  height: "calc(100vh - 32px)",
  position: "bottomRight",
  host: "http://localhost:3000",
  error: {
    backgroundColor: "#FDECEA",
    color: "#611A15",
  },
  chatBubble: {
    cssClass: "bubble-btn",
    accessKey: "9",
    text: "Talk to us",
    backgroundColor: "#4fd7ed",
    borderWidth: "1px",
    icon: `<svg width="26" height="21" viewBox="0 0 26 21" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path fill-rule="evenodd" clip-rule="evenodd" d="M0.175781 13.2497C0.175781 11.7472 0.62133 10.2784 1.45609 9.02911C2.29084 7.77981 3.47731 6.8061 4.86546 6.23111C6.2536 5.65612 7.78108 5.50568 9.25473 5.79881C10.7284 6.09193 12.082 6.81547 13.1445 7.87791C14.2069 8.94035 14.9304 10.294 15.2236 11.7676C15.5167 13.2413 15.3662 14.7688 14.7912 16.1569C14.2163 17.5451 13.2425 18.7315 11.9932 19.5663C10.7439 20.401 9.27517 20.8466 7.77265 20.8466C6.48811 20.8466 5.27802 20.5278 4.21722 19.9649L1.12576 20.8482L2.00889 18.1988C0.866308 16.8694 0.175781 15.1402 0.175781 13.2497Z" fill="white"/>
    <mask id="path-2-outside-1_1277_11480" maskUnits="userSpaceOnUse" x="7.71973" y="0.146484" width="19" height="20" fill="black">
    <rect fill="white" x="7.71973" y="0.146484" width="19" height="20"/>
    <path fill-rule="evenodd" clip-rule="evenodd" d="M24.7197 9.74336C24.7197 8.24084 24.2742 6.77206 23.4394 5.52276C22.6047 4.27346 21.4182 3.29975 20.03 2.72476C18.6419 2.14978 17.1144 1.99933 15.6408 2.29246C14.1671 2.58559 12.8135 3.30912 11.7511 4.37156C10.6886 5.434 9.96508 6.78764 9.67195 8.26129C9.37883 9.73494 9.52927 11.2624 10.1043 12.6506C10.6792 14.0387 11.653 15.2252 12.9023 16.0599C14.1516 16.8947 15.6203 17.3402 17.1229 17.3402C18.4074 17.3402 19.6174 17.0214 20.6782 16.4586L23.7697 17.3419L22.8866 14.6925C24.0292 13.3631 24.7197 11.6339 24.7197 9.74336Z"/>
    </mask>
    <path fill-rule="evenodd" clip-rule="evenodd" d="M24.7197 9.74336C24.7197 8.24084 24.2742 6.77206 23.4394 5.52276C22.6047 4.27346 21.4182 3.29975 20.03 2.72476C18.6419 2.14978 17.1144 1.99933 15.6408 2.29246C14.1671 2.58559 12.8135 3.30912 11.7511 4.37156C10.6886 5.434 9.96508 6.78764 9.67195 8.26129C9.37883 9.73494 9.52927 11.2624 10.1043 12.6506C10.6792 14.0387 11.653 15.2252 12.9023 16.0599C14.1516 16.8947 15.6203 17.3402 17.1229 17.3402C18.4074 17.3402 19.6174 17.0214 20.6782 16.4586L23.7697 17.3419L22.8866 14.6925C24.0292 13.3631 24.7197 11.6339 24.7197 9.74336Z" fill="white"/>
    <path d="M23.4394 5.52276L24.4995 4.81441L24.4995 4.81441L23.4394 5.52276ZM20.03 2.72476L19.5421 3.90271V3.90271L20.03 2.72476ZM15.6408 2.29246L15.392 1.04196L15.6408 2.29246ZM11.7511 4.37156L12.6526 5.27312V5.27312L11.7511 4.37156ZM9.67195 8.26129L10.9225 8.51003L9.67195 8.26129ZM10.1043 12.6506L11.2822 12.1626L11.2822 12.1626L10.1043 12.6506ZM12.9023 16.0599L13.6106 14.9998H13.6106L12.9023 16.0599ZM20.6782 16.4586L20.0807 15.3323L20.5345 15.0915L21.0285 15.2327L20.6782 16.4586ZM23.7697 17.3419L24.9793 16.9387L25.7437 19.2319L23.4194 18.5678L23.7697 17.3419ZM22.8866 14.6925L21.677 15.0957L21.4484 14.4098L21.9196 13.8615L22.8866 14.6925ZM24.4995 4.81441C25.4744 6.27338 25.9947 7.98867 25.9947 9.74336H23.4447C23.4447 8.49301 23.074 7.27074 22.3793 6.23112L24.4995 4.81441ZM20.518 1.54682C22.1391 2.21831 23.5247 3.35544 24.4995 4.81441L22.3793 6.23112C21.6846 5.19149 20.6973 4.3812 19.5421 3.90271L20.518 1.54682ZM15.392 1.04196C17.113 0.699635 18.8968 0.875328 20.518 1.54682L19.5421 3.90271C18.387 3.42422 17.1158 3.29903 15.8895 3.54296L15.392 1.04196ZM10.8495 3.47C12.0902 2.22925 13.6711 1.38428 15.392 1.04196L15.8895 3.54296C14.6632 3.78689 13.5367 4.38899 12.6526 5.27312L10.8495 3.47ZM8.42145 8.01255C8.76377 6.29157 9.60874 4.71075 10.8495 3.47L12.6526 5.27312C11.7685 6.15725 11.1664 7.2837 10.9225 8.51003L8.42145 8.01255ZM8.92631 13.1385C8.25482 11.5174 8.07913 9.73352 8.42145 8.01255L10.9225 8.51003C10.6785 9.73635 10.8037 11.0075 11.2822 12.1626L8.92631 13.1385ZM12.1939 17.1201C10.7349 16.1452 9.5978 14.7596 8.92631 13.1385L11.2822 12.1626C11.7607 13.3178 12.571 14.3052 13.6106 14.9998L12.1939 17.1201ZM17.1229 18.6152C15.3682 18.6152 13.6529 18.0949 12.1939 17.1201L13.6106 14.9998C14.6502 15.6945 15.8725 16.0652 17.1229 16.0652V18.6152ZM21.2758 17.5849C20.0354 18.243 18.6207 18.6152 17.1229 18.6152V16.0652C18.194 16.0652 19.1995 15.7999 20.0807 15.3323L21.2758 17.5849ZM21.0285 15.2327L24.12 16.116L23.4194 18.5678L20.328 17.6846L21.0285 15.2327ZM22.5601 17.7451L21.677 15.0957L24.0961 14.2893L24.9793 16.9387L22.5601 17.7451ZM25.9947 9.74336C25.9947 11.9502 25.1874 13.9716 23.8535 15.5236L21.9196 13.8615C22.871 12.7545 23.4447 11.3175 23.4447 9.74336H25.9947Z" fill="currentColor" mask="url(#path-2-outside-1_1277_11480)"/>
    <circle cx="14.2002" cy="9.15996" r="1.16875" fill="currentColor"/>
    <circle cx="18.8758" cy="9.15996" r="1.16875" fill="currentColor"/>
    </svg>`,
  },
};

const rightChevron = `<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 320 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg" style="
"><path d="M285.476 272.971L91.132 467.314c-9.373 9.373-24.569 9.373-33.941 0l-22.667-22.667c-9.357-9.357-9.375-24.522-.04-33.901L188.505 256 34.484 101.255c-9.335-9.379-9.317-24.544.04-33.901l22.667-22.667c9.373-9.373 24.569-9.373 33.941 0L285.475 239.03c9.373 9.372 9.373 24.568.001 33.941z"></path></svg>
`;

const leftChevron = `<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 320 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M34.52 239.03L228.87 44.69c9.37-9.37 24.57-9.37 33.94 0l22.67 22.67c9.36 9.36 9.37 24.52.04 33.9L131.49 256l154.02 154.75c9.34 9.38 9.32 24.54-.04 33.9l-22.67 22.67c-9.37 9.37-24.57 9.37-33.94 0L34.52 272.97c-9.37-9.37-9.37-24.57 0-33.94z"></path></svg>
`;

class Chatbot {
  private config = {};
  private userOptions = {};
  private _iframe = null;
  private _bubbleDiv = null;
  private _notificationBadge = null;
  private _chatbotSnackbarDiv = null;

  private chatbotErrorMessageClass = "chatbot-error-message";
  private chatbotErrorIconClass = "chatbot-error-icon";

  private _containerDiv = null;
  private _metadata = null;
  private _isRestartOnRefresh = false;
  private _styleSheet = null;
  private ui_host = null;

  constructor(options: any = {}) {
    // Store user options for later merging with API config
    this.userOptions = options;
    this._metadata = options.metadata || {};

    // Extract host from options or use current location
    const host = options.host || window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);

    // Ensure host ends with /
    const lastIndex = host.lastIndexOf("/");
    const normalizedHost = (lastIndex !== host.length - 1 && host.length > 0) ? `${host}/` : host;

    this.ui_host = `${normalizedHost}ui/`;

    // Store normalized host for API calls
    this.config = { host: normalizedHost };
  }

  private mergeConfigs(apiConfig, userOptions) {
    // Merge chatBubble configuration: user options override API config
    let chatBubble = Object.assign(
      {},
      defaultConfig.chatBubble,
      apiConfig?.chatBubble || {},
      userOptions?.chatBubble || {}
    );

    // Merge main configuration: API config + user options + defaults
    const config = Object.assign(
      {},
      defaultConfig,
      apiConfig || {},
      userOptions || {},
      { chatBubble }
    );

    // Position is now inside chatBubble, so use chatBubble.position for the container position
    config.position = chatBubble.position || defaultConfig.position;

    // Validate position
    if (!supportedPosition.includes(config.position)) {
      config.position = "bottomRight";
    }

    // Generate chat bubble template
    config.chatBubbleTemplate = `
      <div class="${this.chatbotErrorMessageClass}"></div>
      <div class="${this.chatbotErrorIconClass}">i</div>
      <div class="chatbot-unread-icon"></div>
      <button accesskey="${config.chatBubble.accessKey || '9'}" class="${config.chatBubble.cssClass || 'bubble-btn'}">
      ${config.chatBubble.text ? `<span class="bubble-btn-text">${config.chatBubble.text}</span>` : ""}
      <span class="bubble-btn-icon">${config.chatBubble.icon}</span>
      </button>
    `;

    return config;
  }

  private addChatBubbleErrorMessage(errorMessage) {
    const errorMessageDiv = this._bubbleDiv.querySelector(`.${this.chatbotErrorMessageClass}`);
    const icon = this._bubbleDiv.querySelector(`.${this.chatbotErrorIconClass}`);
    errorMessageDiv.innerHTML = errorMessage;
    errorMessageDiv.classList.add("visible");
    icon.classList.add("visible");
    this._bubbleDiv.classList.remove("hidden");
  }

  private removeChatBubbleErrorMessage() {
    const message = this._bubbleDiv.querySelector(`.${this.chatbotErrorMessageClass}`);
    const icon = this._bubbleDiv.querySelector(`.${this.chatbotErrorIconClass}`);
    message.classList.remove("visible");
    icon.classList.remove("visible");
  }

  private createChatBubble() {
    let bubbleDiv = document.querySelector(".chat-bubble");
    if (!bubbleDiv) {
      bubbleDiv = document.createElement("div");
    }
    bubbleDiv.className = `chat-bubble hide ${this.config.position}`;
    bubbleDiv.innerHTML = this.config.chatBubbleTemplate;
    return bubbleDiv;
  }

  private createChatbotSnackbar() {
    let divChatbotSnackbar = document.querySelector(".chatbotSnackbar");
    if (!divChatbotSnackbar) {
      divChatbotSnackbar = document.createElement("div");
      document.body.appendChild(divChatbotSnackbar);
      divChatbotSnackbar.classList.add("chatbotSnackbar");
      divChatbotSnackbar.style.color = this.config.error.color;
      divChatbotSnackbar.style.backgroundColor =
        this.config.error.backgroundColor;
    }

    return divChatbotSnackbar;
  }

  private createIframe() {
    const chatBotFrame = document.createElement("iframe");
    chatBotFrame.className = "chatbot-frame";
    chatBotFrame.height = "100%";
    chatBotFrame.width = "100%";
    chatBotFrame.allow = "geolocation";
    chatBotFrame.id = "krista-chatbot-iFrame";  // This will be used in the hosted site to find chatbot iFrame
    return chatBotFrame;
  }

  private createIframeContainer() {
    const kristaChatbotWindowSize = getChatbotWidth();
    this._iframe = this.createIframe();
    let chatbotContainer = document.querySelector(".chatbot-container");
    if (!chatbotContainer) {
      chatbotContainer = document.createElement("div");
    }
    chatbotContainer.innerHTML = "";
    chatbotContainer.className = `chatbot-container ${this.config.position}`;
    chatbotContainer.style.display = "none";
    const calculatedWidth = window.screen.availWidth * kristaChatbotWindowSize;
    const finalWidth = Math.max(calculatedWidth, 300);
    chatbotContainer.style.width = `${finalWidth}px`;
    chatbotContainer.appendChild(this._iframe);
    const resizeBtn = this.createResizeButton();
    chatbotContainer.appendChild(resizeBtn);
    return chatbotContainer;
  }

  private createResizeButton() {
    const _this = this;
    let kristaChatbotWindowSize = getChatbotWidth();
    let resizeBtn = document.querySelector(".chatbot-resize-btn");
    if (!resizeBtn) {
      resizeBtn = document.createElement("div");
    }

    function arrowIcon(windowSize: number) {
      return windowSize === 0.5 ? (isChatbotRightSide ? rightChevron : leftChevron) : (isChatbotRightSide ? leftChevron : rightChevron);
    }

    const isChatbotRightSide = this.config.position === "bottomRight" || this.config.position === "topRight";
    resizeBtn.className = `chatbot-resize-btn ${isChatbotRightSide ? "chatbot-resize-btn-left" : "chatbot-resize-btn-right"}`;
    resizeBtn.innerHTML = arrowIcon(kristaChatbotWindowSize);
    resizeBtn.onclick = () => {
      kristaChatbotWindowSize = kristaChatbotWindowSize === 0.5 ? 0.3 : 0.5;
      _this._containerDiv.style.width = window.screen.availWidth * kristaChatbotWindowSize + "px";
      resizeBtn.innerHTML = arrowIcon(kristaChatbotWindowSize);
      window.localStorage.setItem("kristaChatbotWindowSize", kristaChatbotWindowSize);
    };
    return resizeBtn;
  }

  private generateOverrideStyles() {
    let {height} = this.config;
    const styleSheet = `.chatbot-container.chatbot-container{height: ${height};}`;
    const s = document.createElement("style");
    s.type = "text/css";
    s.innerHTML = styleSheet;
    return s;
  }

  private applyBranding(branding) {
    let color = null;
    let width = null;
    if (branding?.outlineColor) {
      color = branding?.outlineColor;
    }
    if (branding?.outlineWidth) {
      width = branding?.outlineWidth;
    }
    let css = "";
    if (color) {
      css = `.chatbot-container{border-color: ${color} !important}`;
    }
    if (width) {
      css = `${css} .chatbot-container{border-width: ${width} !important}`;
    }
    if (css !== "") {
      this._styleSheet.innerHTML = this._styleSheet.innerHTML + css;
    }
    const bubbleDiv = document.querySelector(".bubble-btn");
    const bubbleIconDiv = document.querySelector(".bubble-btn-icon");
    if (bubbleDiv) {
      bubbleDiv.style.borderColor = this.config.chatBubble.backgroundColor;
      bubbleDiv.style.borderWidth = this.config.chatBubble.borderWidth;
    }
    if (bubbleIconDiv) {
      bubbleIconDiv.style.color = this.config.chatBubble.backgroundColor;
      bubbleIconDiv.style.backgroundColor =
        this.config.chatBubble.backgroundColor;
    }
  }

  showChatbotSnackbar = (errorMessage) => {
    this._chatbotSnackbarDiv = this.createChatbotSnackbar();
    this._chatbotSnackbarDiv.innerHTML = errorMessage;
    this._chatbotSnackbarDiv.classList.add("showChatbotSnackbar");
    setTimeout(() => {
      this._chatbotSnackbarDiv.classList.remove("showChatbotSnackbar");
    }, 7000);
  };

  private cleanHtml() {
    try {
      document.body.removeChild(this._bubbleDiv);
      document.body.removeChild(this._containerDiv);
    } catch (e) {
      console.log(e);
    }
    this._chatbotSnackbarDiv = null;
    this._bubbleDiv = null;
    this._containerDiv = null;
    this._metadata = null;
    this._styleSheet = null;
    this._iframe = null;
  }

  private openChatWindow() {
    this._containerDiv.style.display = "block";
    if (this._iframe) {
      // Load iframe src only on the first click if not already loaded
      if (!this._iframe.src) {
        // Create a loading message
        const loadingMsg = document.createElement("div");
        loadingMsg.innerText = "Getting things ready...";
        loadingMsg.style.position = "absolute";
        loadingMsg.style.top = "50%";
        loadingMsg.style.left = "50%";
        loadingMsg.style.transform = "translate(-50%, -50%)";
        loadingMsg.style.fontSize = "18px";
        loadingMsg.style.color = "rgba(51, 51, 51, 0.4)";
        loadingMsg.style.fontFamily = "Arial, sans-serif";
        loadingMsg.style.textAlign = "center";
        this._containerDiv.appendChild(loadingMsg);

        this._iframe.onload = () => {
          loadingMsg.parentNode?.removeChild(loadingMsg);
        };
        this._iframe.src = this.ui_host;
      }
    }
  }

  private toggleNotificationBadge(showNotificationBadge) {
    showNotificationBadge
      ? this._notificationBadge.classList.add("visible")
      : this._notificationBadge.classList.remove("visible");
  }

  private async getChatbotConfig(): Promise<void> {
    const apiUrl = `${this.config.host}config`;

    try {
      const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          "Accept": "application/json;charset=UTF-8",
          "Content-Type": "application/json;charset=UTF-8",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching chatbot config:", error);
    }
  }

  private applyChatbotConfig(configResponse) {
    const apiConfig = configResponse?.config;

    // Merge API config with user options
    this.config = this.mergeConfigs(apiConfig, this.userOptions);

    // Now create all UI elements with the merged config
    this._styleSheet = this.generateOverrideStyles();
    this._bubbleDiv = this.createChatBubble();
    this._notificationBadge = this._bubbleDiv.querySelector(".chatbot-unread-icon");
    this._containerDiv = this.createIframeContainer();

    // Set up bubble click handler
    this._bubbleDiv.onclick = () => {
      this.openChatWindow();
    };

    // Append elements to DOM
    (document.head || document.documentElement).appendChild(this._styleSheet);
    document.body.appendChild(this._bubbleDiv);
    document.body.appendChild(this._containerDiv);

    // Apply branding after elements are created
    this.applyBranding(apiConfig);

    // Show bubble
    this._bubbleDiv.classList.remove("hide");

    const isFullSize = apiConfig?.isFullSize;
    if (isFullSize) {
      const chatbotContainer = document.querySelector(".chatbot-container");
      if (chatbotContainer) {
        chatbotContainer.style.width = "100%";
        chatbotContainer.style.height = "100%";
        chatbotContainer.style.top = "0";
        chatbotContainer.style.right = "0";
        chatbotContainer.style.left = "0";
      }
      const resizeBtn = document.querySelector(".chatbot-resize-btn");
      if (resizeBtn) {
        resizeBtn.remove();
      }
    }

    if ((apiConfig?.startAsBubble === false) || this._isRestartOnRefresh) {
      this._isRestartOnRefresh = false;
      this.openChatWindow();
    }
  }

  init() {
    // First, fetch the configuration from API
    this.getChatbotConfig().then(response => {
      this.applyChatbotConfig(response);

      // Set up query params and event listeners after config is applied
      this.setupEventListeners();

      // Auto-trigger chatbot if flag is present
      const queryParams = this.getQueryParamsFromLocation();
      if (queryParams.autoLaunchChatbot === "true") {
        this.openChatWindow();
      }
    }).catch(error => {
      console.error("Failed to initialize chatbot:", error);
      // Show error to user
      this.showChatbotSnackbar("Failed to load chatbot configuration. Please try again later.");
    });
  }

  private getQueryParamsFromLocation(): {} {
    const params = new URLSearchParams(window.location.search);
    const obj = {};

    params.forEach((value, key) => {
      obj[key] = value;
    });

    return obj;
  }

  private setupEventListeners() {
    const queryParams = this.getQueryParamsFromLocation();

    window.addEventListener("message", (event) => {
        try {
          if (typeof event.data === "object") return;
          const message = JSON.parse(event.data);
          const {messageType, value} = message;
          switch (messageType) {
            case "restartOnRefresh":
              this._isRestartOnRefresh = true;
              break;
            case "initDone":
              const messageToPost = {
                messageType: "dataToChatbot",
                metadata: this._metadata,
                queryParams
              };
              this._iframe.contentWindow.postMessage(JSON.stringify(messageToPost), "*");
              break;
            case "logoutDone":
              this.cleanHtml();
              break;
            case "chatbotConfigError":
              this._bubbleDiv.classList.remove("hide");
              this.addChatBubbleErrorMessage(value);
              break;
            case "getConfigDone":
              this.removeChatBubbleErrorMessage();
              break;
            case "unreadNotification":
              this.toggleNotificationBadge(true);
              break;
            case "clearUnreadNotification":
              this.toggleNotificationBadge(false);
              break;
            case "minimize":
              this._containerDiv.style.display = "none";
              break;
            default:
              break;
          }
        } catch (e) {
          console.log("Invalid message", e);
        }
      }, false
    );
  }
}

function getChatbotWidth() {
  const defaultValue = 0.3;
  let width = parseFloat(
    window.localStorage.getItem("kristaChatbotWindowSize")
  );
  if (isNaN(width)) {
    width = defaultValue;
  }
  return width;
}
