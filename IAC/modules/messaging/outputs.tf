output "sqs_arn" {
  value = aws_sqs_queue.reservas.arn
}

output "sqs_url" {
  value = aws_sqs_queue.reservas.url
}

output "sns_arn" {
  value = aws_sns_topic.notificaciones.arn
}

output "redis_endpoint" {
  value = aws_elasticache_replication_group.this.primary_endpoint_address
}

output "redis_reader_endpoint" {
  value = aws_elasticache_replication_group.this.reader_endpoint_address
}
