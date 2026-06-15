output "alb_arn" {
  value = aws_lb.this.arn
}

output "alb_dns_name" {
  value = aws_lb.this.dns_name
}

output "alb_arn_suffix" {
  description = "Sufijo del ARN del ALB para las metricas de CloudWatch."
  value       = aws_lb.this.arn_suffix
}

output "ecs_cluster_arn" {
  value = aws_ecs_cluster.this.arn
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.this.name
}

output "target_group_arns" {
  value = { for k, tg in aws_lb_target_group.this : k => tg.arn }
}

output "api_endpoint" {
  value = aws_apigatewayv2_stage.this.invoke_url
}
