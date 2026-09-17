# Single container: marketing site + API + /admin
FROM node:20-bookworm-slim

WORKDIR /app

# Install API dependencies first (better layer cache)
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev

# Copy site + server (see .dockerignore for exclusions)
COPY . .

ENV NODE_ENV=production
ENV PORT=4242

WORKDIR /app/server
EXPOSE 4242

CMD ["node", "index.js"]
