import { z } from "zod";

export const policySchema = z.object({
  id: z.string(),
  label: z.string(),
  slug: z.string(),
  version: z.number(),
  appSlug: z.string(),
  description: z.string(),
  strictlyNecessary: z.boolean(),
});
export type Policy = z.infer<typeof policySchema>;

export const cookieSchema = z.object({
  user: z.string(),
  app: z.string(),
  policies: z.array(
    z.object({
      id: z.string(),
      v: z.number(),
      slug: z.string(),
      consent: z.enum(["granted", "denied"]),
    })
  ),
});
export const consentLogSchema = z.object({
  userId: z.string(),
  policyId: z.string(),
  policyVersion: z.number(),
  policySlug: z.string(),
  appSlug: z.string(),
  consentState: z.enum(["granted", "denied"]),
});
export type ConsentLog = z.infer<typeof consentLogSchema>;
export type ConsentState = ConsentLog["consentState"];
export type ConsentStateWithPending = "granted" | "denied" | "pending";
export type PolicyConsent = {
  policyId: string;
  policySlug: string;
  policyDescription: string;
  policyLabel: string;
  isStrictlyNecessary: boolean;
  consentState: ConsentStateWithPending;
  consentedToPreviousVersion: boolean;
};
export type State = {
  policyConsents: PolicyConsent[];
  requiresInteraction: boolean;
};
export type Listener<T> = (state: T) => void;
export type LogConsents = (
  consents: {
    policyId: string;
    consentState: "granted" | "denied";
  }[]
) => Promise<void>;
export type RequiresInteraction = () => boolean;
export type OnError = (error: unknown) => void;
export type GetConsent = (slug: string) => ConsentStateWithPending;
