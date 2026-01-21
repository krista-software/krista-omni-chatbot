import sanitize, { IOptions } from "sanitize-html";
import { createMediaUrlDownload } from "./media";
import { isDefined } from "../../../common/utils";

export const AllowedHtmlTags: IOptions = {
  allowedTags: [
    "a",
    "b",
    "i",
    "u",
    "p",
    "strong",
    "strike",
    "img",
    "br",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "li",
    "ol",
    "em",
    "small",
    "sub",
    "sup",
    "div",
    "span",
    "KristaLinkText",
    "KristaButton",
    "krista-field",
    "krista-button",
    "krista-link",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel", "style", "class"],
    img: ["src", "alt", "style"],
    "*": ["style", "class", "align", "alt", "center", "bgcolor"],
    KristaLinkText: ["data-filter", "data-href"],
    KristaButton: ["data-href"],
    "krista-field": ["value", "attributes", "fieldtype", "name"],
    "krista-button": [
      "name",
      "button-type",
      "data-href",
      "wsid",
      "topicid",
      "cid",
      "view",
    ],
    "krista-link": ["title", "href"],
  },
  disallowedTagsMode: "discard",
  transformTags: {
    a: (tagName: any, attribs: any) => ({
      tagName: "a",
      attribs: {
        ...attribs,
        target: "_blank",
        rel: "noopener noreferrer",
      },
    }),
    img: (tagName: any, attribs: any) => {
      return {
        tagName: "img",
        attribs: {
          ...attribs,
          ...(attribs["data-mediaid"] && {
            src: createMediaUrlDownload((window as any).workspaceId, attribs["data-mediaid"]),
          }),
        },
      };
    },
  },
};

export const getSanitizedMarkup = (value: string): string => {
  return sanitize(value, AllowedHtmlTags);
};

export function stripHtml(htmlString: string): string {
  if (!isDefined(htmlString)) {
    return "";
  }
  const temporalDivElement = document.createElement("div");
  temporalDivElement.innerHTML = htmlString;
  return temporalDivElement.textContent || temporalDivElement.innerText || "";
}
