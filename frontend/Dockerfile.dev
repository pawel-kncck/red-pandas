FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application code
COPY . .

# Create a non-root user
RUN addgroup -g 1000 -S appuser && \
    adduser -u 1000 -S appuser -G appuser && \
    chown -R appuser:appuser /app
USER appuser

EXPOSE 5173

# Default command (overridden by docker-compose)
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]