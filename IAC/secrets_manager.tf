resource "random_password" "db" {
  length  = 24
  special = false
}

resource "aws_secretsmanager_secret" "db" {
  name       = "${local.name}/rds-credentials"
  kms_key_id = aws_kms_key.this.arn
  tags = {
    Name        = "${local.name}-rds-credentials"
    Environment = terraform.workspace
  }
}

# CRÍTICO: rotation_lambda_arn DEBE APUNTAR A UNA LAMBDA DE ROTACIÓN REAL Y EXISTENTE.
resource "aws_secretsmanager_secret_rotation" "this" {
  count               = 1
  secret_id           = aws_secretsmanager_secret.db.id
  rotation_lambda_arn = aws_lambda_function.db_rotation[0].arn
  rotation_rules {
    automatically_after_days = 30
  }
}

resource "aws_secretsmanager_secret_version" "db" {
  secret_id = aws_secretsmanager_secret.db.id
  secret_string = jsonencode({
    username = "pardos_app"
    password = random_password.db.result
  })
}
