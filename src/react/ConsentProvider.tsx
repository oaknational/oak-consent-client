import React, { ReactNode, useEffect, useMemo, useState } from "react";

import { OakConsentClient } from "../core/client";
import { GetConsent, LogConsents, State } from "../types";

type ContextValue = {
  state: State;
  logConsents: LogConsents;
  getConsent: GetConsent;
};

export const oakConsentContext = React.createContext<ContextValue | null>(null);

const OakConsentProvider = ({
  client,
  children,
}: {
  client: OakConsentClient;
  children: ReactNode;
}) => {
  const [state, setState] = useState<State>(client.getState());

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
    [client, state]
  );

  return (
    <oakConsentContext.Provider value={contextValue}>
      {children}
    </oakConsentContext.Provider>
  );
};

export { OakConsentProvider };
