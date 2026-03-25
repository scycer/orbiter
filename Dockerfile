# Stage 1: Install dependencies
FROM node:20-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Stage 2: Build frontend
FROM deps AS build
COPY . .
RUN pnpm build

# Stage 3: Production — Hono serves API + static dist/
FROM node:20-slim AS prod
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY server/ ./server/
COPY package.json ./
EXPOSE 3001
CMD ["npx", "tsx", "server/index.ts"]

# Stage 4: Development — Vite dev server
FROM deps AS dev
WORKDIR /app
EXPOSE 5173
CMD ["pnpm", "exec", "vite", "--host", "0.0.0.0", "--port", "5173"]
