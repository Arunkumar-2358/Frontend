import type { EngagementTier } from "@contracts";
import { ENGAGEMENT_LABEL } from "@contracts/shared/engagement";
import { Badge, type Tone } from "@/components/ui";

export const TIER_TONE: Record<EngagementTier, Tone> = { SUPER_ACTIVE: "green", ACTIVE: "brand", WARM: "amber", COLD: "blue" };

export function TierBadge({ tier }: { tier: EngagementTier }) {
  return <Badge tone={TIER_TONE[tier]}>{tier === "COLD" ? "❄ " : tier === "SUPER_ACTIVE" ? "★ " : ""}{ENGAGEMENT_LABEL[tier]}</Badge>;
}
