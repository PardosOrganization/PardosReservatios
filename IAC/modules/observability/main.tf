# CAPA 7 — Observabilidad: log groups, alarmas SLA y dashboard central.

locals {
  name = "${var.project}-${var.env}"
}

# ── Log Groups: uno por microservicio + ALB ──
resource "aws_cloudwatch_log_group" "ecs" {
  for_each          = toset(var.microservices)
  name              = "/${var.project}/ecs/${each.key}"
  retention_in_days = var.log_retention_days
}

resource "aws_cloudwatch_log_group" "alb" {
  name              = "/${var.project}/alb"
  retention_in_days = var.log_retention_days
}

# ── Alarmas SLA ──
resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  alarm_name          = "${local.name}-alb-5xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 10
  alarm_actions       = [var.sns_topic_arn]
  dimensions = {
    LoadBalancer = var.alb_arn_suffix
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
  alarm_actions       = [var.sns_topic_arn]
  dimensions = {
    LoadBalancer = var.alb_arn_suffix
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
  alarm_actions       = [var.sns_topic_arn]
  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = "svc-${each.key}"
  }
}

# ── Dashboard central ──
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
            ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", var.alb_arn_suffix],
            ["AWS/ApplicationELB", "HTTPCode_Target_5XX_Count", "LoadBalancer", var.alb_arn_suffix]
          ]
        }
      }
    ]
  })
}
