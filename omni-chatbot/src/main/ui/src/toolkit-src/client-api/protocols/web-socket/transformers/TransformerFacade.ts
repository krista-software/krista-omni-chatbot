import { ISignal, SignalPayload } from "../../../../types";
import { ITransformer } from "./types";
import { TextTransformer } from "./TextTransformer";

export class TransformerFacade {
  private static instance: TransformerFacade;
  private readonly transformers = new Map<string, ITransformer>([
    ["text", TextTransformer.getInstance()],
  ]);

  private constructor() {}

  transform(type: "text", data: any): ISignal<SignalPayload> {
    const transformer = this.transformers.get(type)!;
    return transformer.transform(data);
  }

  /**
   * A static method for getting a singleton instance of TransformerFacade
   * @static
   * @returns {TransformerFacade} A singleton instance of TransformerFacade
   */
  public static getInstance(): TransformerFacade {
    if (!this.instance) {
      this.instance = new TransformerFacade();
    }
    return this.instance;
  }
}
