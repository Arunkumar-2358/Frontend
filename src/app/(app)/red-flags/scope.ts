// Who may see which red flag is decided by the API (GET /v1/red-flags, GET /v1/red-flags/{id}).
export const STATUS_TONE = { OPEN: "red", CAPA_SUGGESTED: "amber", IMPLEMENTED: "blue", CLOSED: "green" } as const;
export const STATUS_LABEL = { OPEN: "Open", CAPA_SUGGESTED: "CAPA suggested", IMPLEMENTED: "Implemented", CLOSED: "Closed" } as const;
