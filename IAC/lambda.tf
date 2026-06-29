data "archive_file" "db_rotation_zip" {
  count       = 1
  type        = "zip"
  source_dir  = "${path.module}/lambda-code/db_rotation"
  output_path = "${path.module}/lambda-code/db_rotation.zip"
}

resource "aws_iam_role" "db_rotation_lambda" {
  count              = 1
  name               = "${local.name}-db-rotation-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action    = "sts:AssumeRole"
        Effect    = "Allow"
        Principal = { Service = "lambda.amazonaws.com" }
      }
    ]
  })

  tags = {
    Name        = "${local.name}-db-rotation-role"
    Environment = terraform.workspace
  }
}

resource "aws_iam_policy" "db_rotation_lambda" {
  count       = 1
  name        = "${local.name}-db-rotation-policy"
  description = "Permissions for database password rotation Lambda"
  policy      = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "SecretsManagerAccess"
        Effect   = "Allow"
        Action   = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret",
          "secretsmanager:PutSecretValue",
          "secretsmanager:UpdateSecretVersionStage"
        ]
        Resource = [aws_secretsmanager_secret.db.arn]
      },
      {
        Sid      = "RandomPassword"
        Effect   = "Allow"
        Action   = ["secretsmanager:GetRandomPassword"]
        Resource = ["*"]
      },
      {
        Sid      = "KMSAccess"
        Effect   = "Allow"
        Action   = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = [aws_kms_key.this.arn]
      },
      {
        Sid      = "LoggingAccess"
        Effect   = "Allow"
        Action   = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = ["arn:aws:logs:${var.region}:${var.account_id}:log-group:/aws/lambda/${local.name}-rotacion-db:*"]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "db_rotation_lambda" {
  count      = 1
  role       = aws_iam_role.db_rotation_lambda[0].name
  policy_arn = aws_iam_policy.db_rotation_lambda[0].arn
}

resource "aws_iam_role_policy_attachment" "db_rotation_vpc" {
  count      = 1
  role       = aws_iam_role.db_rotation_lambda[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_security_group" "db_rotation_lambda" {
  count       = 1
  name_prefix = "${local.name}-db-rotation-sg-"
  vpc_id      = aws_vpc.this.id
  description = "Security Group for DB Rotation Lambda"

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${local.name}-db-rotation-sg"
    Environment = terraform.workspace
  }
}

resource "aws_security_group_rule" "proxy_from_lambda" {
  count                    = 1
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = aws_security_group.proxy.id
  source_security_group_id = aws_security_group.db_rotation_lambda[0].id
  description              = "Allow PostgreSQL traffic from DB rotation Lambda"
}

resource "aws_security_group_rule" "aurora_from_lambda" {
  count                    = 1
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = aws_security_group.aurora.id
  source_security_group_id = aws_security_group.db_rotation_lambda[0].id
  description              = "Allow PostgreSQL traffic from DB rotation Lambda"
}

resource "aws_cloudwatch_log_group" "db_rotation" {
  count             = 1
  name              = "/aws/lambda/${local.name}-rotacion-db"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.this.arn
}

resource "aws_lambda_function" "db_rotation" {
  # CKV_AWS_116: Lambda runs inside a VPC
  # CKV_AWS_173: Environment variables encrypted using CMK
  # CKV_AWS_272: Code signing (not strictly required for university labs, skipped/handled via default)
  count            = 1
  filename         = data.archive_file.db_rotation_zip[0].output_path
  function_name    = "${local.name}-rotacion-db"
  role             = aws_iam_role.db_rotation_lambda[0].arn
  handler          = "lambda_function.lambda_handler"
  source_code_hash = data.archive_file.db_rotation_zip[0].output_base64sha256
  runtime          = "python3.12"
  timeout          = 30
  kms_key_arn      = aws_kms_key.this.arn

  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.db_rotation_lambda[0].id]
  }

  environment {
    variables = {
      DB_HOST = aws_db_proxy.this.endpoint
      DB_PORT = "5432"
      DB_NAME = "pardos"
    }
  }

  depends_on = [aws_cloudwatch_log_group.db_rotation]

  tags = {
    Name        = "${local.name}-rotacion-db"
    Environment = terraform.workspace
  }
}

resource "aws_lambda_permission" "allow_secrets_manager" {
  count         = 1
  statement_id  = "AllowExecutionFromSecretsManager"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.db_rotation[0].function_name
  principal     = "secretsmanager.amazonaws.com"
}
