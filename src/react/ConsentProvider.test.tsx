import { jest, expect, describe, it, beforeEach } from "@jest/globals";
import { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import fetchMock from "jest-fetch-mock";

import { OakConsentClient } from "../core/client";
import { Policy } from "../types";

import { OakConsentProvider } from "./ConsentProvider"; // Update with the actual path
import { useOakConsent } from "./useOakConsent";

const setCookieMock = jest.fn();
const getCookieMock = jest.fn();
jest.mock("../core/cookies", () => ({
  setCookie: (...args: []) => setCookieMock(...args),
  getCookie: (...args: []) => getCookieMock(...args),
}));
jest.mock("nanoid", () => ({
  nanoid: jest.fn(() => "testUserId"),
}));
fetchMock.enableMocks();
const onError = jest.fn();
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
        name: "Google Analytics",
        url: "https://www.example.com/analytics/",
      },
      {
        name: "Hotjar",
        url: "https://example.com/hotjar/",
      },
    ],
    id: "2",
    label: "Analytics Policy",
    slug: "analytics",
    strictlyNecessary: false,
    version: 1,
  },
];

let client: OakConsentClient;
beforeEach(async () => {
  (fetch as typeof fetchMock).resetMocks();
  (fetch as typeof fetchMock).mockResponseOnce(() =>
    Promise.resolve({
      body: JSON.stringify(mockPolicies),
    }),
  );
  client = new OakConsentClient(testProps);
  await client.isReady;
  jest.clearAllMocks();
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <OakConsentProvider client={client}>{children}</OakConsentProvider>
);

describe("OakConsentProvider and useOakConsent", () => {
  describe("state", () => {
    it("should provide the correct state", () => {
      const { result } = renderHook(() => useOakConsent(), { wrapper });
      expect(result.current.state).toEqual({
        policyConsents: [
          {
            consentState: "pending",
            consentedToPreviousVersion: false,
            isStrictlyNecessary: true,
            policyDescription: "Privacy Policy",
            policyParties: [],
            policyId: "1",
            policyLabel: "Privacy Policy",
            policySlug: "privacy",
          },
          {
            consentState: "pending",
            consentedToPreviousVersion: false,
            isStrictlyNecessary: false,
            policyDescription: "Analytics Policy",
            policyParties: [
              {
                name: "Google Analytics",
                url: "https://www.example.com/analytics/",
              },
              {
                name: "Hotjar",
                url: "https://example.com/hotjar/",
              },
            ],
            policyId: "2",
            policyLabel: "Analytics Policy",
            policySlug: "analytics",
          },
        ],
        requiresInteraction: true,
      });
    });
    it("should come from cookie value", async () => {
      (fetch as typeof fetchMock).mockResponseOnce(() =>
        Promise.resolve({
          body: JSON.stringify(mockPolicies),
        }),
      );
      getCookieMock.mockReturnValueOnce(
        JSON.stringify({
          user: "testUserId",
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
              state: "denied",
            },
          ],
        }),
      );
      const newClient = new OakConsentClient(testProps);
      await newClient.isReady;
      const newWrapper = ({ children }: { children: ReactNode }) => (
        <OakConsentProvider client={newClient}>{children}</OakConsentProvider>
      );
      const { result } = renderHook(() => useOakConsent(), {
        wrapper: newWrapper,
      });
      expect(result.current.state).toEqual({
        policyConsents: [
          {
            consentState: "granted",
            consentedToPreviousVersion: false,
            isStrictlyNecessary: true,
            policyDescription: "Privacy Policy",
            policyParties: [],
            policyId: "1",
            policyLabel: "Privacy Policy",
            policySlug: "privacy",
          },
          {
            consentState: "denied",
            consentedToPreviousVersion: false,
            isStrictlyNecessary: false,
            policyDescription: "Analytics Policy",
            policyParties: [
              {
                name: "Google Analytics",
                url: "https://www.example.com/analytics/",
              },
              {
                name: "Hotjar",
                url: "https://example.com/hotjar/",
              },
            ],
            policyId: "2",
            policyLabel: "Analytics Policy",
            policySlug: "analytics",
          },
        ],
        requiresInteraction: false,
      });
    });
  });
  describe("logConsents", () => {
    it("should call fetch and setCookie", () => {
      fetchMock.resetMocks();
      const { result } = renderHook(() => useOakConsent(), { wrapper });
      act(() => {
        result.current.logConsents([
          {
            policyId: "1",
            consentState: "granted",
          },
          {
            policyId: "2",
            consentState: "denied",
          },
        ]);
      });
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(setCookieMock).toHaveBeenCalledTimes(1);
    });
    it("should call onError if don't include all policies", () => {
      const { result } = renderHook(() => useOakConsent(), { wrapper });
      act(() => {
        result.current.logConsents([
          {
            policyId: "2",
            consentState: "granted",
          },
        ]);
      });
      expect(onError).toHaveBeenCalledTimes(1);
      expect(fetch).not.toHaveBeenCalled();
    });
  });
  describe("getConsent", () => {
    it("should return the correct consent state", async () => {
      const { result } = renderHook(() => useOakConsent(), { wrapper });

      expect(result.current.getConsent("analytics")).toBe("pending");
    });
  });
});
