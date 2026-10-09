FROM node:20-alpine

# Install dependencies
RUN apk add --no-cache git

WORKDIR /app

# Run Vite dev server listening on all interfaces
# --mode docker loads .env.docker for Docker-specific API URLs
CMD ["sh", "-c", "npm install --legacy-peer-deps && npm run dev -- --host 0.0.0.0 --mode docker"]

EXPOSE 5173
