# Raíz de la infraestructura de Pardos Chicken.
# Orquesta los módulos por capa del diagrama respetando el grafo de dependencias:
#
#   iam ─┐
#        ├─> network ─> data ─> messaging ─> compute ─> edge ─> frontend
#   cicd ┘                                      │
#                                          observability (consume todos)

locals {
  name_prefix   = "${var.project}-${var.env}"
  microservices = var.microservices
}

# ── IAM: roles de provisioning (Terraform*) y runtime (ECS/Proxy) ──
module "iam" {
  source     = "./iam"
  project    = var.project
  env        = var.env
  region     = var.region
  account_id = var.account_id
}

# ── CAPA: Red base (VPC, AZs, subnets privadas, SGs) ──
module "network" {
  source   = "./modules/network"
  project  = var.project
  env      = var.env
  vpc_cidr = var.vpc_cidr
  azs      = var.azs
}

# ── CAPA 6: Datos (KMS, Secrets, Aurora, RDS Proxy, Backup) ──
module "data" {
  source             = "./modules/data"
  project            = var.project
  env                = var.env
  vpc_id             = module.network.vpc_id
  private_subnet_ids = module.network.private_subnet_ids
  aurora_sg_id       = module.network.aurora_sg_id
  proxy_sg_id        = module.network.proxy_sg_id
  rds_proxy_role_arn = module.iam.rds_proxy_role_arn
}

# ── CAPA 5: Mensajería y caché (SQS, SNS, ElastiCache Redis) ──
module "messaging" {
  source             = "./modules/messaging"
  project            = var.project
  env                = var.env
  private_subnet_ids = module.network.private_subnet_ids
  redis_sg_id        = module.network.redis_sg_id
  kms_key_arn        = module.data.kms_key_arn
}

# ── CAPA 3: CI/CD (ECR, CodeBuild, CodeDeploy, CodePipeline) ──
module "cicd" {
  source        = "./modules/cicd"
  project       = var.project
  env           = var.env
  microservices = local.microservices
  kms_key_arn   = module.data.kms_key_arn
}

# ── CAPA 4: Compute (API Gateway, VPC Link, ALB, ECS Fargate, Auto Scaling) ──
module "compute" {
  source             = "./modules/compute"
  project            = var.project
  env                = var.env
  region             = var.region
  vpc_id             = module.network.vpc_id
  private_subnet_ids = module.network.private_subnet_ids
  alb_sg_id          = module.network.alb_sg_id
  ecs_sg_id          = module.network.ecs_sg_id
  microservices      = local.microservices
  ecr_repo_urls      = module.cicd.ecr_repo_urls
  execution_role_arn = module.iam.ecs_execution_role_arn
  task_role_arn      = module.iam.ecs_task_role_arn
  rds_proxy_endpoint = module.data.rds_proxy_endpoint
  db_secret_arn      = module.data.db_secret_arn
  sqs_queue_arn      = module.messaging.sqs_arn
  sns_topic_arn      = module.messaging.sns_arn
  certificate_arn    = var.certificate_arn   # ACM cert ARN for HTTPS listener
  kms_key_arn        = module.data.kms_key_arn # CKV_AWS_91: bucket de logs del ALB
}

# ── CAPA 1: Edge y seguridad (Route 53, CloudFront, WAF, Shield, Cognito) ──
module "edge" {
  source       = "./modules/edge"
  project      = var.project
  env          = var.env
  domain       = var.domain
  alb_dns_name = module.compute.alb_dns_name

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }
}

# ── CAPA 2: Frontend (S3 Landing+Reservas / Empleados, servido vía CloudFront/OAC) ──
module "frontend" {
  source               = "./modules/frontend"
  project              = var.project
  env                  = var.env
  kms_key_arn          = module.data.kms_key_arn
  cloudfront_arn       = module.edge.cloudfront_arn
  cloudfront_oac_id    = module.edge.oac_id
  sns_topic_arn        = module.messaging.sns_arn
  replication_role_arn = module.iam.replication_role_arn
}

# ── CAPA 7: Observabilidad (CloudWatch logs, alarmas SLA, dashboard) ──
module "observability" {
  source           = "./modules/observability"
  project          = var.project
  env              = var.env
  region           = var.region
  microservices    = local.microservices
  alb_arn_suffix   = module.compute.alb_arn_suffix
  ecs_cluster_name = module.compute.ecs_cluster_name
  sns_topic_arn    = module.messaging.sns_arn
}