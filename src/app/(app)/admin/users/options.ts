import type { MainCategory, Role, TeamCode } from "@contracts";

export const TEAM_CODES: TeamCode[] = ["T1A", "T1B", "T2", "T3A", "T3B", "T3C", "T4"];
export const ROLES: Role[] = ["admin", "data_analyst", "ta_coordinator", "team1_leader", "ta_lead", "telecaller", "team2_leader", "sourcer", "team3_leader", "recruiter"];
export const CATEGORIES: MainCategory[] = ["DOCTOR", "NURSE", "PHARMACY", "ALLIED", "ADMIN", "OTHER"];

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  data_analyst: "Data analyst",
  ta_coordinator: "TA coordinator",
  team1_leader: "Team 1 leader",
  ta_lead: "TA lead",
  telecaller: "Tele-caller",
  team2_leader: "Team 2 leader",
  sourcer: "Talent sourcer",
  team3_leader: "Team 3 leader",
  recruiter: "Recruiter",
};
