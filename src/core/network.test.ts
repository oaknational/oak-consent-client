import {
  expect,
  describe,
  it,
  beforeEach,
  beforeAll,
  afterAll,
} from "@jest/globals";
import fetchMock from "jest-fetch-mock";

import { NetworkClient } from "./network";

import { ConsentLog, Policy } from "@/types";

describe(NetworkClient, () => {
  beforeAll(() => {
    fetchMock.enableMocks();
  });
  afterAll(() => {
    fetchMock.disableMocks();
  });

  beforeEach(() => {
    fetchMock.resetMocks();
  });

  const subject = new NetworkClient({
    policiesUrl: "https://example.com/policies",
    consentLogUrl: "https://example.com/consent-log",
    userLogUrl: "https://example.com/user-log",
  });

  describe("fetchPolicies", () => {
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
    ];

    it("makes a GET request for policies", async () => {
      fetchMock.mockResponseOnce(() =>
        Promise.resolve(JSON.stringify(mockPolicies)),
      );

      const result = await subject.fetchPolicies("example-app");

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        "https://example.com/policies?appSlug=example-app",
      );
      expect(result).toEqual(mockPolicies);
    });
  });

  describe("logConsents", () => {
    const mockConsentLog: ConsentLog[] = [
      {
        policyId: "1",
        policySlug: "privacy",
        policyVersion: 1,
        consentState: "granted",
        userId: "123",
        appSlug: "testApp",
      },
    ];

    it("makes a POST request to log consents", async () => {
      fetchMock.mockResponseOnce(() => Promise.resolve(""));

      await subject.logConsents(mockConsentLog);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        "https://example.com/consent-log",
        {
          method: "POST",
          body: JSON.stringify(mockConsentLog),
        },
      );
    });
  });

  describe("logUser", () => {
    it("makes a POST request to log a user's first visit", async () => {
      fetchMock.mockResponseOnce(() =>
        Promise.resolve(
          JSON.stringify({
            userId: "testUser",
            appSlug: "testApp",
            createdAt: new Date().toISOString(),
          }),
        ),
      );

      await subject.logUser("testUser", "testApp", { utmSource: "test" });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith("https://example.com/user-log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          utmSource: "test",
          userId: "testUser",
          appSlug: "testApp",
        }),
      });
    });
  });
});
