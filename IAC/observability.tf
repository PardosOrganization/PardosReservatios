# Bucket S3 para Loki Chunks y storage
resource "aws_s3_bucket" "loki_storage" {
  #checkov:skip=CKV_AWS_144:La replicacion regional cruzada no es requerida para logs de desarrollo/QA.
  #checkov:skip=CKV_AWS_18:El logging de S3 no es requerido para el bucket de almacenamiento de logs de Loki.
  #checkov:skip=CKV_AWS_21:El versionado esta habilitado a continuacion en su respectivo bloque.
  #checkov:skip=CKV_AWS_145:El cifrado por defecto usando KMS esta habilitado en su respectivo bloque.
  bucket        = "${local.name}-loki-storage-${var.region}"
  force_destroy = true

  tags = {
    Name        = "${local.name}-loki-storage"
    Environment = terraform.workspace
  }
}

resource "aws_s3_bucket_public_access_block" "loki_storage" {
  bucket                  = aws_s3_bucket.loki_storage.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "loki_storage" {
  bucket = aws_s3_bucket.loki_storage.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "loki_storage" {
  bucket = aws_s3_bucket.loki_storage.id
  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.s3.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

# IAM Role para Loki Task
resource "aws_iam_role" "loki_task" {
  name               = "${local.name}-loki-task-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

data "aws_iam_policy_document" "loki_task" {
  statement {
    actions = [
      "s3:ListBucket",
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject"
    ]
    resources = [
      aws_s3_bucket.loki_storage.arn,
      "${aws_s3_bucket.loki_storage.arn}/*"
    ]
  }
  statement {
    actions = [
      "kms:Decrypt",
      "kms:GenerateDataKey*"
    ]
    resources = [aws_kms_key.s3.arn]
  }
}

resource "aws_iam_policy" "loki_task" {
  name   = "${local.name}-loki-task-policy"
  policy = data.aws_iam_policy_document.loki_task.json
}

resource "aws_iam_role_policy_attachment" "loki_task" {
  role       = aws_iam_role.loki_task.name
  policy_arn = aws_iam_policy.loki_task.arn
}

# IAM Role para Grafana Task
resource "aws_iam_role" "grafana_task" {
  name               = "${local.name}-grafana-task-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

data "aws_iam_policy_document" "grafana_task" {
  statement {
    actions = [
      "cloudwatch:DescribeAlarms",
      "cloudwatch:GetMetricData",
      "cloudwatch:GetMetricStatistics",
      "cloudwatch:ListMetrics"
    ]
    resources = ["*"]
  }
  statement {
    actions = [
      "logs:DescribeLogGroups",
      "logs:DescribeLogStreams",
      "logs:GetLogEvents",
      "logs:FilterLogEvents"
    ]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "grafana_task" {
  name   = "${local.name}-grafana-task-policy"
  policy = data.aws_iam_policy_document.grafana_task.json
}

resource "aws_iam_role_policy_attachment" "grafana_task" {
  role       = aws_iam_role.grafana_task.name
  policy_arn = aws_iam_policy.grafana_task.arn
}

# Target Group para Grafana
resource "aws_lb_target_group" "grafana" {
  #checkov:skip=CKV_AWS_378:Grafana corre servidor HTTP en Fargate.
  name        = "${local.name}-tg-grafana"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.this.id
  target_type = "ip"

  health_check {
    path                = "/api/health"
    protocol            = "HTTP"
    matcher             = "200"
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

# Target Group para Loki
resource "aws_lb_target_group" "loki" {
  #checkov:skip=CKV_AWS_378:Loki corre servidor HTTP en Fargate.
  name        = "${local.name}-tg-loki"
  port        = 3100
  protocol    = "HTTP"
  vpc_id      = aws_vpc.this.id
  target_type = "ip"

  health_check {
    path                = "/ready"
    protocol            = "HTTP"
    matcher             = "200"
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

# Listener Rules en el ALB
resource "aws_lb_listener_rule" "grafana" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.grafana.arn
  }
  condition {
    path_pattern {
      values = ["/grafana/*"]
    }
  }
}

resource "aws_lb_listener_rule" "loki" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 101

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.loki.arn
  }
  condition {
    path_pattern {
      values = ["/loki/*"]
    }
  }
}

# Security Group para Loki y Grafana
resource "aws_security_group" "observability" {
  #checkov:skip=CKV_AWS_23:Se restringe a los security groups origen ALB y Lambda.
  name        = "${local.name}-observability-sg"
  description = "Permite acceso a Loki y Grafana"
  vpc_id      = aws_vpc.this.id

  ingress {
    description     = "Acceso HTTP a Grafana desde el ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    description     = "Acceso HTTP a Loki desde el ALB y Lambda"
    from_port       = 3100
    to_port         = 3100
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id, aws_security_group.lambda_loki.id]
  }

  egress {
    description = "Permite todo el trafico de salida"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${local.name}-observability-sg"
    Environment = terraform.workspace
  }
}

# ECS Task Definition para Loki
resource "aws_ecs_task_definition" "loki" {
  family                   = "${local.name}-loki"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.loki_task.arn

  container_definitions = jsonencode([
    {
      name      = "loki"
      image     = "${aws_ecr_repository.loki.repository_url}:latest"
      essential = true
      portMappings = [{
        containerPort = 3100
        protocol      = "tcp"
      }]
      # expand-env permite que el config lea LOKI_S3_BUCKET y AWS_REGION del entorno
      command = ["-config.file=/etc/loki/loki-config-aws.yaml", "-config.expand-env=true"]
      environment = [
        { name = "LOKI_S3_BUCKET", value = aws_s3_bucket.loki_storage.id },
        { name = "AWS_REGION", value = var.region }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.adot.name
          "awslogs-region"        = var.region
          "awslogs-stream-prefix" = "loki"
        }
      }
    }
  ])
}

# ECS Service para Loki
resource "aws_ecs_service" "loki" {
  name            = "loki"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.loki.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.observability.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.loki.arn
    container_name   = "loki"
    container_port   = 3100
  }
}

# ECS Task Definition para Grafana
resource "aws_ecs_task_definition" "grafana" {
  family                   = "${local.name}-grafana"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.grafana_task.arn

  container_definitions = jsonencode([
    {
      name      = "grafana"
      image     = "grafana/grafana:10.4.1"
      essential = true
      portMappings = [{
        containerPort = 3000
        protocol      = "tcp"
      }]
      environment = [
        { name = "GF_SECURITY_ADMIN_PASSWORD", value = "admin" },
        { name = "GF_SERVER_ROOT_URL", value = "${aws_apigatewayv2_stage.this.invoke_url}grafana/" },
        { name = "GF_SERVER_SERVE_FROM_SUB_PATH", value = "true" }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.adot.name
          "awslogs-region"        = var.region
          "awslogs-stream-prefix" = "grafana"
        }
      }
    }
  ])
}

# ECS Service para Grafana
resource "aws_ecs_service" "grafana" {
  name            = "grafana"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.grafana.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.observability.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.grafana.arn
    container_name   = "grafana"
    container_port   = 3000
  }
}
