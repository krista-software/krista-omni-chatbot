export class KristaLink extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: "open" });
    const anchorElement = document.createElement("a");
    anchorElement.setAttribute("class", "wrapper");
    // @ts-ignore
    anchorElement.innerText = this.getAttribute("title");
    let href = this.getAttribute("href");
    if (href) {
      href =
        href.toLowerCase().lastIndexOf("http") === -1
          ? `https://${href}`
          : href;
      anchorElement.setAttribute("href", href);
    }
    anchorElement.setAttribute("target", "_blank");
    anchorElement.setAttribute("rel", "noopener noreferrer");
    anchorElement.style.marginLeft = "2px";

    // @ts-ignore
    this.shadowRoot.append(anchorElement);
  }
}
