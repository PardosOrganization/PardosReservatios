#####################################################################
# ECS FARGATE EN us-west-2 (warm standby, capacidad minima)
#####################################################################

resource "aws_cloudwatch_log_group" "dr_ecs" {
  for_each          = var.enable_dr_region ? local.dr_microservices_map : {}
  provider          = aws.us_west_2
  name              = "/${local.name}/dr/ecs/${each.key}"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.replica.arn   # CKV_AWS_158: CMK us-west-2, política AllowCloudWatchLogsDR
}

resource "aws_ecs_cluster" "dr" {
  count    = var.enable_dr_region ? 1 : 0
  provider = aws.us_west_2
  name     = "${local.name}-dr-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name        = "${local.name}-dr-cluster"
    Environment = terraform.workspace
  }
}

resource "aws_ecs_task_definition" "dr" {
  for_each                 = var.enable_dr_region ? local.dr_microservices_map : {}
  provider                 = aws.us_west_2
  family                   = "${local.name}-dr-svc-${each.key}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.ecs_task_cpu
  memory                   = var.ecs_task_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "svc-${each.key}"
      image     = "${aws_ecr_repository.this[each.key].repository_url}:latest"
      essential = true
      portMappings = [{
        containerPort = var.container_port
        protocol      = "tcp"
      }]
      environment = [
        # En DR, el secundario Aurora es solo-lectura hasta una promocion
        # manual/automatizada del Global Database; los proxies de escritura
        # no se duplican en este warm standby.
        { name = "DB_ENDPOINT", value = var.enable_dr_region ? aws_rds_cluster.dr[0].endpoint : "" },
        { name = "SQS_QUEUE_ARN", value = aws_sqs_queue.reservas.arn },
        { name = "SNS_TOPIC_ARN", value = aws_sns_topic.notificaciones.arn }
      ]
      secrets = [
        { name = "DB_CREDENTIALS", valueFrom = aws_secretsmanager_secret.db.arn }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/${local.name}/dr/ecs/${each.key}"
          "awslogs-region"        = local.dr_region
          "awslogs-stream-prefix" = "svc"
        }
      }
    }
  ])

  tags = {
    Name        = "${local.name}-dr-svc-${each.key}"
    Environment = terraform.workspace
  }

  depends_on = [aws_cloudwatch_log_group.dr_ecs]
}

resource "aws_ecs_service" "dr" {
  for_each        = var.enable_dr_region ? local.dr_microservices_map : {}
  provider        = aws.us_west_2
  name            = "svc-${each.key}"
  cluster         = aws_ecs_cluster.dr[0].id
  task_definition = aws_ecs_task_definition.dr[each.key].arn
  desired_count   = var.ecs_dr_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.dr_public[*].id
    security_groups  = [aws_security_group.dr_ecs[0].id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.dr[each.key].arn
    container_name   = "svc-${each.key}"
    container_port   = var.container_port
  }

  tags = {
    Name        = "${local.name}-dr-svc-${each.key}"
    Environment = terraform.workspace
  }
}
