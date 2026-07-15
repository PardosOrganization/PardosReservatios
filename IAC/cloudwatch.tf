resource "aws_cloudwatch_log_group" "ecs" {
  for_each          = toset(var.microservices)
  name              = "/${local.name}/ecs/${each.key}"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.s3.arn
}

resource "aws_cloudwatch_log_group" "adot" {
  name              = "/${local.name}/ecs/adot"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.s3.arn
}

resource "aws_cloudwatch_log_group" "elasticache" {
  name              = "/${local.name}/elasticache"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.s3.arn
}

resource "aws_cloudwatch_log_group" "rds_enhanced" {
  name              = "/${local.name}/rds/enhanced"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.s3.arn
}

resource "aws_cloudwatch_log_group" "alb" {
  name              = "/${local.name}/alb"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.s3.arn
}

resource "aws_cloudwatch_log_group" "api_gw" {
  name              = "/aws/vendedlogs/apigateway/${local.name}-api-logs"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.s3.arn
}

resource "aws_cloudwatch_log_group" "flow" {
  name              = "/${local.name}/vpc/flow-logs"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.flow.arn
}

resource "aws_cloudwatch_log_group" "waf" {
  provider          = aws.us_east_1
  name              = "aws-waf-logs-${local.name}"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.logs.arn
}

resource "aws_cloudwatch_log_group" "route53" {
  provider          = aws.us_east_1
  name              = "/aws/route53/${var.domain}"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.logs.arn
}

resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  alarm_name          = "${local.name}-alb-5xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 10
  alarm_actions       = [aws_sns_topic.notificaciones.arn]
  dimensions = {
    LoadBalancer = aws_lb.this.arn_suffix
  }
}

resource "aws_cloudwatch_metric_alarm" "alb_latency" {
  alarm_name          = "${local.name}-alb-latencia"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Average"
  threshold           = 2
  alarm_actions       = [aws_sns_topic.notificaciones.arn]
  dimensions = {
    LoadBalancer = aws_lb.this.arn_suffix
  }
}

resource "aws_cloudwatch_metric_alarm" "ecs_cpu" {
  for_each            = toset(var.microservices)
  alarm_name          = "${local.name}-${each.key}-cpu80"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 60
  statistic           = "Average"
  threshold           = 80
  alarm_actions       = [aws_sns_topic.notificaciones.arn]
  dimensions = {
    ClusterName = aws_ecs_cluster.this.name
    ServiceName = "svc-${each.key}"
  }
}

resource "aws_cloudwatch_metric_alarm" "ecs_memory" {
  for_each            = toset(var.microservices)
  alarm_name          = "${local.name}-${each.key}-memory85"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = 60
  statistic           = "Average"
  threshold           = 85
  alarm_actions       = [aws_sns_topic.notificaciones.arn]
  dimensions = {
    ClusterName = aws_ecs_cluster.this.name
    ServiceName = "svc-${each.key}"
  }
}

resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  alarm_name          = "${local.name}-rds-cpu80"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 60
  statistic           = "Average"
  threshold           = 80
  alarm_actions       = [aws_sns_topic.notificaciones.arn]
  dimensions = {
    DBClusterIdentifier = aws_rds_cluster.this.cluster_identifier
  }
}

resource "aws_cloudwatch_metric_alarm" "rds_connections" {
  alarm_name          = "${local.name}-rds-connections80"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 60
  statistic           = "Maximum"
  threshold           = 80
  alarm_actions       = [aws_sns_topic.notificaciones.arn]
  dimensions = {
    DBClusterIdentifier = aws_rds_cluster.this.cluster_identifier
  }
}

resource "aws_cloudwatch_metric_alarm" "redis_memory" {
  alarm_name          = "${local.name}-redis-memory75"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = 60
  statistic           = "Average"
  threshold           = 75
  alarm_actions       = [aws_sns_topic.notificaciones.arn]
  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.this.replication_group_id
  }
}

resource "aws_cloudwatch_metric_alarm" "sqs_depth" {
  alarm_name          = "${local.name}-sqs-depth1000"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Average"
  threshold           = 1000
  alarm_actions       = [aws_sns_topic.notificaciones.arn]
  dimensions = {
    QueueName = aws_sqs_queue.reservas.name
  }
}

resource "aws_cloudwatch_metric_alarm" "alb_4xx" {
  alarm_name          = "${local.name}-alb-4xx-spike"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "HTTPCode_Target_4XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 50
  alarm_actions       = [aws_sns_topic.notificaciones.arn]
  dimensions = {
    LoadBalancer = aws_lb.this.arn_suffix
  }
}

resource "aws_cloudwatch_metric_alarm" "api_gw_5xx" {
  alarm_name          = "${local.name}-api-gw-5xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "5XXError"
  namespace           = "AWS/ApiGateway"
  period              = 60
  statistic           = "Sum"
  threshold           = 5
  alarm_actions       = [aws_sns_topic.notificaciones.arn]
  dimensions = {
    ApiId = aws_apigatewayv2_api.this.id
  }
}

resource "aws_cloudwatch_dashboard" "this" {
  dashboard_name = "${local.name}-kpis"
  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "ALB - Latencia y errores 5xx"
          region = var.region
          metrics = [
            ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", aws_lb.this.arn_suffix],
            ["AWS/ApplicationELB", "HTTPCode_Target_5XX_Count", "LoadBalancer", aws_lb.this.arn_suffix]
          ]
        }
      }
    ]
  })
}
