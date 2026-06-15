output "cloudfront_domain" {
  description = "Dominio de la distribución CloudFront (entrada pública)."
  value       = module.edge.cloudfront_domain
}

output "alb_dns_name" {
  description = "DNS del Application Load Balancer."
  value       = module.compute.alb_dns_name
}

output "rds_proxy_endpoint" {
  description = "Endpoint del RDS Proxy (único punto de acceso a Aurora)."
  value       = module.data.rds_proxy_endpoint
}

output "redis_endpoint" {
  description = "Endpoint primario de ElastiCache Redis."
  value       = module.messaging.redis_endpoint
}

output "ecr_repo_urls" {
  description = "URLs de los repositorios ECR por microservicio."
  value       = module.cicd.ecr_repo_urls
}

output "cognito_user_pool_id" {
  description = "ID del User Pool de Cognito (login del personal)."
  value       = module.edge.cognito_user_pool_id
}

output "runtime_role_arns" {
  description = "ARNs de los roles de runtime (separados de los roles de provisioning)."
  value = {
    ecs_execution = module.iam.ecs_execution_role_arn
    ecs_task      = module.iam.ecs_task_role_arn
    rds_proxy     = module.iam.rds_proxy_role_arn
  }
}
