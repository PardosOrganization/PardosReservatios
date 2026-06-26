# ENTORNO PROD — Alta disponibilidad y protecciones activadas.
# Usar con: terraform workspace select prod && terraform plan -var-file=prod.tfvars

account_id          = "333333333333"
domain              = "pardos.com.pe"
vpc_cidr            = "10.30.0.0/16"
certificate_arn     = "arn:aws:acm:us-east-1:333333333333:certificate/prod-alb-cert-0000-0000"
acm_certificate_arn = "arn:aws:acm:us-east-1:333333333333:certificate/prod-cf-cert-0000-0000"

engine_version          = "16.1"
aurora_instance_class   = "db.r6g.large"
aurora_instance_count   = 2
aurora_backup_retention = 30
deletion_protection     = true

redis_node_type          = "cache.r6g.large"
redis_num_cache_clusters = 2
redis_multi_az           = true

ecs_task_cpu      = 1024
ecs_task_memory   = 2048
ecs_desired_count = 3
ecs_min_capacity  = 3
ecs_max_capacity  = 10

log_retention_days        = 365
waf_rate_limit            = 300
enable_s3_replication     = true
geo_restriction_locations = ["PE"]
