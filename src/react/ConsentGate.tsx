import { ReactNode } from "react";

import { useOakConsent } from "./useOakConsent";

export const ConsentGate = ({
  children,
  policySlug,
}: {
  children: ReactNode;
  policySlug: string;
}) => {
  const { getConsent } = useOakConsent();

  const consent = getConsent(policySlug);

  if (consent !== "granted") {
    return null;
  }

  return <>{children}</>;
};
