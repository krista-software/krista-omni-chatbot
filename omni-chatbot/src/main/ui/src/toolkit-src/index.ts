import { ClientAPIClient } from "./client-api";
import { NotificationService } from "./services/notification/NotificationService";
import { ThemeService } from "./services/theme/ThemeService";
import { ToolkitConfig } from "./ToolkitConfig";
import { ConfigOptions } from "./types";

export class KristaUIToolkit {
  private static instance: KristaUIToolkit;
  private constructor() {}

  /**
   * Initializes UIToolkit
   * @param {ConfigOptions} config - The configuration options for creating the ToolkitConfig instance
   */
  init(config: ConfigOptions) {
    ToolkitConfig.getInstance().setConfig(config);
    ClientAPIClient.getInstance().init();
    NotificationService.getInstance().init();
  }

  getThemeService(): ThemeService {
    return ThemeService.getInstance();
  }

  /**
   * A static method for getting a singleton instance of KristaUIToolkit
   * @static
   * @returns {KristaUIToolkit} A singleton instance of KristaUIToolkit
   */
  public static getInstance(): KristaUIToolkit {
    if (!this.instance) {
      this.instance = new KristaUIToolkit();
    }
    return this.instance;
  }
}

export * from "./api";
export * from "./client-api";
export * from "./common";
export * from "./classes";
export * from "./locale";
export * from "./services";

export { ToolkitConfig } from "./ToolkitConfig";
export {
  Signal,
  OutboundNotificationType,
  InboundNotificationType,
  CallbackEvent,
} from "./types";

export type {
  ConfigOptions,
  NotificationType,
  SignalPayload,
  NotificationPayload,
  ISignal,
  INotificationSignal,
  SignalHandler,
} from "./types";
