/**
 * @jest-environment node
 */
import { jest, describe, expect, it } from "@jest/globals";

import { OakConsentClient } from "./client";
import { NetworkClient } from "./network";

jest.mock("./cookies");
jest.mock("nanoid", () => ({
  nanoid: jest.fn(() => "testUserId"),
}));
jest.mock("./network");

const testProps = {
  appSlug: "testApp",
  policiesUrl: "http://example.com/policies",
  consentLogUrl: "http://example.com/consentLogs",
  userLogUrl: "http://example.com/userLogs",
};

describe("OakConsentClient in a server environment", () => {
  describe("Initialization", () => {
    describe("on the user's first visit", () => {
      it("does not try to log the visit in a non-browser environment", async () => {
        const networkClient = new NetworkClient(testProps);
        new OakConsentClient(testProps, networkClient);

        expect(networkClient.logUser).not.toHaveBeenCalled();
      });
    });
  });
});
