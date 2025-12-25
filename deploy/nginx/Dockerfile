# Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Nginx runtime
FROM nginx:1.27-alpine

COPY deploy/nginx/nginx.conf /etc/nginx/conf.d/default.conf

# Frontend static
COPY --from=frontend-build /frontend/dist/ /usr/share/nginx/html/

# Shared static volume mount point (Django collectstatic)
RUN mkdir -p /static

EXPOSE 80
