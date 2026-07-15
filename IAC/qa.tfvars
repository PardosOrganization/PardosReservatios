# ENTORNO QA — Recursos intermedios para pruebas de integración/carga.
# Usar con: terraform workspace select qa && terraform plan -var-file=qa.tfvars

account_id          = "181777503681" #CUENTA DE WILSON
domain              = "qa.pardos.com.pe"
vpc_cidr            = "10.20.0.0/16"
certificate_arn     = "arn:aws:acm:us-east-1:222222222222:certificate/qa-alb-cert-0000-0000"
acm_certificate_arn = "arn:aws:acm:us-east-1:222222222222:certificate/qa-cf-cert-0000-0000"

engine_version          = "16.1"
aurora_instance_class   = "db.r6g.large"
aurora_instance_count   = 1
aurora_backup_retention = 7
deletion_protection     = false

redis_node_type          = "cache.t4g.small"
redis_num_cache_clusters = 2
redis_multi_az           = true

ecs_task_cpu      = 512
ecs_task_memory   = 1024
ecs_desired_count = 2
ecs_min_capacity  = 2
ecs_max_capacity  = 6

log_retention_days        = 90
waf_rate_limit            = 1000
enable_s3_replication     = false
enable_dr_region          = false
geo_restriction_locations = ["PE"]
