# Oak Consent Client

The Oak Consent Client is a React TypeScript client to interface with the [Oak Consent API](https://github.com/oaknational/oak-consent-manager).

## Installation

To integrate the Oak Consent Client into your project, you will need React 18 later. Install the package using NPM or your preferred package manager:

```bash
npm i @oaknational/oak-consent-client
```

## Usage

### Setting up the client

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

### Using the Hook

For components that need to interact with the consent state, the useOakConsent hook can be utilised. This hook provides access to the current consent state, allowing for conditional rendering based on the user's consent choices.

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

### Consent Gate

The `ConsentGate` component is a convenient way to conditionally render children components based on the consent status of a specific policy.

```tsx
import { ConsentGate } from "@oaknational/oak-consent-client";
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

## Development and Contributions

While the Oak Consent Client is currently not open for direct contributions, we encourage you to report any issues or suggest enhancements through the GitHub issue tracker. Your feedback is invaluable in making this tool more effective for developers.
