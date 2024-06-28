import { jest, expect, describe, it, beforeEach } from "@jest/globals";
import { ReactNode } from "react";
import { act, render, renderHook } from "@testing-library/react";

import { OakConsentProvider } from "./ConsentProvider"; // Update with the actual path
import { useOakConsent } from "./useOakConsent";

import type { ConsentClient, Listener, State } from "@/types";
import { MockConsentClient } from "@/test/MockConsentClient";

const mockClientState = {
  policyConsents: [
    {
      consentState: "pending" as const,
      consentedToPreviousVersion: false,
      isStrictlyNecessary: true,
      policyDescription: "Privacy Policy",
      policyParties: [],
      policyId: "1",
      policyLabel: "Privacy Policy",
      policySlug: "privacy",
    },
  ],
  requiresInteraction: true,
};

describe("OakConsentProvider and useOakConsent", () => {
  let client: ConsentClient;
  beforeEach(async () => {
    client = new MockConsentClient();
    jest.spyOn(client, "getState").mockReturnValue(mockClientState);
    jest.clearAllMocks();
  });

  const Wrapper = ({ children }: { children?: ReactNode }) => (
    <OakConsentProvider client={client}>{children}</OakConsentProvider>
  );

  it("initialises the client on mount", async () => {
    const initSpy = jest.spyOn(client, "init");
    const result = render(<Wrapper />);
    result.rerender(<Wrapper />);

    expect(initSpy).toHaveBeenCalledTimes(1);
  });

  describe("state", () => {
    it("should provide the correct state", () => {
      const { result } = renderHook(() => useOakConsent(), {
        wrapper: Wrapper,
      });
      expect(result.current.state).toEqual(mockClientState);
    });
    it("should update the state when the client updates", () => {
      let listener: Listener<State>;
      jest.spyOn(client, "onStateChange").mockImplementation((callback) => {
        listener = callback;
        return () => {};
      });

      const { result } = renderHook(() => useOakConsent(), {
        wrapper: Wrapper,
      });

      const newState: State = {
        ...mockClientState,
        policyConsents: [
          {
            ...mockClientState.policyConsents[0]!,
            consentState: "granted",
          },
        ],
      };

      act(() => {
        listener(newState);
      });

      expect(result.current.state).toEqual(newState);
    });
  });

  describe("getConsent", () => {
    it("should return the correct consent state", async () => {
      jest.spyOn(client, "getConsent").mockReturnValueOnce("pending");
      const { result } = renderHook(() => useOakConsent(), {
        wrapper: Wrapper,
      });

      expect(result.current.getConsent("analytics")).toBe("pending");
      expect(client.getConsent).toHaveBeenCalledWith("analytics");
    });
  });
});
