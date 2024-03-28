import { useContext } from "react";

import { oakConsentContext } from "./ConsentProvider";

function useOakConsent() {
  const context = useContext(oakConsentContext);
  if (!context) {
    throw new Error("useOakConsent must be used within a OakConsentProvider");
  }
  return context;
}

export { useOakConsent };
