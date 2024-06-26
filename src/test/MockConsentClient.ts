import type { ConsentClient } from "@/types";

/**
 * A mock implementation of the ConsentClient interface
 *
 * This class can be used in place of OakConsentClient in tests
 */
export class MockConsentClient implements ConsentClient {
  appSlug = "testApp";
  userId = "testUserId";
  isReady = Promise.resolve();
  init() {
    return Promise.resolve();
  }
  getState() {
    return {
      policyConsents: [],
      requiresInteraction: true,
    };
  }
  onStateChange = () => {
    return () => {};
  };
  logConsents = () => {
    return Promise.resolve();
  };
  getConsent = () => "pending" as const;
}
