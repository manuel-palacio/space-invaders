FROM node:22-alpine AS build
WORKDIR /app
# Install deps first for better layer caching when only source changes.
COPY package.json package-lock.json* ./
RUN npm ci || npm install
# Copy the source tree needed for the bundle.
COPY index.html vite.config.js ./
COPY js/ ./js/
COPY css/ ./css/
COPY assets/ ./assets/
COPY manifest.json ./
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Custom nginx config for SPA and caching
RUN echo 'server { \
    listen 8080; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ { \
        expires 7d; \
        add_header Cache-Control "public, immutable"; \
    } \
}' > /etc/nginx/conf.d/default.conf
EXPOSE 8080
