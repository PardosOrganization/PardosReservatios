

locals {
  name = "${var.project}-${var.env}"
}

#   AWS KMS
resource "aws_kms_key" "this" {
  description             = "Clave maestra del proyecto ${var.project}"
  enable_key_rotation     = true                # ROTACIÓN AUTOMÁTICA
  deletion_window_in_days = 30                  # 30 DÍAS PARA BORRAR
  tags                    = { Name = "${local.name}-kms" }

  # CKV2_AWS_64
   policy      = <<POLICY
  {
    "Version": "2012-10-17",
    "Id": "default",
    "Statement": [
      {
        "Sid": "DefaultAllow",
        "Effect": "Allow",
        "Principal": {
          "AWS": "arn:aws:iam::123456789012:root"
        },
        "Action": "kms:*",
        "Resource": "*"
      }
    ]
  }
POLICY
}

resource "aws_kms_alias" "this" {
  name          = "alias/${var.project}-key"
  target_key_id = aws_kms_key.this.key_id
}

#   AWS SECRETS MANAGER
resource "random_password" "db" {
  length  = 24
  special = false
}

resource "aws_secretsmanager_secret" "db" {
  name       = "${var.project}/rds-credentials"
  kms_key_id = aws_kms_key.this.arn              # CIFRADO CON KMS
}
# CKV2_AWS_57
resource "aws_secretsmanager_secret_rotation" "this" {
  secret_id           = aws_secretsmanager_secret.db.id
  rotation_lambda_arn = "arn:aws:lambda:us-east-1:123456789012:function:rotacion-db"
  rotation_rules {
    automatically_after_days = 30                # ROTA CADA 30 DÍAS
  }
}

resource "aws_secretsmanager_secret_version" "db" {
  secret_id = aws_secretsmanager_secret.db.id
  secret_string = jsonencode({
    username = "pardos_app"
    password = random_password.db.result
  })
}

#   AWS AURORA POSTGRESQL
resource "aws_db_subnet_group" "this" {
  name       = "${local.name}-aurora"
  subnet_ids = var.private_subnet_ids
}

# CKV2_AWS_27
resource "aws_rds_cluster_parameter_group" "this" {
  name        = "${local.name}-aurora-pg"
  family      = "aurora-postgresql16"
  description = "Grupo de parametros personalizado para habilitar log de consultas"

  parameter {
    name  = "log_statement"
    value = "all"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1"
  }
}


#---------------------
resource "aws_rds_cluster" "this" {
  cluster_identifier        = "${var.project}-aurora-${var.env}"
  engine                    = "aurora-postgresql" # MOTOR BD
  engine_version            = var.engine_version
  database_name             = "pardos"
  master_username           = "pardos_app"
  master_password           = random_password.db.result
  db_subnet_group_name      = aws_db_subnet_group.this.name
  vpc_security_group_ids    = [var.aurora_sg_id]
  storage_encrypted         = true               # CIFRADO EN REPOSO
  kms_key_id                = aws_kms_key.this.arn
  backup_retention_period   = 7                  # 7 DÍAS BACKUP
  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.project}-aurora-final-${var.env}"
  copy_tags_to_snapshot     = true # CKV_AWS_313
  iam_database_authentication_enabled = true # CKV_AWS_162
  enabled_cloudwatch_logs_exports = ["postgresql"] # CKV_AWS_324
  deletion_protection = true # CKV_AWS_139
  db_cluster_parameter_group_name     = aws_rds_cluster_parameter_group.this.name #CKV2_AWS_27
}

# Writer (us-east-1a) + Reader (us-east-1b)
resource "aws_rds_cluster_instance" "this" {
  count                = 2
  identifier           = "${var.project}-aurora-${var.env}-${count.index}"
  cluster_identifier   = aws_rds_cluster.this.id
  instance_class       = "db.r6g.large"          # INSTANCIA OPTIMIZADA
  engine               = aws_rds_cluster.this.engine
  engine_version       = aws_rds_cluster.this.engine_version
  db_subnet_group_name = aws_db_subnet_group.this.name
  auto_minor_version_upgrade = true # CKV_AWS_226
  monitoring_interval  = 5 # CKV_AWS_118
  performance_insights_enabled    = true             # CKV_AWS_353
  performance_insights_kms_key_id = aws_kms_key.this.arn # CKV_AWS_354
}

#   AWS RDS PROXY
resource "aws_db_proxy" "this" {
  name                   = "${var.project}-proxy-${var.env}"
  engine_family          = "POSTGRESQL"
  role_arn               = var.rds_proxy_role_arn
  vpc_subnet_ids         = var.private_subnet_ids
  vpc_security_group_ids = [var.proxy_sg_id]
  require_tls            = true                  # FUERZA TLS

  auth {
    auth_scheme = "SECRETS"
    iam_auth    = "DISABLED"
    secret_arn  = aws_secretsmanager_secret.db.arn
  }
}

resource "aws_db_proxy_default_target_group" "this" {
  db_proxy_name = aws_db_proxy.this.name
}

resource "aws_db_proxy_target" "this" {
  db_proxy_name         = aws_db_proxy.this.name
  target_group_name     = aws_db_proxy_default_target_group.this.name
  db_cluster_identifier = aws_rds_cluster.this.id
}

#   AWS BACKUP
resource "aws_backup_vault" "this" {
  name        = "${var.project}-vault"
  kms_key_arn = aws_kms_key.this.arn
}

resource "aws_iam_role" "backup" {
  name = "${var.project}-backup-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "backup.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "backup" {
  role       = aws_iam_role.backup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup"
}

resource "aws_backup_plan" "this" {
  name = "${var.project}-plan"
  rule {
    rule_name         = "diario-nocturno"
    target_vault_name = aws_backup_vault.this.name
    schedule          = "cron(0 7 * * ? *)"     # 2AM LIMA (UTC-5)
    lifecycle {
      delete_after = 7
    }
  }
}

resource "aws_backup_selection" "this" {
  name         = "${var.project}-aurora-seleccion"
  iam_role_arn = aws_iam_role.backup.arn
  plan_id      = aws_backup_plan.this.id
  resources    = [aws_rds_cluster.this.arn]
}
