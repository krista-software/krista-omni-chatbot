import { ISignal, SignalPayload, Signal } from "../../../../types";
import { ITransformer } from "./types";

export class TextTransformer implements ITransformer {
  private constructor() {}
  private static instance: TextTransformer;

  transform(data: string): ISignal<SignalPayload> {
    let parsedData: any;
    if (data) {
      try {
        parsedData = JSON.parse(data);
      } catch (e) {
        parsedData = {};
      }
    }
    return {
      signal: parsedData["signal"] as Signal,
      payload: parsedData["payload"] as SignalPayload,
    };
  }

  /**
   * A static method for getting a singleton instance of TextTransformer
   * @static
   * @returns {TextTransformer} A singleton instance of TextTransformer
   */
  public static getInstance(): TextTransformer {
    if (!this.instance) {
      this.instance = new TextTransformer();
    }
    return this.instance;
  }
}
