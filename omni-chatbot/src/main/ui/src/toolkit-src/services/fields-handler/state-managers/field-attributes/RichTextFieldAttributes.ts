import { KristaFieldAttributes } from "./KristaFieldAttributes";
import { isDefined } from "../../../../common/utils";

export class RichTextFieldAttributes extends KristaFieldAttributes {
  public static readonly MAX_LENGTH = "maxLength"; // integer
  public static readonly MIN_LENGTH = "minLength"; // integer
  public static readonly MAX_LINE_COUNT = "maxLineCount"; // boolean

  protected readonly _max_length: number;
  protected readonly _min_length: number;
  protected readonly _max_line_count: number;

  constructor(attributes: Map<string, any>) {
    super(attributes);
    this._max_length = attributes.get(RichTextFieldAttributes.MAX_LENGTH);
    this._min_length = attributes.get(RichTextFieldAttributes.MIN_LENGTH);
    this._max_line_count = attributes.get(
      RichTextFieldAttributes.MAX_LINE_COUNT
    );
  }

  get maxLineCount(): number {
    return isDefined(this._max_line_count) ? this._max_line_count : 2;
  }
}
