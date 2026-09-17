# Production Dockerfile for Riyas Creative Corner
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy application source code
COPY . .

# Set environment defaults
ENV NODE_ENV=production
ENV PORT=8085

# Expose server port
EXPOSE 8085

# Health Check instruction
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8085/api/health || exit 1

# Run as non-root user
USER node

# Start Node server
CMD ["node", "server.js"]
