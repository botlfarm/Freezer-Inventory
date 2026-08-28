ARG BUILD_FROM=ghcr.io/hassio-addons/base:14.3.1
FROM $BUILD_FROM

# Install Node.js and build tools for native C++ addons
RUN apk add --no-cache --upgrade musl musl-dev && \
    apk add --no-cache nodejs npm python3 make g++

WORKDIR /app

# Copy the local source files into the image
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

ENV NODE_ENV=production

# Start the server
CMD ["node", "dist/server.cjs"]
