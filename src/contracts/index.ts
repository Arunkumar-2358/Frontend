export type * from "./models";
export type * from "./http";
export type { Actor, RoleGrant } from "./shared/rbac";
export type * from "./routes/auth";
export type * from "./routes/push";
export type * from "./routes/tasks";

import type { AuthRoutes } from "./routes/auth";
import type { PushRoutes } from "./routes/push";
import type { TaskRoutes } from "./routes/tasks";

/** Every endpoint the API serves, keyed "METHOD /path/{param}". */
export type ApiRoutes = AuthRoutes & PushRoutes & TaskRoutes;
