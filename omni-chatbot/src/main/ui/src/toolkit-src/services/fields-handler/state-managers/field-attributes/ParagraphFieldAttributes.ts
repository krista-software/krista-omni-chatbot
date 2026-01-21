import { TextFieldAttributes } from "./TextFieldAttributes";

export class ParagraphFieldAttributes extends TextFieldAttributes {
  public static readonly MAX_LINE_COUNT = "maxLineCount"; // boolean

  constructor(attributes: Map<string, any>) {
    super(attributes);
  }

  get maxLineCount(): number {
    return this.get(ParagraphFieldAttributes.MAX_LINE_COUNT) || 2;
  }
}
