# CAPA 4 — Compute: API Gateway -> VPC Link v2 -> ALB -> ECS Fargate + Auto Scaling.

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  name            = "${var.project}-${var.env}"
  # ELB service account IDs por region (para la bucket policy de ALB access logs)
  # Source: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/enable-access-logging.html
  elb_account_ids = {
    us-east-1      = "127311923021"
    us-east-2      = "033677994240"
    us-west-1      = "027434742980"
    us-west-2      = "797873946194"
    eu-west-1      = "156460612806"
    eu-central-1   = "054676820928"
    ap-southeast-1 = "114774131450"
    ap-northeast-1 = "582318560864"
    sa-east-1      = "507241528517"
  }
  elb_account_id = local.elb_account_ids[data.aws_region.current.name]
}

# ── S3 bucket para ALB Access Logs (CKV_AWS_91) ──
#checkov:skip=CKV_AWS_18:El bucket de logs del ALB no puede loggearse a si mismo (loop).
#checkov:skip=CKV_AWS_144:Replicacion cross-region no requerida para logs de acceso efimeros.
resource "aws_s3_bucket" "alb_logs" {
  bucket        = "${var.project}-alb-logs-${var.env}-${data.aws_caller_identity.current.account_id}"
  force_destroy = false
}

# CKV2_AWS_61: Lifecycle para expirar logs despues de 1 año.
resource "aws_s3_bucket_lifecycle_configuration" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id
  rule {
    id     = "expire-alb-logs"
    status = "Enabled"
    expiration {
      days = 365
    }
    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

resource "aws_s3_bucket_versioning" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "alb_logs" {
  bucket                  = aws_s3_bucket.alb_logs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Bucket policy: permite al servicio ELB escribir los logs de acceso.
resource "aws_s3_bucket_policy" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowELBLogs"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${local.elb_account_id}:root"
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.alb_logs.arn}/AWSLogs/${data.aws_caller_identity.current.account_id}/*"
      }
    ]
  })
}

# ── ALB interno (recibe trafico del VPC Link) ──
resource "aws_lb" "this" {
  name               = "${var.project}-alb-${var.env}"
  internal           = true
  load_balancer_type = "application"
  security_groups    = [var.alb_sg_id]
  subnets            = var.private_subnet_ids
  drop_invalid_header_fields  = true # CKV_AWS_131
  enable_deletion_protection  = true # CKV_AWS_150: Proteccion contra borrado accidental.

  # CKV_AWS_91: Habilitar access logs del ALB hacia S3.
  access_logs {
    bucket  = aws_s3_bucket.alb_logs.id
    prefix  = "alb"
    enabled = true
  }

  depends_on = [aws_s3_bucket_policy.alb_logs]
}

resource "aws_lb_target_group" "this" {
  for_each    = toset(var.microservices)
  name        = "${var.project}-tg-${each.key}"
  port        = var.container_port
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = "/health"
    matcher             = "200"
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

resource "aws_lb_listener" "http_redirect" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# Una regla de enrutamiento por microservicio (/anfitriona/*, /mozo/*, ...)
resource "aws_lb_listener_rule" "this" {
  for_each     = toset(var.microservices)
  listener_arn = aws_lb_listener.http.arn
  priority     = index(var.microservices, each.key) + 1

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this[each.key].arn
  }
  condition {
    path_pattern {
      values = ["/${each.key}/*"]
    }
  }
}

# ── API Gateway HTTP + VPC Link v2 ──
resource "aws_apigatewayv2_vpc_link" "this" {
  name               = "${var.project}-vpclink"
  subnet_ids         = var.private_subnet_ids
  security_group_ids = [var.alb_sg_id]
}

resource "aws_apigatewayv2_api" "this" {
  name          = "${var.project}-api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "this" {
  api_id             = aws_apigatewayv2_api.this.id
  integration_type   = "HTTP_PROXY"
  integration_uri    = aws_lb_listener.http.arn
  integration_method = "ANY"
  connection_type    = "VPC_LINK"
  connection_id      = aws_apigatewayv2_vpc_link.this.id
}


# CKV_AWS_309
resource "aws_apigatewayv2_route" "this" {
  api_id    = aws_apigatewayv2_api.this.id
  route_key = "ANY /{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.this.id}"
  # LINEA NECESARIA PARA LA AUTORIZACIÓN
  authorization_type = "AWS_IAM" 
}

# CKV_AWS_76 
# NUEVO RECURSO PARA LOS LOGS
resource "aws_cloudwatch_log_group" "api_gw_logs" {
  name              = "/aws/vendedlogs/apigateway/${var.project}-api-logs"
  retention_in_days = 365  # CKV_AWS_338: Retener logs al menos 1 año.
  kms_key_id        = var.kms_key_arn
}

resource "aws_apigatewayv2_stage" "this" {
  api_id      = aws_apigatewayv2_api.this.id
  name        = "$default"
  auto_deploy = true
  # AGREGAR ESTE BLOQUE PARA HABILITAR LOS LOGS
  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gw_logs.arn
    format          = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      protocol       = "$context.protocol"
      responseLength = "$context.responseLength"
    })
  }
}
# ── ECS Fargate ──
resource "aws_ecs_cluster" "this" {
  name = "${var.project}-cluster-${var.env}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_ecs_task_definition" "this" {
  for_each                 = toset(var.microservices)
  family                   = "${var.project}-svc-${each.key}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([
    {
      name      = "svc-${each.key}"
      image     = "${var.ecr_repo_urls[each.key]}:latest"
      essential = true
      portMappings = [{
        containerPort = var.container_port
        protocol      = "tcp"
      }]
      environment = [
        { name = "DB_PROXY_ENDPOINT", value = var.rds_proxy_endpoint },
        { name = "SQS_QUEUE_ARN", value = var.sqs_queue_arn },
        { name = "SNS_TOPIC_ARN", value = var.sns_topic_arn }
      ]
      secrets = [
        { name = "DB_CREDENTIALS", valueFrom = var.db_secret_arn }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/${var.project}/ecs/${each.key}"
          "awslogs-region"        = var.region
          "awslogs-stream-prefix" = "svc"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "this" {
  for_each        = toset(var.microservices)
  name            = "svc-${each.key}"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.this[each.key].arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = var.private_subnet_ids
    security_groups = [var.ecs_sg_id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.this[each.key].arn
    container_name   = "svc-${each.key}"
    container_port   = var.container_port
  }
}

# ── Auto Scaling: Target Tracking (CPU 70%) + Scheduled (pre-pico) ──
resource "aws_appautoscaling_target" "this" {
  for_each           = toset(var.microservices)
  max_capacity       = 10
  min_capacity       = 2
  resource_id        = "service/${aws_ecs_cluster.this.name}/${aws_ecs_service.this[each.key].name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "cpu" {
  for_each           = toset(var.microservices)
  name               = "${var.project}-${each.key}-cpu70"
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

# Scheduled scaling: pre-calienta antes de las horas pico (almuerzo y cena).
resource "aws_appautoscaling_scheduled_action" "almuerzo_up" {
  for_each           = toset(var.microservices)
  name               = "${var.project}-${each.key}-prepico-almuerzo"
  service_namespace  = aws_appautoscaling_target.this[each.key].service_namespace
  resource_id        = aws_appautoscaling_target.this[each.key].resource_id
  scalable_dimension = aws_appautoscaling_target.this[each.key].scalable_dimension
  schedule           = "cron(45 11 * * ? *)"

  scalable_target_action {
    min_capacity = 6
    max_capacity = 10
  }
}

resource "aws_appautoscaling_scheduled_action" "cena_up" {
  for_each           = toset(var.microservices)
  name               = "${var.project}-${each.key}-prepico-cena"
  service_namespace  = aws_appautoscaling_target.this[each.key].service_namespace
  resource_id        = aws_appautoscaling_target.this[each.key].resource_id
  scalable_dimension = aws_appautoscaling_target.this[each.key].scalable_dimension
  schedule           = "cron(45 18 * * ? *)"

  scalable_target_action {
    min_capacity = 6
    max_capacity = 10
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this[var.microservices[0]].arn
  }
}
