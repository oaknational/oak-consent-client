import { OakConsentClient } from "./core/client";

// Extend the Window interface
declare global {
  interface Window {
    oakConsent?: OakConsentClient;
  }
}

// This line is necessary for the compiler to recognize this file as a module.
export {};
