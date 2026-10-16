FROM node:22.23.3-alpine3.24@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402

WORKDIR /app
COPY package.json ./
COPY src ./src
COPY data ./data
RUN mkdir -p /app/runtime && node --version | grep -E '^v22\.'

ENV PORT=3000
ENV FAKE_FOLIO_RUNTIME_FILE=/app/runtime/state.json

EXPOSE 3000
CMD ["node", "src/server.js"]
