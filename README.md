# Oak Consent Client

![License: MIT](https://img.shields.io/badge/license-MIT-brightgreen)

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

## External Contributions

### Security and Bug Bounty

Please see our [security.txt](public/.well-known/security.txt) file.

### Contributing to the Code

While the Oak Consent Client is currently not open for direct contributions, we encourage you to report any issues or suggest enhancements through the GitHub issue tracker. Your feedback is invaluable in making this tool more effective for developers.

## Open Source Acknowledgements

As with all web projects we are dependent on open source libraries maintained by others. While it is not practical to acknowledge them all, we would nevertheless like to express our gratitude for the contributions and efforts of the OSS community. Our dependency list can be found in our [package.json](package.json) file.

## License

Unless stated otherwise, the codebase is released under the [MIT License][mit]. This covers both the codebase and any sample code in the documentation. Where any Oak National Academy trademarks or logos are included, these are not released under the [MIT License][mit], and should be used in line with [Oak National Academy brand guidelines][brand].

Any documentation included is © [Oak National Academy][oak] and available under the terms of the [Open Government Licence v3.0][ogl], except where otherwise stated.

[mit]: LICENCE
[oak]: https://www.thenational.academy/
[ogl]: https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/
[brand]: https://support.thenational.academy/using-the-oak-brand
