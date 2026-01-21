import { KristaFieldAttributes } from "./KristaFieldAttributes";

export class LocationFieldAttributes extends KristaFieldAttributes {
  public static readonly ALLOW_MAP_SELECTION = "allowMapSelection"; // boolean

  protected readonly _allowMapSelection: boolean;

  constructor(attributes: Map<string, any>) {
    super(attributes);
    this._allowMapSelection = attributes.get(
      LocationFieldAttributes.ALLOW_MAP_SELECTION
    );
  }

  get allowMapSelection(): boolean {
    return this._allowMapSelection || false;
  }
}
