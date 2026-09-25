# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
# Build-time values: API_URL is baked into the /api/v1 proxy rewrites; the VAPID key is inlined into the browser bundle.
ARG API_URL=http://api:4000
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY=""
ENV API_URL=$API_URL NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS runtime
ARG API_URL=http://api:4000
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 API_URL=$API_URL
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:3000/login >/dev/null || exit 1
CMD ["node", "server.js"]
