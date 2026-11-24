import { Injectable } from '@angular/core';
import { ISignal, SignalPayload, Signal, ITransformer } from '../models/websocket.model';

@Injectable({
  providedIn: 'root'
})
export class TextTransformerService implements ITransformer {

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
}
