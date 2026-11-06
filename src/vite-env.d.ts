/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_APP_MODE?: 'prototype' | 'production';
}

declare const __BUILD_TIME__: string;
declare const __BUILD_COMMIT__: string;
