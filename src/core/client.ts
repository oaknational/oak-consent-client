import { nanoid } from "nanoid";

import {
  ConsentClient,
  ConsentLog,
  ConsentStateWithPending,
  CookieData,
  Listener,
  OnError,
  Policy,
  PolicyConsent,
  State,
  cookieSchema,
} from "../types";

import { getCookie, setCookie } from "./cookies";
import { NetworkClient } from "./network";

const logger = console;

function policyConsentsAreEqual(a: PolicyConsent, b: PolicyConsent) {
  return a.policyId === b.policyId && a.consentState === b.consentState;
}

function policyConsentsHaveChanged(
  a: PolicyConsent[],
  b: PolicyConsent[],
): boolean {
  if (a.length !== b.length) {
    return true;
  }

  return !a.every((policyConsent, index) =>
    policyConsentsAreEqual(policyConsent, b[index] as PolicyConsent),
  );
}

export class OakConsentClient implements ConsentClient {
  public appSlug: string;
  public userId: string;
  private onError: OnError;
  private policies: Policy[] | null = null;
  private consentLogs: ConsentLog[] = [];
  private state: State;
  private listeners: Listener<State>[] = [];
  /**
   * Indicates when the first visit by the user has been logged
   *
   * Either there is an existing cookie with the user's ID or the user has been logged by this instance
   */
  private hasLoggedFirstVisit = false;
  private isInitialized = false;

  constructor(
    {
      appSlug,
      policiesUrl,
      consentLogUrl,
      userLogUrl,
      onError,
    }: {
      appSlug: string;
      policiesUrl: string;
      consentLogUrl: string;
      userLogUrl: string;
      onError?: OnError;
    },
    private networkClient = new NetworkClient({
      policiesUrl,
      consentLogUrl,
      userLogUrl,
    }),
  ) {
    this.onError = onError || logger.error;
    this.appSlug = appSlug;
    const [userIdFromCookie, consentLogs] = this.getUserStateFromCookies();
    this.hasLoggedFirstVisit = !!userIdFromCookie;
    this.userId = userIdFromCookie ?? this.generateUserId();
    this.consentLogs = consentLogs;
    this.state = {
      policyConsents: [],
      requiresInteraction: false,
    };
    if (typeof window !== "undefined") {
      window.oakConsent = this;
    }
  }

  public async init() {
    // Only initialize once
    if (this.isInitialized) {
      return;
    }
    this.isInitialized = true;
    this.logFirstVisitByUser();
    const policies = await this.fetchPolicies();
    this.policies = policies;
    const policyConsents = this.getPolicyConsents();
    this.setState({
      ...this.state,
      policyConsents,
    });
  }

  public getState() {
    return this.state;
  }

  private setState = (newState: State) => {
    if (
      !policyConsentsHaveChanged(
        this.state.policyConsents,
        newState.policyConsents,
      )
    ) {
      /**
       * no need to update state if policy consents have not changed
       */
      return;
    }

    /**
     * computed properties
     */
    newState.requiresInteraction = this.requiresInteraction(
      newState.policyConsents,
    );
    /**
     * update state
     */
    this.state = newState;
    this.listeners.forEach((listener) => listener(this.state));
  };

  public onStateChange = (listener: Listener<State>): (() => void) => {
    listener(this.state);
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  };

  private requiresInteraction = (policyConsents: PolicyConsent[]) => {
    return policyConsents.some((pc) => pc.consentState === "pending");
  };

  private generateUserId = () => {
    return nanoid();
  };

  private setConsentsInCookies = (consents: ConsentLog[]) => {
    try {
      const cookieData: CookieData = {
        user: this.userId,
        app: this.appSlug,
        policies: consents.map((c) => ({
          id: c.policyId,
          v: c.policyVersion,
          slug: c.policySlug,
          state: c.consentState,
        })),
      };

      const cookie = JSON.stringify(cookieSchema.parse(cookieData));

      setCookie(cookie);
    } catch (error) {
      this.onError(error);
    }
  };

  private getUserStateFromCookies = (): [
    userId: string | null,
    consentLog: ConsentLog[],
  ] => {
    try {
      const val = getCookie();
      const json = val ? JSON.parse(val) : null;
      if (!json) return [null, []];
      const parsed = cookieSchema.parse(json);
      const consents = parsed.policies.map((policy) => ({
        policyId: policy.id,
        policyVersion: policy.v,
        policySlug: policy.slug,
        consentState: policy.state,
        userId: parsed.user,
        appSlug: parsed.app,
      }));

      return [parsed.user, consents];
    } catch (error) {
      this.onError(error);
      return [null, []];
    }
  };

  public logConsents = async (
    consents: { policyId: string; consentState: "granted" | "denied" }[],
  ) => {
    try {
      if (consents.length !== this.policies?.length) {
        throw new Error("Consents to all policies must be logged.");
      }

      const payload: ConsentLog[] = [];

      consents.forEach((consent) => {
        const policy = this.policies?.find((p) => p.id === consent.policyId);
        if (!policy) {
          throw new Error("Policy not found");
        }
        payload.push({
          policyId: consent.policyId,
          policySlug: policy.slug,
          policyVersion: policy.version,
          consentState: policy.strictlyNecessary
            ? "granted"
            : consent.consentState,
          userId: this.userId,
          appSlug: this.appSlug,
        });
      });

      this.consentLogs = payload;
      this.setConsentsInCookies(payload);
      const policyConsents = this.getPolicyConsents();
      this.setState({
        ...this.state,
        policyConsents,
      });

      await this.networkClient.logConsents(payload);
    } catch (error) {
      this.onError(error);
    }
  };

  public getConsent = (slug: string) => {
    const policyConsent = this.state.policyConsents.find(
      (pc) => pc.policySlug === slug,
    );
    return policyConsent?.consentState || "pending";
  };

  private getPolicyConsents = (): PolicyConsent[] => {
    const policies: Policy[] = this.policies || [];
    const consentLogs: ConsentLog[] = this.consentLogs;
    const policyConsents = policies.map((policy) => {
      const consentLog = consentLogs.find(
        (c) => c.policyId === policy.id && c.policyVersion === policy.version,
      );

      let consentedToPreviousVersion = false;

      if (!consentLog) {
        const previousConsent = consentLogs.find(
          (c) => c.policyId === policy.id,
        );
        consentedToPreviousVersion = Boolean(
          previousConsent?.consentState === "granted",
        );
      }

      const consentState: ConsentStateWithPending =
        consentLog?.consentState || "pending";

      return {
        policyId: policy.id,
        policySlug: policy.slug,
        policyDescription: policy.description,
        policyLabel: policy.label,
        policyParties: policy.parties,
        isStrictlyNecessary: policy.strictlyNecessary,
        consentState,
        consentedToPreviousVersion,
      };
    });

    return policyConsents;
  };

  private fetchPolicies = async () => {
    try {
      return await this.networkClient.fetchPolicies(this.appSlug);
    } catch (error) {
      this.onError(error);
      return [];
    }
  };

  /**
   * Logs the user's when they are asked for consent the first time
   */
  private logFirstVisitByUser = async () => {
    // Don't log the user if they have already visited
    if (this.hasLoggedFirstVisit) {
      return;
    }

    // Ensure that the user is stored in the cookie
    // so that we don't attempt to log the user again
    this.setConsentsInCookies(this.consentLogs);
    this.hasLoggedFirstVisit = true;

    try {
      await this.networkClient.logUser(
        this.userId,
        this.appSlug,
        this.extractLocationParams(),
      );
    } catch (error) {
      this.onError(error);
    }
  };

  /**
   * Extracts additional context from the current page
   * to be logged with the user's visit
   */
  private extractLocationParams() {
    const url = new URL(window.location.href);
    return {
      utmSource: url.searchParams.get("utm_source") || undefined,
      utmMedium: url.searchParams.get("utm_medium") || undefined,
      utmCampaign: url.searchParams.get("utm_campaign") || undefined,
      utmContent: url.searchParams.get("utm_content") || undefined,
      utmTerm: url.searchParams.get("utm_term") || undefined,
      url: url.href,
      referrerUrl: window.document.referrer || undefined,
    };
  }
}
