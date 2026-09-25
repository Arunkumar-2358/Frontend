import { CV_REGISTER_FIELDS } from "@contracts/shared/fields";

export const SETTING_META: Record<string, { label: string; hint?: string; unit?: string }> = {
  mandatorySopFields: { label: "Mandatory SOP fields (Enrolled → Qualified)" },
  maxContactAttempts: { label: "Max contact attempts before Unreachable", unit: "attempts" },
  followupHours: { label: "Automatic follow-up after each outcome", unit: "hours" },
  availabilityCheckIntervalDays: { label: "Availability check-in interval", unit: "days" },
  cvTargetPerVacancy: { label: "CV target per vacancy", unit: "CVs" },
  cvMinTeam3bc: { label: "Minimum CVs per vacancy (Teams 3b / 3c)", unit: "CVs" },
  interviewReminderOffsetsHours: { label: "Interview reminder offsets", hint: "Hours before the interview, comma separated (e.g. 24, 2)" },
  offerFollowupIntervalHours: { label: "Offer follow-up interval", unit: "hours" },
  retentionDays: { label: "Retention checkpoints", hint: "Days after joining, comma separated (the last one marks Successful)" },
  redFlagSlaWorkingDays: { label: "Red-flag closure SLA", unit: "working days" },
  enrolmentLinkTemplate: { label: "Enrolment link template", hint: "Must contain {{code}} (the candidate code)" },
};

export const OUTCOME_LABEL: Record<string, string> = {
  UNANSWERED: "Unanswered",
  INTERESTED_LINK_SENT_NOT_REGISTERED: "Bb – interested, link sent, not registered",
  BUSY_RECALL_REQUESTED: "Bc – busy, recall requested",
};

/** Profile fields that can be made mandatory (CV Register fields, excluding read-only ones). */
export const MANDATORY_CHOICES = CV_REGISTER_FIELDS.filter((f) => f.type !== "readonly").map((f) => ({ key: f.key, label: f.label, group: f.group }));
