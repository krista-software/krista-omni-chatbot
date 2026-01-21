import { KristaFieldAttributes } from "./KristaFieldAttributes";
import { isDefined } from "../../../../common/utils";

export class RatingFieldAttributes extends KristaFieldAttributes {
  public static readonly RATING_ICON = "ratingIcon"; // string
  public static readonly POSSIBLE_VALUES = "possibleValues"; // string

  protected readonly _rating_icon: string;
  protected readonly _possible_values: string[];

  constructor(attributes: Map<string, any>) {
    super(attributes);
    this._rating_icon = attributes.get(RatingFieldAttributes.RATING_ICON);
    this._possible_values =
      attributes.get(RatingFieldAttributes.POSSIBLE_VALUES) || [];
  }

  get ratingIcon(): string {
    return isDefined(this._rating_icon) &&
      this._possible_values.includes(this._rating_icon)
      ? this._rating_icon
      : "star";
  }
}
