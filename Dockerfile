FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile --prod=false

FROM deps AS builder
COPY . .
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/migrations-audit ./migrations-audit
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/drizzle.config.audit.ts ./drizzle.config.audit.ts
RUN apk add --no-cache postgresql16-client
RUN addgroup -S app && adduser -S app -G app
USER app
EXPOSE 3000
CMD ["node", "dist/src/main.js"]
