/**
 * Custom Web Component for krista-button
 * Matches the original app's KristaButton implementation
 */
export class KristaButtonElement extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: "open" });
    const spanElement = document.createElement("span");
    spanElement.setAttribute("class", "wrapper");
    spanElement.innerText = this.getAttribute("name") || "";

    const wsId = this.getAttribute("wsid");
    const topicId = this.getAttribute("topicid");
    const convId = this.getAttribute("cid");
    const viewType = this.getAttribute("view");

    if (wsId && topicId && convId && viewType) {
      const dataHref = `/workspace/${wsId}/${topicId}/initiate-conversation?cId=${convId}&view=${viewType}`;
      this.setAttribute("data-href", dataHref);
    }

    // Apply styles matching original app exactly (theme.palette.text.primary background)
    spanElement.style.background = "var(--krista-text-primary)";
    spanElement.style.color = "var(--krista-background-paper)";
    spanElement.style.alignItems = "center";
    spanElement.style.padding = "4px 12px"; // theme.spacing(0.5, 1.5) = 4px 12px
    spanElement.style.borderRadius = "30px";
    spanElement.style.cursor = "pointer";
    spanElement.style.fontSize = "0.875rem"; // 14px to match original app
    spanElement.style.fontWeight = "400";
    spanElement.style.wordBreak = "break-word";
    spanElement.style.display = "inline-block";
    spanElement.style.margin = "4px 0"; // theme.spacing(0.5, 0) = 4px 0
    spanElement.style.transition = "background-color 0.2s ease";

    // Add hover effects with theme colors
    spanElement.addEventListener('mouseenter', () => {
      spanElement.style.background = "rgba(33, 33, 33, 0.8)"; // Darker version of text.primary
    });

    spanElement.addEventListener('mouseleave', () => {
      spanElement.style.background = "var(--krista-text-primary)";
    });

    spanElement.addEventListener('mousedown', () => {
      spanElement.style.background = "rgba(33, 33, 33, 0.9)"; // Even darker for active state
    });

    spanElement.addEventListener('mouseup', () => {
      spanElement.style.background = "rgba(33, 33, 33, 0.8)";
    });

    // Add click handler
    spanElement.addEventListener('click', (event) => {
      this.handleClick(event);
    });

    this.shadowRoot!.append(spanElement);
  }

  private handleClick(event: Event) {
    event.preventDefault();
    event.stopPropagation();

    const buttonType = this.getAttribute("button-type");
    const name = this.getAttribute("name");


    // Dispatch custom event that can be caught by Angular components
    const customEvent = new CustomEvent('krista-button-click', {
      detail: { name, buttonType },
      bubbles: true,
      composed: true
    });

    this.dispatchEvent(customEvent);

    // If it's an OPTION type button, trigger message sending
    if (buttonType && buttonType.toLowerCase() === "option" && name) {
      // Dispatch a message send event
      const messageEvent = new CustomEvent('krista-button-send-message', {
        detail: { message: name },
        bubbles: true,
        composed: true
      });

      this.dispatchEvent(messageEvent);
    }
  }
}

// Define the custom element
if (!customElements.get('krista-button')) {
  customElements.define('krista-button', KristaButtonElement);
}
