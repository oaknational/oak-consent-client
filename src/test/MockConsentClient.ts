import type { ConsentClient, State } from "@/types";

/**
 * A mock implementation of the ConsentClient interface
 *
 * This class can be used in place of OakConsentClient in tests
 */
export class MockConsentClient implements ConsentClient {
  appSlug = "testApp";
  userId = "testUserId";
  constructor(
    private state: State = {
      policyConsents: [],
      requiresInteraction: true,
    },
  ) {}
  init() {
    return Promise.resolve();
  }
  getState(): State {
    return this.state;
  }
  onStateChange: ConsentClient["onStateChange"] = () => {
    return () => {};
  };
  logConsents: ConsentClient["logConsents"] = () => {
    return Promise.resolve();
  };
  getConsent: ConsentClient["getConsent"] = () => "pending";
}
