import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  { ignores: ["node_modules/**", ".next/**", "src/contracts/**", "next-env.d.ts"] },
  { rules: { "@typescript-eslint/no-unused-expressions": "off" } },
  {
    // The web app reaches data only through the API client. Keep the boundary from drifting back.
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@prisma/*", ".prisma/*"], message: "The web app has no database access. Use types from @contracts and data from @/lib/api/client." },
            { group: ["@/server/*", "@/kpi/*", "@/lib/db", "@/lib/rbac", "@/lib/clock", "@/lib/dates", "@/lib/phone", "@/lib/ago"], message: "Server code lives in the Backend repo. Shared helpers are in @contracts/shared/*." },
            { group: ["bcryptjs", "exceljs", "web-push"], message: "Server-only dependency; this belongs in the Backend repo." },
          ],
        },
      ],
    },
  },
];
