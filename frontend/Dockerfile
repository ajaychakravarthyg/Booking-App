# ── Build stage ──────────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /build

# package files first so `npm ci` is cached independently of source changes.
COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# Vite inlines env vars at BUILD time, not run time — so the gateway URL has to be known
# here. Left empty by default, which makes the app call /api on its own origin and lets
# the nginx proxy below forward it. That keeps one image usable in compose without a
# rebuild per environment.
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# ── Runtime stage ────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine
COPY --from=build /build/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# 127.0.0.1, not localhost. Inside the container `localhost` resolves to BOTH 127.0.0.1
# and ::1, BusyBox wget tries the IPv6 address first, and nginx listens only on 0.0.0.0 —
# so the probe got "connection refused" and the container reported unhealthy forever while
# serving traffic perfectly. Pinning the address family removes the ambiguity.
HEALTHCHECK --interval=15s --timeout=4s --start-period=8s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
