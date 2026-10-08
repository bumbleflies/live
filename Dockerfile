# Build stage
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
ARG VITE_BUILD_VERSION=dev
ARG VITE_GIT_COMMIT_HASH=unknown
ENV VITE_BUILD_VERSION=$VITE_BUILD_VERSION
ENV VITE_GIT_COMMIT_HASH=$VITE_GIT_COMMIT_HASH
RUN npm run build

# Runtime stage
FROM node:24-alpine
# Business dates are local German dates
ENV TZ=Europe/Berlin
# Data dir owned by the runtime user and advertised via env — the compose
# volume (live-data:/data) inherits this ownership on first mount.
ENV DATA_DIR=/data
RUN mkdir -p /data && chown node:node /data
WORKDIR /app
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --chmod=755 entrypoint.sh ./
USER node

EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --retries=3 --start-period=30s \
  CMD wget --spider -q http://localhost:3000/health || exit 1
ENTRYPOINT ["./entrypoint.sh"]
