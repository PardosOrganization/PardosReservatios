output "log_group_arns" {
  description = "ARNs de los log groups por microservicio."
  value       = { for k, lg in aws_cloudwatch_log_group.ecs : k => lg.arn }
}

output "alarm_arns" {
  value = concat(
    [aws_cloudwatch_metric_alarm.alb_5xx.arn, aws_cloudwatch_metric_alarm.alb_latency.arn],
    [for a in aws_cloudwatch_metric_alarm.ecs_cpu : a.arn]
  )
}

output "dashboard_name" {
  value = aws_cloudwatch_dashboard.this.dashboard_name
}
