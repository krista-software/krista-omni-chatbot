import { LocationValueJson } from "../types";

export class Location {
  constructor(
    public readonly latitude: number,
    public readonly longitude: number,
    public dateTime?: number,
    public address?: string,
    public city?: string,
    public country?: string,
    public zip?: string,
    public area?: string,
    public state?: string
  ) {}

  public toString() {
    if (this.address) {
      return this.address;
    } else if (this.city || this.country) {
      let display = "";
      display = Location.concatString(display, this.area || "");
      display = Location.concatString(display, this.city || "");
      display = Location.concatString(display, this.state || "");
      display = Location.concatString(display, this.zip || "");
      display = Location.concatString(display, this.country || "");

      return display;
    }
    return this.latitude + ", " + this.longitude;
  }

  public toJSON(): LocationValueJson {
    return {
      type: "com.krista.net.model.fieldschemas.Location",
      latitude: +this.latitude,
      longitude: +this.longitude,
      dateTime: this.dateTime,
      address: this.address,
      city: this.city,
      country: this.country,
      zip: this.zip,
      area: this.area,
      state: this.state,
    };
  }

  static fromJSON(json: LocationValueJson): Location | undefined {
    if (!json) {
      return undefined;
    }
    return new Location(
      +json["latitude"],
      +json["longitude"],
      json["dateTime"],
      json["address"],
      json["city"],
      json["country"],
      json["zip"],
      json["area"],
      json["state"]
    );
  }

  private static concatString(source: string, str: string): string {
    if (!str || str.trim() === "") {
      return source;
    }
    if (!source || source.trim() === "") {
      return str;
    }

    return source + "," + str;
  }

  static fromLocation(location?: { lat: number; lng: number }) {
    if (!location) {
      return undefined;
    }
    return new Location(+location.lat, +location.lng);
  }

  getLocation(): { lat: number; lng: number } {
    return { lat: +this.latitude, lng: +this.longitude };
  }
}
