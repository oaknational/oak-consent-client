import { z } from "zod";

import { OakConsentClientError } from "./OakConsentClientError";

import { ConsentLog, Policy, policySchema } from "@/types";

type NetworkClientConfig = {
  policiesUrl: string;
  consentLogUrl: string;
  userLogUrl: string;
};

type LogUserAdditionalParams = {
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
  url: string;
  referrerUrl: string;
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
    const urlObject = new URL(this.config.policiesUrl);
    urlObject.searchParams.set("appSlug", appSlug);
    const url = urlObject.toString();
    const response = await fetch(url);

    if (!response.ok) {
      throw new OakConsentClientError("Failed to fetch policies", {
        url,
        response,
      });
    }

    const data = await response.json();
    const policies = z.array(policySchema).parse(data);

    return policies;
  }

  /**
   * Logs a user's policy consents to oak-consent-api
   */
  async logConsents(logs: ConsentLog[]) {
    const url = this.config.consentLogUrl;
    const body = logs;
    const response = await fetch(url, {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new OakConsentClientError("Failed to log consents", {
        url,
        body,
        response,
      });
    }
  }

  /**
   * Logs the user's visit to oak-consent-api
   */
  async logUser(
    userId: string,
    appSlug: string,
    additionalParams?: Partial<LogUserAdditionalParams>,
  ) {
    const url = this.config.userLogUrl;
    const body = { ...additionalParams, userId, appSlug };
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new OakConsentClientError("Failed to log user", {
        url,
        body,
        response,
      });
    }
  }
}
