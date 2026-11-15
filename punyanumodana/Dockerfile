FROM nginx:alpine

# Custom Nginx configuration with gzip and optimal caching
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy static web assets
COPY . /usr/share/nginx/html

# Expose HTTP port for Coolify
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
