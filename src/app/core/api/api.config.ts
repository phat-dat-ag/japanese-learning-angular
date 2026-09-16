import { InjectionToken } from '@angular/core';

export interface ApiConfig {
  /** Gateway API root, including /api but excluding feature versions. */
  readonly baseUrl: string;
  readonly timeoutMs: number;
}

// Same-origin URLs work with the development proxy and a production reverse proxy.
// Override this token in app.config.ts if the deployed API has a different origin.
export const API_CONFIG = new InjectionToken<ApiConfig>('API_CONFIG', {
  providedIn: 'root',
  factory: () => ({ baseUrl: '/api', timeoutMs: 15_000 }),
});
