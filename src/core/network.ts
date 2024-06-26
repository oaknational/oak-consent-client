import { z } from "zod";

import { ConsentLog, Policy, policySchema } from "@/types";

type NetworkClientConfig = {
  policiesUrl: string;
  consentLogUrl: string;
};

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

  async logConsents(logs: ConsentLog[]) {
    await fetch(this.config.consentLogUrl, {
      method: "POST",
      body: JSON.stringify(logs),
    });
  }
}
