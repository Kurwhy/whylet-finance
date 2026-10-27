FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
ARG VITE_GOOGLE_CLIENT_ID=""
ENV VITE_API_URL=/api/v1 VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN npm run build
FROM caddy:2-alpine
COPY --from=build /app/dist /srv
COPY deploy/Caddyfile /etc/caddy/Caddyfile
EXPOSE 80 443
