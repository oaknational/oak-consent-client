import { useContext } from "react";

import { oakConsentContext } from "./ConsentProvider";

import { OakConsentClientError } from "@/core/OakConsentClientError";

function useOakConsent() {
  const context = useContext(oakConsentContext);
  if (!context) {
    throw new OakConsentClientError(
      "useOakConsent must be used within a OakConsentProvider",
    );
  }
  return context;
}

export { useOakConsent };
