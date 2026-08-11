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

HEALTHCHECK --interval=15s --timeout=4s --start-period=8s --retries=3 \
  CMD wget -q --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
