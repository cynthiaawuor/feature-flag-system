export interface FeatureFlagClientOptions {
  /** Base URL of the feature flag service, e.g. "https://flags.internal:4000". */
  baseUrl: string;
  /** The environment this host application runs in, e.g. "production". */
  environment: string;
  /**
   * Returned by `isEnabled` whenever the service can't be reached, times out,
   * or answers with something unexpected. Defaults to `false` (off) so a
   * flag-service outage can never silently turn a feature on.
   */
  defaultValue?: boolean;
  /** How long to wait for a response before treating the service as unreachable. Defaults to 2000ms. */
  timeoutMs?: number;
}

interface EvaluateResponse {
  decision: "on" | "off";
}

const isEvaluateResponse = (value: unknown): value is EvaluateResponse => {
  return (
    typeof value === "object" &&
    value !== null &&
    "decision" in value &&
    (value.decision === "on" || value.decision === "off")
  );
};

/**
 * Client SDK for the feature flag service. Initialize once per host
 * application and reuse it for every evaluation.
 */
export class FeatureFlagClient {
  private readonly baseUrl: string;
  private readonly environment: string;
  private readonly defaultValue: boolean;
  private readonly timeoutMs: number;

  constructor(options: FeatureFlagClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.environment = options.environment;
    this.defaultValue = options.defaultValue ?? false;
    this.timeoutMs = options.timeoutMs ?? 2000;
  }

  /**
   * Evaluates a flag for a user in this client's environment.
   *
   * Never throws: if the service is unreachable, times out, or returns
   * anything other than a well-formed decision (including the case where
   * `flagKey` doesn't exist), this resolves to the client's safe default
   * instead of propagating an error into the host application.
   */
  async isEnabled(flagKey: string, userId: string): Promise<boolean> {
    const url = new URL(`${this.baseUrl}/evaluate`);
    url.searchParams.set("flag", flagKey);
    url.searchParams.set("user", userId);
    url.searchParams.set("environment", this.environment);

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        return this.defaultValue;
      }

      const body: unknown = await response.json();
      if (!isEvaluateResponse(body)) {
        return this.defaultValue;
      }

      return body.decision === "on";
    } catch {
      return this.defaultValue;
    }
  }
}
