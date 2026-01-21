import { ConfigOptions } from "./types";

export class ToolkitConfig {
  private static instance: ToolkitConfig;
  private config: ConfigOptions | undefined = undefined;
  private constructor() {}

  getConfig(): ConfigOptions | undefined {
    return this.config;
  }

  setConfig(_config: ConfigOptions) {
    this.config = _config;
  }

  /**
   * A static method for getting a singleton instance of ToolkitConfig
   * @static
   * @param {ConfigOptions} config - The configuration options for creating the ToolkitConfig instance
   * @returns {ToolkitConfig} A singleton instance of ToolkitConfig
   */
  static getInstance(): ToolkitConfig {
    if (!this.instance) {
      this.instance = new ToolkitConfig();
    }
    return this.instance;
  }
}
