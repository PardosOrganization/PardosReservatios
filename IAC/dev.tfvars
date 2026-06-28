# ENTORNO DEV — Recursos pequeños y de bajo costo.
# Usar con: terraform workspace select dev && terraform plan -var-file=dev.tfvars

account_id          = "181777503681" #CUENTA DE WILSON
domain              = "dev.pardos.com.pe"
vpc_cidr            = "10.10.0.0/16"
certificate_arn     = "arn:aws:acm:us-east-1:111111111111:certificate/dev-alb-cert-0000-0000"
acm_certificate_arn = "arn:aws:acm:us-east-1:111111111111:certificate/dev-cf-cert-0000-0000"

engine_version          = "16.1"
aurora_instance_class   = "db.t4g.medium"
aurora_instance_count   = 1
aurora_backup_retention = 1
deletion_protection     = false

redis_node_type          = "cache.t4g.micro"
redis_num_cache_clusters = 1
redis_multi_az           = false

ecs_task_cpu      = 256
ecs_task_memory   = 512
ecs_desired_count = 1
ecs_min_capacity  = 1
ecs_max_capacity  = 2

log_retention_days        = 30
waf_rate_limit            = 2000
enable_s3_replication     = false
enable_dr_region          = false
geo_restriction_locations = ["PE"]
