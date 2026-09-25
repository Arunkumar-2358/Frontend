const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/** JSON.parse that turns ISO-8601 UTC timestamps back into Date objects. */
export const parseJson = (text: string) => JSON.parse(text, (_k, v) => (typeof v === "string" && ISO_DATE.test(v) ? new Date(v) : v));
