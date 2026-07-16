# Imagen de Loki con la configuración de S3 horneada.
# Fargate no puede montar archivos locales, por eso el config viaja en la imagen.
FROM grafana/loki:3.0.0

COPY loki-config-aws.yaml /etc/loki/loki-config-aws.yaml
