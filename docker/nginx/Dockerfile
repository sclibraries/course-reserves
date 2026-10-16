FROM nginx:1.31.6-alpine@sha256:df221db836e1754089190208cee7eeda94f233197056426eda74a43ab1abeac2

# Render the selected FOLIO upstream from the environment at container startup.
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY folio-cors.conf /etc/nginx/folio-cors.conf

EXPOSE 80
