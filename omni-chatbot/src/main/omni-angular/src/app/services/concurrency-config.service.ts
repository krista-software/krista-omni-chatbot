import { Injectable } from '@angular/core';
import { ConfigService } from './config.service';

/**
 * ConcurrencyConfigService
 *
 * Reads the concurrency-control feature flags that ride inside the existing
 * GET /config response (ChatbotConfig.config map). All values are defensive:
 * a missing or invalid key disables the feature or applies a safe default so
 * the flag-off path is byte-for-byte identical to today.
 *
 * Backend keys (set by the admin in Integration Settings):
 *   concurrencyControlEnabled  boolean  – master switch; absent ⇒ OFF
 *   maxConcurrentUsers         number   – informational; not used by FE logic
 *   idleDisconnectSeconds      number   – total idle timeout in seconds
 *
 * Derived values (FE-only, no extra fetch):
 *   idleWarningLeadSeconds = min(120, floor(idleDisconnectSeconds / 2))
 *
 * QUEUE_POLL_INTERVAL_MS is a constant that mirrors the backend constant of
 * the same name so both sides stay in sync without a wire field.
 */
@Injectable({
  providedIn: 'root'
})
export class ConcurrencyConfigService {
  /** Must match backend ConcurrencyConstants.QUEUE_POLL_INTERVAL_MS */
  static readonly QUEUE_POLL_INTERVAL_MS = 5000;

  constructor(private configService: ConfigService) {}

  /**
   * Returns true only when the master flag is explicitly set to boolean true.
   * Any other value (absent, string, null) ⇒ false → feature stays OFF.
   */
  isEnabled(): boolean {
    const cfg = this.configService.getCurrentConfig()?.config;
    if (!cfg) return false;
    return cfg['concurrencyControlEnabled'] === true;
  }

  /**
   * Total idle disconnect timeout in milliseconds.
   * Returns 0 when the value is missing or invalid.
   */
  idleDisconnectMs(): number {
    const cfg = this.configService.getCurrentConfig()?.config;
    if (!cfg) return 0;
    const raw = cfg['idleDisconnectSeconds'];
    const seconds = typeof raw === 'number' && raw > 0 ? raw : 0;
    return seconds * 1000;
  }

  /**
   * Warning lead time in milliseconds.
   * Derived: min(120, floor(idleDisconnectSeconds / 2)) seconds.
   * Returns 0 when idleDisconnectSeconds is missing/invalid.
   */
  idleWarningLeadMs(): number {
    const cfg = this.configService.getCurrentConfig()?.config;
    if (!cfg) return 0;
    const raw = cfg['idleDisconnectSeconds'];
    const seconds = typeof raw === 'number' && raw > 0 ? raw : 0;
    if (seconds === 0) return 0;
    const leadSeconds = Math.min(120, Math.floor(seconds / 2));
    return leadSeconds * 1000;
  }

  /** Informational max-user cap from config. Returns 0 when absent. */
  maxConcurrentUsers(): number {
    const cfg = this.configService.getCurrentConfig()?.config;
    if (!cfg) return 0;
    const raw = cfg['maxConcurrentUsers'];
    return typeof raw === 'number' && raw > 0 ? raw : 0;
  }
}
