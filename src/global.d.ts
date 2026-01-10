import { OakConsentClient } from "./core/client";

// Cookie Store API types
interface CookieStoreGetOptions {
  name: string;
}

interface CookieInit {
  name: string;
  value: string;
  expires?: number;
  domain?: string;
  path?: string;
  sameSite?: "strict" | "lax" | "none";
  partitioned?: boolean;
}

interface CookieListItem {
  name: string;
  value: string;
}

interface CookieStore {
  get(name: string): Promise<CookieListItem | undefined>;
  get(options: CookieStoreGetOptions): Promise<CookieListItem | undefined>;
  set(options: CookieInit): Promise<void>;
  delete(name: string): Promise<void>;
}

// Extend global types
declare global {
  interface Window {
    cookieStore?: CookieStore;
    oakConsent?: OakConsentClient;
  }
}

// This line is necessary for the compiler to recognize this file as a module.
export {};
