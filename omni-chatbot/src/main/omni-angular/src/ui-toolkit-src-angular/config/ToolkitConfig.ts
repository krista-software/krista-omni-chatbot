/**
 * ToolkitConfig - Configuration management for the toolkit
 * Mirrors original toolkit-src/ToolkitConfig.ts
 * 
 * This is a singleton that holds the toolkit configuration including user information.
 * In Angular, this will be injected via a service, but the structure matches the original version.
 */

export interface ConfigOptions {
  user: {
    id: string;
    name?: string;
  };
  config?: {
    botName?: string;
    isFullSize?: boolean;
    hideSendMessage?: boolean;
  };
  kristaAccountId?: string;
}

export class ToolkitConfig {
  private static instance: ToolkitConfig;
  private config: ConfigOptions | undefined;

  private constructor() {}

  static getInstance(): ToolkitConfig {
    if (!ToolkitConfig.instance) {
      ToolkitConfig.instance = new ToolkitConfig();
    }
    return ToolkitConfig.instance;
  }

  setConfig(config: ConfigOptions): void {
    this.config = config;
  }

  getConfig(): ConfigOptions | undefined {
    return this.config;
  }
}

