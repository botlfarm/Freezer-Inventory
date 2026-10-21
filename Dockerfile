ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:3.21

# ==========================================
# Stage 1: Build JavaScript & Frontend Bundles on Native Host ($BUILDPLATFORM)
# ==========================================
FROM --platform=$BUILDPLATFORM node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests and install all packages natively on the builder host
COPY package*.json ./
RUN npm install

# Copy source files and build production bundles (Vite + esbuild run natively with zero QEMU emulation crashes)
COPY . .
RUN npm run build

# ==========================================
# Stage 2: Lean Production Runtime on Target Architecture ($BUILD_FROM)
# ==========================================
FROM $BUILD_FROM AS runner

# Install Node.js runtime and build tools for compiling native better-sqlite3 on target architecture
RUN apk add --no-cache \
    nodejs \
    npm \
    python3 \
    make \
    g++ \
    musl-dev

WORKDIR /app

# Install only production dependencies (compiles native better-sqlite3 addon for target architecture)
COPY package*.json ./
RUN npm install --omit=dev

# Strip compilation build tools to keep the production image lean
RUN apk del python3 make g++ musl-dev

# Copy compiled frontend and bundled server from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

ENV NODE_ENV=production

# Start the compiled production server
CMD ["node", "dist/server.cjs"]
