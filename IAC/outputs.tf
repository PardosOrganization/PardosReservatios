output "cloudfront_domain" {
  description = "Dominio de la distribución CloudFront (entrada pública)."
  value       = aws_cloudfront_distribution.this.domain_name
}

output "alb_dns_name" {
  description = "DNS del Application Load Balancer."
  value       = aws_lb.this.dns_name
}

output "rds_proxy_endpoint" {
  description = "Endpoint del RDS Proxy (único punto de acceso a Aurora)."
  value       = aws_db_proxy.this.endpoint
}

output "redis_endpoint" {
  description = "Endpoint primario de ElastiCache Redis."
  value       = aws_elasticache_replication_group.this.primary_endpoint_address
}

output "ecr_repo_urls" {
  description = "URLs de los repositorios ECR por microservicio."
  value       = { for k, r in aws_ecr_repository.this : k => r.repository_url }
}

output "cognito_user_pool_id" {
  description = "ID del User Pool de Cognito (login del personal)."
  value       = aws_cognito_user_pool.this.id
}

output "api_endpoint" {
  description = "URL de invocación del API Gateway."
  value       = aws_apigatewayv2_stage.this.invoke_url
}

output "runtime_role_arns" {
  description = "ARNs de los roles de runtime."
  value = {
    ecs_execution  = aws_iam_role.ecs_execution.arn
    ecs_task       = aws_iam_role.ecs_task.arn
    rds_proxy      = aws_iam_role.rds_proxy.arn
    s3_replication = aws_iam_role.s3_replication.arn
  }
}
