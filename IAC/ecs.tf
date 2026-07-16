resource "aws_ecs_cluster" "this" {
  name = "${local.name}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name        = "${local.name}-cluster"
    Environment = terraform.workspace
  }
}

resource "aws_ecs_task_definition" "this" {
  for_each                 = toset(var.microservices)
  family                   = "${local.name}-svc-${each.key}"
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
        { name = "DB_PROXY_ENDPOINT", value = aws_db_proxy.this.endpoint },
        { name = "SQS_QUEUE_ARN", value = aws_sqs_queue.reservas.arn },
        { name = "SNS_TOPIC_ARN", value = aws_sns_topic.notificaciones.arn }
      ]
      secrets = [
        { name = "DB_CREDENTIALS", valueFrom = aws_secretsmanager_secret.db.arn }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/${local.name}/ecs/${each.key}"
          "awslogs-region"        = var.region
          "awslogs-stream-prefix" = "svc"
        }
      }
    },
    {
      name      = "adot-collector"
      image     = "public.ecr.aws/aws-observability/aws-otel-collector:v0.39.0"
      essential = true
      environment = [
        {
          name  = "AOT_CONFIG_CONTENT"
          value = <<EOF
receivers:
  prometheus:
    config:
      scrape_configs:
        - job_name: 'svc-${each.key}'
          scrape_interval: 15s
          static_configs:
            - targets: ['localhost:8080']
              labels:
                service: 'svc-${each.key}'
          metrics_path: '/metrics'
processors:
  batch:
exporters:
  awsemf:
    region: '${var.region}'
    log_group_name: '/${local.name}/ecs/${each.key}'
    log_stream_name: 'adot-metrics'
    namespace: 'Pardos/ECS'
    dimension_rollup_option: 'NoDimensionRollup'
    resource_to_telemetry_conversion:
      enabled: true
service:
  pipelines:
    metrics:
      receivers: [prometheus]
      processors: [batch]
      exporters: [awsemf]
EOF
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/${local.name}/ecs/adot"
          "awslogs-region"        = var.region
          "awslogs-stream-prefix" = "adot"
        }
      }
    }
  ])

  tags = {
    Name        = "${local.name}-svc-${each.key}"
    Environment = terraform.workspace
  }
}

resource "aws_ecs_service" "this" {
  for_each        = toset(var.microservices)
  name            = "svc-${each.key}"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.this[each.key].arn
  desired_count   = var.ecs_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.this[each.key].arn
    container_name   = "svc-${each.key}"
    container_port   = var.container_port
  }

  tags = {
    Name        = "${local.name}-svc-${each.key}"
    Environment = terraform.workspace
  }
}
