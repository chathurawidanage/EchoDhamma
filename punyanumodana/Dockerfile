FROM nginx:alpine

# Custom Nginx configuration with gzip and optimal caching
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy static web assets
COPY . /usr/share/nginx/html

# Expose HTTP port for Coolify
EXPOSE 8080

# Health check for Coolify and container monitoring
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
