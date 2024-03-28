## Overview

## Usage

Instantiate the client and wrap your app with the provider:

```tsx
"use client";

import {
  OakConsentClient,
  OakConsentProvider,
} from "@oaknational/oak-consent-client";

const client = new OakConsentClient({
  appSlug: "unique-slug-for-app",
  policiesUrl: "https://example.com/policies",
  consentLogUrl: "http://example.com/consent-log",
  onError: console.error,
});

export const ConsentProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return <OakConsentProvider client={client}>{children}</OakConsentProvider>;
};
```

Either use the hook:

```tsx
import { useOakConsent } from "@oaknational/oak-consent-client";

function MyComponent() {
  const { requiresInteraction, state, logConsents } = useOakConsent();

  useEffect(() => {
    if (requiresInteraction) {
      showCookieBanner(); // you're expected to handle any UI and its associated state
    }
  }, [requiresInteraction]);
}
```

Or use a consent gate:

```tsx
import { ConsentGate } from "@oaknational/consent/react";
function MyComponent() {
  return (
    <>
      <SomeContent />
      <ConsentGate policySlug="analytics">
        <AnalyticsScript />
      </ConsentGate>
    </>
  );
}
```
