export class KristaButton extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: "open" });
    const spanElement = document.createElement("span");
    spanElement.setAttribute("class", "wrapper");
    // @ts-ignore
    spanElement.innerText = this.getAttribute("name");

    const wsId = this.getAttribute("wsid");
    const topicId = this.getAttribute("topicid");
    const convId = this.getAttribute("cid");
    const viewType = this.getAttribute("view");

    if (wsId && topicId && convId && viewType) {
      const dataHref = `/workspace/${wsId}/${topicId}/initiate-conversation?cId=${convId}&view=${viewType}`;
      this.setAttribute("data-href", dataHref);
    }

    spanElement.style.background = "#3f3920";
    spanElement.style.color = "#ffffff";
    spanElement.style.alignItems = "center";
    spanElement.style.padding = "2px 10px";
    spanElement.style.borderRadius = "30px";
    spanElement.style.cursor = "pointer";
    spanElement.style.fontSize = "0.800rem";
    spanElement.style.fontWeight = "400";
    spanElement.style.wordBreak = "break-word";
    spanElement.style.display = "inline-block";
    spanElement.style.margin = "2px";

    // @ts-ignore
    this.shadowRoot.append(spanElement);
  }
}
