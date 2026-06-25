# Imagen placeholder: sirve /health en 8080 (compatible con el Target Group de ECS).
# Reemplazar por el build real del microservicio cuando exista el código.
FROM nginx:alpine

RUN printf 'server {\n\
  listen 8080;\n\
  location = /health { return 200 "ok"; add_header Content-Type text/plain; }\n\
  location / { return 200 "svc-mozo up"; add_header Content-Type text/plain; }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 8080
