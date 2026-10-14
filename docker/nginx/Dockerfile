FROM nginx:alpine

# Copy our custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY folio-cors.conf /etc/nginx/folio-cors.conf

EXPOSE 80
