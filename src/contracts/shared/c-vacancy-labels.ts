/** Vacancy display labels shared by the API (command messages) and the web app. */
import type { ClientBillingModel, ClientOrgType, TeamCode } from "../models";

export const TEAM_LABEL: Partial<Record<TeamCode, string>> = { T3A: "3a · General", T3B: "3b · Existing clients", T3C: "3c · Free trial" };
export const ORG_TYPE_LABEL: Record<ClientOrgType, string> = { GENERAL: "General", EXISTING: "Existing client", FREE_TRIAL: "Free trial" };
export const BILLING_MODELS: ClientBillingModel[] = ["SUBSCRIPTION", "SUCCESS_FEE", "FREE_TRIAL"];
export const BILLING_MODEL_LABEL: Record<ClientBillingModel, string> = { SUBSCRIPTION: "Subscription", SUCCESS_FEE: "Success fee", FREE_TRIAL: "Free trial" };
