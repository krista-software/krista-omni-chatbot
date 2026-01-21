import { PhoneNumberJson } from "../types";

export class PhoneNumber {
  constructor(readonly countryCode: number, readonly nationalNumber: number) {}

  toJSON(): PhoneNumberJson {
    return {
      countryCode: this.countryCode,
      nationalNumber: this.nationalNumber,
    };
  }

  toString(): string {
    return this.countryCode
      ? `+${this.countryCode}${this.nationalNumber}`
      : `${this.nationalNumber}`;
  }

  static fromJSON(json: PhoneNumberJson): PhoneNumber | undefined {
    if (!json) {
      return undefined;
    }

    return new PhoneNumber(json["countryCode"], json["nationalNumber"]);
  }
}
