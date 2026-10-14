FROM node:22.23.3-alpine3.24@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402

# Install dependencies
RUN apk add --no-cache bash git
RUN node --version | grep -E '^v22\.'

WORKDIR /app

# Run Vite dev server listening on all interfaces
# --mode docker loads .env.docker for Docker-specific API URLs
CMD ["sh", "-c", "npm ci --workspaces=false && npm run dev -- --host 0.0.0.0 --mode docker"]

EXPOSE 5173
