import { ISignal, SignalPayload } from "../../../../types";

export interface ITransformer {
  transform(data: string): ISignal<SignalPayload>;
}
