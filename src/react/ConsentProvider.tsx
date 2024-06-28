import { ReactNode, createContext, useEffect, useMemo, useState } from "react";

import type { ConsentClient, GetConsent, LogConsents, State } from "../types";

type ContextValue = {
  state: State;
  logConsents: LogConsents;
  getConsent: GetConsent;
};

export const oakConsentContext = createContext<ContextValue | null>(null);

const OakConsentProvider = ({
  client,
  children,
}: {
  client: ConsentClient;
  children: ReactNode;
}) => {
  const [state, setState] = useState<State>(client.getState());

  /**
   * Initialise the client on mount
   *
   * this ensures that the client doesn't hit the network unless
   * rendered on the client-side
   */
  useEffect(() => {
    client.init();
  }, [client]);

  useEffect(() => {
    const unsubscribe = client.onStateChange((newState) => {
      setState(newState);
    });
    return unsubscribe;
  }, [client]);

  const contextValue = useMemo<ContextValue>(
    () => ({
      state,
      logConsents: client.logConsents,
      getConsent: client.getConsent,
    }),
    [client, state.policyConsents, state.requiresInteraction],
  );

  return (
    <oakConsentContext.Provider value={contextValue}>
      {children}
    </oakConsentContext.Provider>
  );
};

export { OakConsentProvider };
