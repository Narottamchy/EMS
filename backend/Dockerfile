# Build stage
FROM node:18.20.4-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Clean install dependencies with legacy peer deps to avoid conflicts
RUN rm -rf node_modules package-lock.json && \
    npm install --only=production --legacy-peer-deps --force

# Copy source code
COPY . .

# Production stage
FROM node:18.20.4-alpine

WORKDIR /app

# Copy dependencies from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application files
COPY . .

# Create logs directory and set proper permissions
RUN mkdir -p logs && chmod 755 logs

# Set NODE_ENV to production
ENV NODE_ENV=production

# Expose port
EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "src/server.js"]
