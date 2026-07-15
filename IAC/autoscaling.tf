resource "aws_appautoscaling_target" "this" {
  for_each           = toset(var.microservices)
  max_capacity       = var.ecs_max_capacity
  min_capacity       = var.ecs_min_capacity
  resource_id        = "service/${aws_ecs_cluster.this.name}/${aws_ecs_service.this[each.key].name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "cpu" {
  for_each           = toset(var.microservices)
  name               = "${local.name}-${each.key}-cpu70"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.this[each.key].resource_id
  scalable_dimension = aws_appautoscaling_target.this[each.key].scalable_dimension
  service_namespace  = aws_appautoscaling_target.this[each.key].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value = 70
  }
}

resource "aws_appautoscaling_scheduled_action" "almuerzo_up" {
  for_each           = toset(var.microservices)
  name               = "${local.name}-${each.key}-prepico-almuerzo"
  service_namespace  = aws_appautoscaling_target.this[each.key].service_namespace
  resource_id        = aws_appautoscaling_target.this[each.key].resource_id
  scalable_dimension = aws_appautoscaling_target.this[each.key].scalable_dimension
  schedule           = "cron(45 11 * * ? *)"

  scalable_target_action {
    min_capacity = var.ecs_max_capacity > 6 ? 6 : var.ecs_max_capacity
    max_capacity = var.ecs_max_capacity
  }
}

resource "aws_appautoscaling_scheduled_action" "cena_up" {
  for_each           = toset(var.microservices)
  name               = "${local.name}-${each.key}-prepico-cena"
  service_namespace  = aws_appautoscaling_target.this[each.key].service_namespace
  resource_id        = aws_appautoscaling_target.this[each.key].resource_id
  scalable_dimension = aws_appautoscaling_target.this[each.key].scalable_dimension
  schedule           = "cron(45 18 * * ? *)"

  scalable_target_action {
    min_capacity = var.ecs_max_capacity > 6 ? 6 : var.ecs_max_capacity
    max_capacity = var.ecs_max_capacity
  }
}
