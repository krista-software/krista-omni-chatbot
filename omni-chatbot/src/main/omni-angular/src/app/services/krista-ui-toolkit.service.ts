import { Injectable } from '@angular/core';
import { ConfigOptions } from '../models/websocket.model';
import { ToolkitConfigService } from './toolkit-config.service';
import { ClientApiService } from './client-api.service';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root'
})
export class KristaUIToolkitService {
  constructor(
    private toolkitConfig: ToolkitConfigService,
    private clientApi: ClientApiService,
    private notificationService: NotificationService
  ) {}

  /**
   * Initializes UIToolkit
   * @param {ConfigOptions} config - The configuration options for creating the ToolkitConfig instance
   */
  init(config: ConfigOptions): void {
    this.toolkitConfig.setConfig(config);
    this.clientApi.init();
    this.notificationService.init();
  }

  getNotificationService(): NotificationService {
    return this.notificationService;
  }

  getClientApi(): ClientApiService {
    return this.clientApi;
  }

  disconnect(): void {
    this.clientApi.disconnect();
  }
}
