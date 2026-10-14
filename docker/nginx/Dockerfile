FROM nginx:1.31.6-alpine@sha256:df221db836e1754089190208cee7eeda94f233197056426eda74a43ab1abeac2

# Copy our custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY folio-cors.conf /etc/nginx/folio-cors.conf

EXPOSE 80
