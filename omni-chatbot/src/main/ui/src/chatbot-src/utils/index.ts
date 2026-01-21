export const escapeHtml = (unsafe: string) => {
  return unsafe
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
};

export const isInIframe = window.location !== window.parent.location;

export const getMaskedValue = (value: string, maskChar: string = "•") => {
  let _maskedValue = "";
  if (value) {
    _maskedValue = (value || "")
      .split("")
      .map((char) => (char === "\n" ? char : maskChar))
      .join("");
  }
  return _maskedValue;
};

export function set_cookie(name: string, value: string) {
  document.cookie = name + "=" + value + "; Path=/;";
}
export function delete_cookie(name: string) {
  document.cookie = name + "=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;";
}
