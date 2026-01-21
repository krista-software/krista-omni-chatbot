import { isDefined } from "../../../../common/utils";
import { fieldVisualWidth } from "../types";

export class KristaFieldAttributes {
  private static readonly defaultWidth = 250; // match this with form-field-theme.scc
  public static readonly DEFAULT_WIDTH_PX =
    KristaFieldAttributes.defaultWidth + "px";
  public static readonly REQUIRED = "required"; // boolean
  public static readonly SYNONYMS = "synonyms"; // string[]
  public static readonly TOOLTIP = "toolTip"; // string
  public static readonly VISUAL_WIDTH = "visualWidth"; // string S/M/L
  public static readonly IS_SECURED = "isSecured"; // boolean

  private readonly attributesMap: Map<string, any> = new Map<string, any>();
  private _visualWidth: fieldVisualWidth;
  private _visualWidthPx: string;

  constructor(attributes: Map<string, any>) {
    attributes.forEach((value, attrName) => {
      this.set(attrName, value);
    });
    const visualWidth = this.attributesMap.get(
      KristaFieldAttributes.VISUAL_WIDTH
    );
    this._visualWidth = isDefined(visualWidth)
      ? visualWidth.toLowerCase()
      : "s";
    if (this._visualWidth === "m") {
      this._visualWidthPx = `${KristaFieldAttributes.defaultWidth * 1.5}px`;
    } else if (this._visualWidth === "l") {
      this._visualWidthPx = `${KristaFieldAttributes.defaultWidth * 2}px`;
    } else {
      this._visualWidthPx = `${KristaFieldAttributes.defaultWidth}px`;
    }
  }

  set(name: string, value: any) {
    this.attributesMap.set(name, value);
  }

  get(name: string): any {
    return this.attributesMap.get(name);
  }

  get toolTip(): string {
    const toolTip = this.attributesMap.get(KristaFieldAttributes.TOOLTIP);
    return toolTip || "";
  }

  public get visualWidth(): fieldVisualWidth {
    return this._visualWidth;
  }

  get synonyms(): string[] {
    const synonyms: string[] = this.attributesMap.get(
      KristaFieldAttributes.SYNONYMS
    );
    return synonyms || [];
  }

  get isSecured(): boolean {
    const isSecured = this.attributesMap.get(KristaFieldAttributes.IS_SECURED);
    return isSecured || false;
  }

  get visualWidthPx(): string {
    return this._visualWidthPx;
  }
}
