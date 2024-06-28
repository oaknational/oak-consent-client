import { z } from "zod";

import { ConsentLog, Policy, policySchema } from "@/types";

type NetworkClientConfig = {
  policiesUrl: string;
  consentLogUrl: string;
  userLogUrl: string;
};

/**
 * Fetches policies and logs consents to oak-consent-api
 */
export class NetworkClient {
  constructor(private config: NetworkClientConfig) {}

  /**
   * Fetches policies from oak-consent-api
   */
  async fetchPolicies(appSlug: string): Promise<Policy[]> {
    const url = new URL(this.config.policiesUrl);
    url.searchParams.set("appSlug", appSlug);
    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error("Failed to fetch policies");
    }

    const data = await response.json();
    const policies = z.array(policySchema).parse(data);

    return policies;
  }

  /**
   * Logs a user's policy consents to oak-consent-api
   */
  async logConsents(logs: ConsentLog[]) {
    await fetch(this.config.consentLogUrl, {
      method: "POST",
      body: JSON.stringify(logs),
    });
  }

  /**
   * Logs the user's visit to oak-consent-api
   */
  async logUser(userId: string, appSlug: string) {
    await fetch(this.config.userLogUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId, appSlug }),
    });
  }
}
