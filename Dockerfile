ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:3.21

# ==========================================
# Stage 1: Build & Compile
# ==========================================
FROM $BUILD_FROM AS builder

# Install build dependencies for Node.js and C++ native addons (better-sqlite3)
RUN apk add --no-cache \
    nodejs \
    npm \
    python3 \
    make \
    g++ \
    musl-dev

WORKDIR /app

# Copy dependency manifests and install all packages
COPY package*.json ./
RUN npm install

# Copy source files and build the production bundles (Vite frontend + esbuild server)
COPY . .
RUN npm run build

# Remove development dependencies and rebuild native modules for production only
RUN npm prune --omit=dev && npm rebuild better-sqlite3

# ==========================================
# Stage 2: Lean Production Runtime
# ==========================================
FROM $BUILD_FROM AS runner

# Install only runtime Node.js (no compilers, python, or build tools)
RUN apk add --no-cache \
    nodejs \
    npm

WORKDIR /app

# Copy production node_modules and compiled output from builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

ENV NODE_ENV=production

# Start the compiled production server
CMD ["node", "dist/server.cjs"]
