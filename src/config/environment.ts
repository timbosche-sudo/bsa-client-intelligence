/**
 * Runtime environment. Only non-secret values may live here — everything in this file ships to the browser.
 * Never add API keys, tokens or connection strings to VITE_* variables.
 */
export type AppMode = 'prototype' | 'production';

export const environment = {
  mode: (import.meta.env.VITE_APP_MODE === 'production' ? 'production' : 'prototype') as AppMode,
  appVersion: '0.2.0',
  /** AI features are disabled until an approved, server-side model integration exists (Stage 5 interface). */
  aiEnabled: false,
  /** The public demo build ships with fictional sample records only. */
  dataNotice: 'Demonstration data. Projects shown are fictional samples.',
} as const;

export const isPrototype = environment.mode === 'prototype';
