FROM node:22-alpine AS build

WORKDIR /workspace
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci --workspace=@enviotrack/web --include-workspace-root=false

COPY apps/web ./apps/web
RUN npm run build --workspace=@enviotrack/web

FROM nginx:1.28-alpine
ENV API_UPSTREAM=http://api:3000
ENV NGINX_ENVSUBST_FILTER=^API_UPSTREAM$

COPY apps/web/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
