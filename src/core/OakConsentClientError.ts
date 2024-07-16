/**
 * Custom error class for OakConsentClient.
 * This will allow us to expose additional information when surfaced through the onError callback.
 */
export class OakConsentClientError extends Error {
  constructor(
    message: string,
    public additionalInfo?: unknown,
  ) {
    super(message);
  }
}
