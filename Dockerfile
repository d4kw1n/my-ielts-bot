FROM node:20-alpine

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source
COPY tsconfig.json ./
COPY src/ ./src/

# Install dev deps for build then remove
RUN npm install -D typescript @types/node @types/better-sqlite3 @types/express @types/node-cron \
    && npx tsc \
    && npm prune --production \
    && rm -rf src/ tsconfig.json

# Create data directory
RUN mkdir -p /app/data

# Set environment
ENV NODE_ENV=production

# Run
CMD ["node", "dist/index.js"]
