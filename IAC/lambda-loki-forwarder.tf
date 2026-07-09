data "archive_file" "loki_forwarder" {
  type        = "zip"
  source_file = "${path.module}/lambda-code/loki-forwarder/index.py"
  output_path = "${path.module}/lambda-code/loki_forwarder.zip"
}

resource "aws_iam_role" "lambda_loki" {
  name = "${local.name}-lambda-loki-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_loki_vpc" {
  role       = aws_iam_role.lambda_loki.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_security_group" "lambda_loki" {
  name        = "${local.name}-lambda-loki-sg"
  description = "Permite a la Lambda enviar logs a Loki"
  vpc_id      = aws_vpc.this.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${local.name}-lambda-loki-sg"
  }
}

resource "aws_lambda_function" "loki_forwarder" {
  filename         = data.archive_file.loki_forwarder.output_path
  source_code_hash = data.archive_file.loki_forwarder.output_base64sha256
  function_name    = "${local.name}-loki-forwarder"
  role             = aws_iam_role.lambda_loki.arn
  handler          = "index.lambda_handler"
  runtime          = "python3.11"
  timeout          = 30

  environment {
    variables = {
      # Apunta a la IP / DNS privado de Loki a través del ALB interno
      LOKI_URL    = "http://${aws_lb.this.dns_name}/loki/api/v1/push"
      ENVIRONMENT = terraform.workspace
    }
  }

  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda_loki.id]
  }
}

resource "aws_lambda_permission" "allow_cloudwatch" {
  statement_id  = "AllowExecutionFromCloudWatch"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.loki_forwarder.function_name
  principal     = "logs.amazonaws.com"
}

# Filtro de suscripción para enviar logs de los microservicios a Loki
resource "aws_cloudwatch_log_subscription_filter" "ecs_to_loki" {
  for_each        = toset(var.microservices)
  name            = "${local.name}-${each.key}-to-loki"
  log_group_name  = "/${local.name}/ecs/${each.key}"
  filter_pattern  = "" # Vacío para capturar todos los logs
  destination_arn = aws_lambda_function.loki_forwarder.arn

  depends_on = [aws_lambda_permission.allow_cloudwatch]
}
