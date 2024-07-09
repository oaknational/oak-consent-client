import { jest, beforeEach, describe, expect, it } from "@jest/globals";

import { ConsentState, Policy, State } from "../types";

import { OakConsentClient } from "./client";
import { NetworkClient } from "./network";
import { getCookie, setCookie } from "./cookies";

jest.mock("./cookies");
jest.mock("nanoid", () => ({
  nanoid: jest.fn(() => "testUserId"),
}));
jest.mock("./network");

const onError = (error: unknown) => {
  throw error;
};

const testProps = {
  appSlug: "testApp",
  policiesUrl: "http://example.com/policies",
  consentLogUrl: "http://example.com/consentLogs",
  userLogUrl: "http://example.com/userLogs",
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

describe("OakConsentClient", () => {
  let networkClient: NetworkClient;

  beforeEach(() => {
    networkClient = new NetworkClient(testProps);
    jest.spyOn(networkClient, "fetchPolicies").mockResolvedValue(mockPolicies);
    jest.clearAllMocks();
  });

  describe("Initialization", () => {
    it("should set initial properties from the constructor", () => {
      const client = new OakConsentClient(testProps, networkClient);

      expect(client.userId).toBe("testUserId");
      expect(client.appSlug).toBe("testApp");
      expect(client["onError"]).toBe(onError);
    });

    it("only allows the client to initialize once", async () => {
      const client = new OakConsentClient(testProps, networkClient);
      await client.init();
      await client.init();

      expect(networkClient.fetchPolicies).toHaveBeenCalledTimes(1);
    });

    it("should fetch policies and update state on init", async () => {
      const client = new OakConsentClient(testProps, networkClient);
      await client.init();

      expect(client["policies"]).toEqual(mockPolicies);
      expect(client.getState().policyConsents).toHaveLength(2);
    });

    it("should persist the generated userId in a cookie", async () => {
      const client = new OakConsentClient(testProps, networkClient);
      await client.init();

      expect(setCookie).toHaveBeenCalledTimes(1);
      expect(setCookie).toHaveBeenCalledWith(
        JSON.stringify({
          user: "testUserId",
          app: "testApp",
          policies: [],
        }),
      );
    });

    describe("on the user's first visit", () => {
      it("should log the user's visit", async () => {
        const client = new OakConsentClient(testProps, networkClient);
        await client.init();

        expect(networkClient.logUser).toHaveBeenCalledWith(
          "testUserId",
          "testApp",
          expect.any(Object),
        );
      });

      it("should log additional location data when present", async () => {
        const searchParams = new URLSearchParams({
          utm_source: "foo",
          utm_medium: "bar",
          utm_campaign: "baz",
          utm_content: "qux",
          utm_term: "quux",
        });
        window.history.replaceState({}, "", `?${searchParams.toString()}`);
        Object.defineProperty(window.document, "referrer", {
          value: "http://referrer",
        });

        const client = new OakConsentClient(testProps, networkClient);
        await client.init();

        expect(networkClient.logUser).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          expect.objectContaining({
            utmSource: "foo",
            utmMedium: "bar",
            utmCampaign: "baz",
            utmContent: "qux",
            utmTerm: "quux",
            url: window.location.href,
            referrerUrl: "http://referrer",
          }),
        );
      });

      it("should omit empty params from location data when present", async () => {
        const searchParams = new URLSearchParams({
          utm_source: "",
          utm_medium: "",
          utm_campaign: "",
          utm_content: "",
          utm_term: "",
        });
        Object.defineProperty(window.document, "referrer", {
          value: "",
        });
        window.history.replaceState({}, "", `?${searchParams.toString()}`);

        const client = new OakConsentClient(testProps, networkClient);
        await client.init();

        expect(networkClient.logUser).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          expect.objectContaining({
            utmSource: undefined,
            utmMedium: undefined,
            utmCampaign: undefined,
            utmContent: undefined,
            utmTerm: undefined,
            referrerUrl: undefined,
          }),
        );
      });
    });

    describe("on subsequent visits", () => {
      it("should not log the user's visit", async () => {
        (getCookie as jest.Mock).mockReturnValueOnce(
          JSON.stringify({
            user: "persistedTestUserId",
            app: "testApp",
            policies: [],
          }),
        );

        const client = new OakConsentClient(testProps, networkClient);
        await client.init();

        expect(networkClient.logUser).not.toHaveBeenCalled();
      });
    });
  });

  describe("State Management and Listeners", () => {
    it("should notify listeners when the listener is registered", async () => {
      const client = new OakConsentClient(testProps, networkClient);
      await client.init();
      const listenerMock = jest.fn();
      client.onStateChange(listenerMock);
      expect(listenerMock).toHaveBeenCalledTimes(1);
    });
    it("should notify listeners when the state changes", async () => {
      const client = new OakConsentClient(testProps, networkClient);
      await client.init();
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
      const client = new OakConsentClient(testProps, networkClient);

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
      const client = new OakConsentClient(testProps, networkClient);
      await client.init();
      await client.logConsents([
        { policyId: "1", consentState: "granted" },
        {
          policyId: "2",
          consentState: "granted",
        },
      ]);
      const state = client.getState();
      const updatedConsents = [
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
      ];
      expect(networkClient.logConsents).toHaveBeenCalledWith(updatedConsents);
      expect(state.policyConsents?.[0]?.consentState).toBe("granted");
      expect(setCookie).toHaveBeenLastCalledWith(
        JSON.stringify({
          user: "testUserId",
          app: "testApp",
          policies: updatedConsents.map((c) => ({
            id: c.policyId,
            v: c.policyVersion,
            slug: c.policySlug,
            state: c.consentState,
          })),
        }),
      );
    });
  });

  it("should call onError when logging consent if polices are missing", async () => {
    const onError = jest.fn();
    const client = new OakConsentClient(
      {
        ...testProps,
        onError,
      },
      networkClient,
    );
    await client.init();
    client.logConsents([
      {
        policyId: "2",
        consentState: "granted",
      },
    ]);

    expect(onError).toHaveBeenCalledWith(
      new Error("Consents to all policies must be logged."),
    );
    expect(networkClient.logConsents).not.toHaveBeenCalled();
  });

  describe("should save consents to cookiesteraction", () => {
    it("should save consents to cookies", async () => {
      const client = new OakConsentClient(testProps, networkClient);
      await client.init();
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
      expect(setCookie).toHaveBeenLastCalledWith(
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
      (getCookie as jest.Mock).mockReturnValue(
        JSON.stringify({
          user: "testUserId",
          app: "testApp",
          policies: [
            { id: "1", v: 1, slug: "privacy", state: "granted" },
            { id: "2", v: 1, slug: "analytics", state: "granted" },
          ],
        }),
      );

      const client = new OakConsentClient(testProps, networkClient);
      await client.init();

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
      (getCookie as jest.Mock).mockReturnValue(
        JSON.stringify({
          user: "persistedTestUserId",
          app: "testApp",
          policies: [],
        }),
      );

      const client = new OakConsentClient(testProps, networkClient);

      expect(client.userId).toBe("persistedTestUserId");
    });
  });

  describe("Policy versioning", () => {
    it("consentedToPreviousVersion: false", async () => {
      (getCookie as jest.Mock).mockReturnValue(
        JSON.stringify({
          user: "testUserId",
          app: "testApp",
          policies: [
            { id: "1", v: 1, slug: "privacy", state: "granted" },
            { id: "2", v: 1, slug: "analytics", state: "denied" },
          ],
        }),
      );

      const client = new OakConsentClient(testProps, networkClient);
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
      jest
        .spyOn(networkClient, "fetchPolicies")
        .mockResolvedValue(updatedPolicies);

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
      (getCookie as jest.Mock).mockReturnValue(
        JSON.stringify({
          user: "testUserId",
          app: "testApp",
          policies: [
            { id: "1", v: 1, slug: "privacy", state: "granted" },
            { id: "2", v: 1, slug: "analytics", state: "granted" },
          ],
        }),
      );

      const client = new OakConsentClient(testProps, networkClient);
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
      jest
        .spyOn(networkClient, "fetchPolicies")
        .mockResolvedValue(updatedPolicies);
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
      const client = new OakConsentClient(testProps, networkClient);
      const state = client.getState();
      client["setState"]({
        ...state,
        policyConsents: [...state.policyConsents],
      });
      expect(client.getState()).toBe(state);
    });
    it("state values should not be updated if policies or consents are unchanged", () => {
      const client = new OakConsentClient(testProps, networkClient);
      const state = client.getState();
      client["setState"]({
        ...state,
        policyConsents: [...state.policyConsents],
      });
      expect(client.getState().policyConsents).toBe(state.policyConsents);
    });
  });
});
