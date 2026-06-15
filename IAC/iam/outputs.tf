output "ecs_execution_role_arn" {
  description = "ARN del rol que arranca los contenedores ECS (pull ECR + logs + secrets)."
  value       = aws_iam_role.ecs_execution.arn
}

output "ecs_task_role_arn" {
  description = "ARN del rol de runtime de los microservicios (SQS/SNS/X-Ray, sin acceso directo a Aurora)."
  value       = aws_iam_role.ecs_task.arn
}

output "rds_proxy_role_arn" {
  description = "ARN del rol que usa el RDS Proxy para leer credenciales en Secrets Manager."
  value       = aws_iam_role.rds_proxy.arn
}

output "terraform_role_arns" {
  description = "ARNs de los roles de provisioning por capa."
  value       = { for k, r in aws_iam_role.terraform : k => r.arn }
}
