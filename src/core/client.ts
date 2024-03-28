import { z } from "zod";
import { nanoid } from "nanoid";

import {
  ConsentLog,
  ConsentStateWithPending,
  Listener,
  OnError,
  Policy,
  PolicyConsent,
  State,
  cookieSchema,
  policySchema,
} from "../types";
import { getCookie, setCookie } from "./cookies";

const logger = console;

function policyConsentsAreEqual(a: PolicyConsent, b: PolicyConsent) {
  return a.policyId === b.policyId && a.consentState === b.consentState;
}

function policyConsentsHaveChanged(
  a: PolicyConsent[],
  b: PolicyConsent[]
): boolean {
  if (a.length !== b.length) {
    return true;
  }

  return !a.every((policyConsent, index) =>
    policyConsentsAreEqual(policyConsent, b[index] as PolicyConsent)
  );
}

export class OakConsentClient {
  public appSlug: string;
  public userId: string;
  public isReady: Promise<void>;
  private onError: OnError;
  private policiesUrl: string;
  private consentLogUrl: string;
  private policies: Policy[] | null = null;
  private consentLogs: ConsentLog[] = [];
  private state: State;
  private listeners: Listener<State>[] = [];

  constructor({
    appSlug,
    policiesUrl,
    consentLogUrl,
    onError,
  }: {
    appSlug: string;
    policiesUrl: string;
    consentLogUrl: string;
    onError?: OnError;
  }) {
    this.onError = onError || logger.error;
    this.appSlug = appSlug;
    this.policiesUrl = policiesUrl;
    this.consentLogUrl = consentLogUrl;
    const userId = this.getUserId();
    this.userId = userId;
    this.consentLogs = this.getConsentsFromCookies();
    this.state = {
      policyConsents: [],
      requiresInteraction: false,
    };
    if (typeof window !== "undefined") {
      window.oakConsent = this;
    }
    this.isReady = this.init();
  }

  public async init() {
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

  public setState = (newState: State) => {
    if (
      !policyConsentsHaveChanged(
        this.state.policyConsents,
        newState.policyConsents
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
      newState.policyConsents
    );
    /**
     * update state
     */
    this.state = newState;
    this.listeners.forEach((listener) => listener(this.state));
  };

  public onStateChange = (listener: Listener<State>): (() => void) => {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  };

  private requiresInteraction = (policyConsents: PolicyConsent[]) => {
    return policyConsents.some((pc) => pc.consentState === "pending");
  };

  private getUserId = () => {
    return this.consentLogs[0]?.userId || this.generateUserId();
  };

  private generateUserId = () => {
    return nanoid();
  };

  private setConsentsInCookies = (consents: ConsentLog[]) => {
    try {
      const cookie = JSON.stringify(
        cookieSchema.parse({
          user: this.userId,
          app: this.appSlug,
          policies: consents.map((c) => ({
            id: c.policyId,
            v: c.policyVersion,
            slug: c.policySlug,
            state: c.consentState,
          })),
        })
      );

      setCookie("occ/v1", cookie);
    } catch (error) {
      this.onError(error);
    }
  };

  private getConsentsFromCookies = () => {
    try {
      const val = getCookie("occ/v1");
      const json = val ? JSON.parse(val) : null;
      if (!json) return [];
      const parsed = cookieSchema.parse(json);
      const consents = parsed.policies.map((policy) => ({
        policyId: policy.id,
        policySlug: policy.slug,
        policyVersion: policy.v,
        consentState: policy.consent,
        userId: parsed.user,
        appSlug: parsed.app,
      }));

      return consents;
    } catch (error) {
      this.onError(error);
      return [];
    }
  };

  public logConsents = async (
    consents: { policyId: string; consentState: "granted" | "denied" }[]
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

      await fetch(this.consentLogUrl, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (error) {
      this.onError(error);
    }
  };

  public getConsent = (slug: string) => {
    const policyConsent = this.state.policyConsents.find(
      (pc) => pc.policySlug === slug
    );
    return policyConsent?.consentState || "pending";
  };

  private getPolicyConsents = (): PolicyConsent[] => {
    const policies: Policy[] = this.policies || [];
    const consentLogs: ConsentLog[] = this.consentLogs;
    const policyConsents = policies.map((policy) => {
      const consentLog = consentLogs.find(
        (c) => c.policyId === policy.id && c.policyVersion === policy.version
      );

      let consentedToPreviousVersion = false;

      if (!consentLog) {
        const previousConsent = consentLogs.find(
          (c) => c.policySlug === policy.slug
        );
        consentedToPreviousVersion = Boolean(
          previousConsent?.consentState === "granted"
        );
      }

      const consentState: ConsentStateWithPending =
        consentLog?.consentState || "pending";

      return {
        policyId: policy.id,
        policySlug: policy.slug,
        policyDescription: policy.description,
        policyLabel: policy.label,
        isStrictlyNecessary: policy.strictlyNecessary,
        consentState,
        consentedToPreviousVersion,
      };
    });

    return policyConsents;
  };

  private fetchPolicies = async () => {
    try {
      const response = await fetch(
        `${this.policiesUrl}?appSlug=${this.appSlug}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch policies");
      }

      const data = await response.json();
      const policies = z.array(policySchema).parse(data);

      return policies;
    } catch (error) {
      this.onError(error);
      return [];
    }
  };
}
