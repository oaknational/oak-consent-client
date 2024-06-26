import { jest, beforeEach, describe, expect, it } from "@jest/globals";
import fetchMock from "jest-fetch-mock";

import { ConsentState, Policy, State } from "../types";

import { OakConsentClient } from "./client";

const setCookieMock = jest.fn();
const getCookieMock = jest.fn();
jest.mock("./cookies", () => ({
  setCookie: (...args: []) => setCookieMock(...args),
  getCookie: (...args: []) => getCookieMock(...args),
}));
jest.mock("nanoid", () => ({
  nanoid: jest.fn(() => "testUserId"),
}));
fetchMock.enableMocks();

const onError = (error: unknown) => {
  throw error;
};

const testProps = {
  appSlug: "testApp",
  policiesUrl: "http://example.com/policies",
  consentLogUrl: "http://example.com/consentLogs",
  onError,
};
const mockPolicies: Policy[] = [
  {
    appSlug: "testApp",
    description: "Privacy Policy",
    parties: [],
    id: "1",
    label: "Privacy Policy",
    slug: "privacy",
    strictlyNecessary: true,
    version: 1,
  },
  {
    appSlug: "testApp",
    description: "Analytics Policy",
    parties: [
      {
        name: "Mux",
        url: "https://www.example.com/mux",
      },
      {
        name: "Google Analytics",
        url: "https://www.example.com/google-analytics",
      },
    ],
    id: "2",
    label: "Analytics Policy",
    slug: "analytics",
    strictlyNecessary: false,
    version: 1,
  },
];

beforeEach(() => {
  (fetch as typeof fetchMock).resetMocks();
  (fetch as typeof fetchMock).mockResponseOnce(() =>
    Promise.resolve({
      body: JSON.stringify(mockPolicies),
    }),
  );
  jest.clearAllMocks();
});

describe("OakConsentClient", () => {
  describe("Initialization", () => {
    it("should set initial properties from the constructor", () => {
      const client = new OakConsentClient(testProps);

      expect(client.userId).toBe("testUserId");
      expect(client.appSlug).toBe("testApp");
      expect(client["policiesUrl"]).toBe("http://example.com/policies");
      expect(client["consentLogUrl"]).toBe("http://example.com/consentLogs");
      expect(client["onError"]).toBe(onError);
    });

    it("should fetch policies and update state on init", async () => {
      const client = new OakConsentClient(testProps);
      await client.isReady;

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(client["policies"]).toEqual(mockPolicies);
      expect(client.getState().policyConsents).toHaveLength(2);
    });
  });

  describe("State Management and Listeners", () => {
    it("should notify listeners when the listener is registered", async () => {
      const client = new OakConsentClient(testProps);
      await client.isReady;
      const listenerMock = jest.fn();
      client.onStateChange(listenerMock);
      expect(listenerMock).toHaveBeenCalledTimes(1);
    });
    it("should notify listeners when the state changes", async () => {
      const client = new OakConsentClient(testProps);
      await client.isReady;
      const listenerMock = jest.fn();

      const granted: ConsentState = "granted";

      client.onStateChange(listenerMock);
      listenerMock.mockClear();

      client["setState"]({
        policyConsents: [
          ...client
            .getState()
            .policyConsents.map((pc) => ({ ...pc, consentState: granted })),
        ],
        requiresInteraction: true,
      });

      expect(listenerMock).toHaveBeenCalledTimes(1);
    });
    it("computed properties should be derived", () => {
      const client = new OakConsentClient(testProps);

      const state: State = {
        policyConsents: [
          {
            policyId: "1",
            policySlug: "privacy",
            policyDescription: "Privacy Policy",
            policyLabel: "Privacy Policy",
            policyParties: [],
            isStrictlyNecessary: true,
            consentState: "granted",
            consentedToPreviousVersion: false,
          },
        ],
        requiresInteraction: false,
      };

      client["setState"](state);

      expect(client.getState().requiresInteraction).toBe(false);

      const [policyConsent] = state.policyConsents;

      if (policyConsent) {
        client["setState"]({
          ...state,
          policyConsents: [
            {
              ...policyConsent,
              consentState: "pending",
            },
          ],
        });
      }

      expect(client.getState().requiresInteraction).toBe(true);
    });
  });

  describe("Managing Consents", () => {
    it("should log consents and update state accordingly", async () => {
      const client = new OakConsentClient(testProps);
      await client.isReady;
      (fetch as typeof fetchMock).mockResponseOnce(() => Promise.resolve({}));
      await client.logConsents([
        { policyId: "1", consentState: "granted" },
        {
          policyId: "2",
          consentState: "granted",
        },
      ]);

      const state = client.getState();
      expect(fetch).toHaveBeenNthCalledWith(
        2,
        "http://example.com/consentLogs",
        {
          method: "POST",
          body: JSON.stringify([
            {
              policyId: "1",
              policySlug: "privacy",
              policyVersion: 1,
              consentState: "granted",
              userId: client.userId,
              appSlug: "testApp",
            },
            {
              policyId: "2",
              policySlug: "analytics",
              policyVersion: 1,
              consentState: "granted",
              userId: client.userId,
              appSlug: "testApp",
            },
          ]),
        },
      );
      expect(state.policyConsents?.[0]?.consentState).toBe("granted");
    });
  });

  describe("should save consents to cookiesteraction", () => {
    it("should save consents to cookies", async () => {
      const client = new OakConsentClient(testProps);
      await client.isReady;
      await client.logConsents([
        {
          policyId: "1",
          consentState: "granted",
        },
        {
          policyId: "2",
          consentState: "granted",
        },
      ]);
      expect(setCookieMock).toHaveBeenCalledTimes(1);
      expect(setCookieMock).toHaveBeenCalledWith(
        JSON.stringify({
          user: client.userId,
          app: "testApp",
          policies: [
            {
              id: "1",
              v: 1,
              slug: "privacy",
              state: "granted",
            },
            {
              id: "2",
              v: 1,
              slug: "analytics",
              state: "granted",
            },
          ],
        }),
      );
    });

    it("should retrieve consents from cookies", async () => {
      getCookieMock.mockReturnValue(
        JSON.stringify({
          user: "testUserId",
          app: "testApp",
          policies: [
            { id: "1", v: 1, slug: "privacy", state: "granted" },
            { id: "2", v: 1, slug: "analytics", state: "granted" },
          ],
        }),
      );

      const client = new OakConsentClient(testProps);
      await client.isReady;

      const state = client.getState();
      const consents = state.policyConsents;
      expect(consents).toHaveLength(2);
      expect(consents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ policyId: "1", consentState: "granted" }),
        ]),
      );
    });

    it("should retrieve `userId` from cookies", async () => {
      getCookieMock.mockReturnValue(
        JSON.stringify({
          user: "persistedTestUserId",
          app: "testApp",
          policies: [],
        }),
      );

      const client = new OakConsentClient(testProps);

      expect(client.userId).toBe("persistedTestUserId");
    });
  });

  describe("Policy versioning", () => {
    it("consentedToPreviousVersion: false", async () => {
      const client = new OakConsentClient(testProps);
      await client.isReady;
      (fetch as typeof fetchMock).mockResponseOnce(() => Promise.resolve({}));
      await client.logConsents([
        {
          policyId: "1",
          consentState: "granted",
        },
        {
          policyId: "2",
          consentState: "denied",
        },
      ]);
      const updatedPolicies: Policy[] = [
        {
          appSlug: "testApp",
          description: "Privacy Policy",
          parties: [],
          id: "1",
          label: "Privacy Policy",
          slug: "privacy",
          strictlyNecessary: true,
          version: 1,
        },
        {
          appSlug: "testApp",
          description: "Analytics Policy version 2",
          parties: [
            {
              name: "Mux",
              url: "https://www.example.com/mux",
            },
            {
              name: "Google Analytics",
              url: "https://www.example.com/google-analytics",
            },
          ],
          id: "2",
          label: "Analytics Policy",
          slug: "analytics",
          strictlyNecessary: false,
          version: 2,
        },
      ];
      (fetch as typeof fetchMock).mockResponseOnce(() =>
        Promise.resolve({
          body: JSON.stringify(updatedPolicies),
        }),
      );

      await client.init();
      const state = client.getState();
      expect(state.policyConsents).toEqual([
        {
          policyId: "1",
          policySlug: "privacy",
          policyDescription: "Privacy Policy",
          policyParties: [],
          policyLabel: "Privacy Policy",
          isStrictlyNecessary: true,
          consentState: "granted",
          consentedToPreviousVersion: false,
        },
        {
          policyId: "2",
          policySlug: "analytics",
          policyDescription: "Analytics Policy version 2",
          policyParties: [
            {
              name: "Mux",
              url: "https://www.example.com/mux",
            },
            {
              name: "Google Analytics",
              url: "https://www.example.com/google-analytics",
            },
          ],
          policyLabel: "Analytics Policy",
          isStrictlyNecessary: false,
          consentState: "pending",
          consentedToPreviousVersion: false,
        },
      ]);
    });
    it("consentedToPreviousVersion: true", async () => {
      const client = new OakConsentClient(testProps);
      await client.isReady;
      (fetch as typeof fetchMock).mockResponseOnce(() => Promise.resolve({}));
      await client.logConsents([
        {
          policyId: "1",
          consentState: "granted",
        },
        {
          policyId: "2",
          consentState: "granted",
        },
      ]);
      const updatedPolicies: Policy[] = [
        {
          appSlug: "testApp",
          description: "Privacy Policy version 2",
          id: "1",
          label: "Privacy Policy",
          slug: "privacy",
          strictlyNecessary: true,
          version: 2,
          parties: [],
        },
        {
          appSlug: "testApp",
          description: "Analytics Policy version 2",
          id: "2",
          label: "Analytics Policy",
          slug: "analytics",
          strictlyNecessary: false,
          version: 2,
          parties: [
            {
              name: "Mux",
              url: "https://www.example.com/mux",
            },
            {
              name: "Google Analytics",
              url: "https://www.example.com/google-analytics",
            },
          ],
        },
      ];
      (fetch as typeof fetchMock).mockResponseOnce(() =>
        Promise.resolve({
          body: JSON.stringify(updatedPolicies),
        }),
      );
      await client.init();
      const state = client.getState();
      expect(state.policyConsents).toEqual([
        {
          policyId: "1",
          policySlug: "privacy",
          policyDescription: "Privacy Policy version 2",
          policyParties: [],
          policyLabel: "Privacy Policy",
          isStrictlyNecessary: true,
          consentState: "pending",
          consentedToPreviousVersion: true,
        },
        {
          policyId: "2",
          policySlug: "analytics",
          policyDescription: "Analytics Policy version 2",
          policyParties: [
            {
              name: "Mux",
              url: "https://www.example.com/mux",
            },
            {
              name: "Google Analytics",
              url: "https://www.example.com/google-analytics",
            },
          ],
          policyLabel: "Analytics Policy",
          isStrictlyNecessary: false,
          consentState: "pending",
          consentedToPreviousVersion: true,
        },
      ]);
    });
  });

  describe("state", () => {
    it("state should not be updated if policies or consents are unchanged", () => {
      const client = new OakConsentClient(testProps);
      const state = client.getState();
      client["setState"]({
        ...state,
        policyConsents: [...state.policyConsents],
      });
      expect(client.getState()).toBe(state);
    });
    it("state values should not be updated if policies or consents are unchanged", () => {
      const client = new OakConsentClient(testProps);
      const state = client.getState();
      client["setState"]({
        ...state,
        policyConsents: [...state.policyConsents],
      });
      expect(client.getState().policyConsents).toBe(state.policyConsents);
    });
  });
});
