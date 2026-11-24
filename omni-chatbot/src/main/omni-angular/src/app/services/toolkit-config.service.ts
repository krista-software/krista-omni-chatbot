import { Injectable } from '@angular/core';
import { ConfigOptions } from '../models/websocket.model';

@Injectable({
  providedIn: 'root'
})
export class ToolkitConfigService {
  private config: ConfigOptions | undefined = undefined;

  getConfig(): ConfigOptions | undefined {
    return this.config;
  }

  setConfig(_config: ConfigOptions): void {
    this.config = _config;
  }
}
