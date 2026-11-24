/**
 * Custom Web Component for krista-link
 * Matches the original app's KristaLink implementation
 * 
 * original implementation:
 * (originally ported from the React chatbot)
 */
export class KristaLinkElement extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: "open" });
    const anchorElement = document.createElement("a");
    anchorElement.setAttribute("class", "wrapper");
    
    // Get title and href attributes
    const title = this.getAttribute("title") || "";
    let href = this.getAttribute("href") || "";
    
    // Set link text
    anchorElement.innerText = title;
    
    // Add https:// if protocol is missing
    if (href) {
      href = href.toLowerCase().lastIndexOf("http") === -1
        ? `https://${href}`
        : href;
      anchorElement.setAttribute("href", href);
    }
    
    // Open in new tab
    anchorElement.setAttribute("target", "_blank");
    anchorElement.setAttribute("rel", "noopener noreferrer");
    
    // Add styling
    anchorElement.style.marginLeft = "2px";
    anchorElement.style.color = "#0177C6"; // Krista primary color
    anchorElement.style.textDecoration = "underline";
    anchorElement.style.cursor = "pointer";
    
    // Add hover effect
    anchorElement.addEventListener('mouseenter', () => {
      anchorElement.style.color = "#015a9c"; // Darker shade on hover
    });
    
    anchorElement.addEventListener('mouseleave', () => {
      anchorElement.style.color = "#0177C6";
    });
    
    this.shadowRoot!.append(anchorElement);
  }
}

// Define the custom element
if (!customElements.get('krista-link')) {
  customElements.define('krista-link', KristaLinkElement);
}

