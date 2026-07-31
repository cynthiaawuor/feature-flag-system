# feature-flag-sdk

Client SDK for the feature flag service. Host applications import this
instead of calling the REST API directly.

## Install

From another application in this workspace:

```bash
npm install /path/to/feature-flag-system/sdk
```

Or build it first:

```bash
cd sdk
npm install
npm run build
```

## Usage

Initialize one client per host application, at startup, with the service's
location and the environment that application runs in:

```ts
import { FeatureFlagClient } from "feature-flag-sdk";

const flags = new FeatureFlagClient({
  baseUrl: "https://flags.internal:4000",
  environment: "production",
});

const enabled = await flags.isEnabled("new-checkout", userId);
if (enabled) {
  // ...
}
```

## Safe default behavior

`isEnabled` never throws. If the flag service is unreachable, times out, or
returns anything other than a well-formed decision — including when
`flagKey` doesn't exist — it resolves to a safe default instead of
propagating an error into the host application.

That default is `false` (off) unless the caller opts into a different one:

```ts
const flags = new FeatureFlagClient({
  baseUrl: "https://flags.internal:4000",
  environment: "production",
  defaultValue: true, // fail open instead of fail closed
});
```

`timeoutMs` (default `2000`) controls how long a call waits before treating
the service as unreachable.
