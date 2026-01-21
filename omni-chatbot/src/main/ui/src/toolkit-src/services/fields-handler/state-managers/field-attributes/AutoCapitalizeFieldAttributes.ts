import { TextFieldAttributes } from "./TextFieldAttributes";

export class AutoCapitalizeFieldAttributes extends TextFieldAttributes {
  get doAutoCapitalization(): boolean {
    return true;
  }
}
