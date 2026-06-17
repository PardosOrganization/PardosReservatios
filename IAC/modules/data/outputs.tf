output "kms_key_arn" {
  value = aws_kms_key.this.arn
}

output "kms_key_id" {
  value = aws_kms_key.this.key_id
}

output "db_secret_arn" {
  value = aws_secretsmanager_secret.db.arn
}

output "rds_proxy_endpoint" {
  description = "Endpoint del RDS Proxy: unica via de acceso a Aurora desde los microservicios."
  value       = aws_db_proxy.this.endpoint
}

output "aurora_cluster_arn" {
  value = aws_rds_cluster.this.arn
}
