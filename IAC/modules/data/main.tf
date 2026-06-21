# CAPA 6 — Datos: KMS, Secrets Manager, Aurora PostgreSQL Multi-AZ, RDS Proxy, Backup.

locals {
  name = "${var.project}-${var.env}"
}

# ── KMS: clave maestra del proyecto (cifra Aurora, Secrets, SQS, etc.) ──
resource "aws_kms_key" "this" {
  description             = "Clave maestra del proyecto ${var.project}"
  enable_key_rotation     = true
  deletion_window_in_days = 30
  tags                    = { Name = "${local.name}-kms" }
}

resource "aws_kms_alias" "this" {
  name          = "alias/${var.project}-key"
  target_key_id = aws_kms_key.this.key_id
}

# ── Secrets Manager: credenciales de Aurora ──
resource "random_password" "db" {
  length  = 24
  special = false
}

resource "aws_secretsmanager_secret" "db" {
  name       = "${var.project}/rds-credentials"
  kms_key_id = aws_kms_key.this.arn
}

resource "aws_secretsmanager_secret_version" "db" {
  secret_id = aws_secretsmanager_secret.db.id
  secret_string = jsonencode({
    username = "pardos_app"
    password = random_password.db.result
  })
}

# ── Aurora PostgreSQL Multi-AZ (Primary writer 1a + Standby reader 1b) ──
resource "aws_db_subnet_group" "this" {
  name       = "${local.name}-aurora"
  subnet_ids = var.private_subnet_ids
}

resource "aws_rds_cluster" "this" {
  cluster_identifier        = "${var.project}-aurora-${var.env}"
  engine                    = "aurora-postgresql"
  engine_version            = var.engine_version
  database_name             = "pardos"
  master_username           = "pardos_app"
  master_password           = random_password.db.result
  db_subnet_group_name      = aws_db_subnet_group.this.name
  vpc_security_group_ids    = [var.aurora_sg_id]
  storage_encrypted         = true
  kms_key_id                = aws_kms_key.this.arn
  backup_retention_period   = 7
  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.project}-aurora-final-${var.env}"
  copy_tags_to_snapshot     = true # CKV_AWS_313
  iam_database_authentication_enabled = true # CKV_AWS_162
  enabled_cloudwatch_logs_exports = ["postgresql"] # CKV_AWS_324
}

# Writer (us-east-1a) + Reader (us-east-1b)
resource "aws_rds_cluster_instance" "this" {
  count                = 2
  identifier           = "${var.project}-aurora-${var.env}-${count.index}"
  cluster_identifier   = aws_rds_cluster.this.id
  instance_class       = "db.r6g.large"
  engine               = aws_rds_cluster.this.engine
  engine_version       = aws_rds_cluster.this.engine_version
  db_subnet_group_name = aws_db_subnet_group.this.name
}

# ── RDS Proxy: ÚNICO punto de acceso a Aurora (pool de conexiones) ──
resource "aws_db_proxy" "this" {
  name                   = "${var.project}-proxy-${var.env}"
  engine_family          = "POSTGRESQL"
  role_arn               = var.rds_proxy_role_arn
  vpc_subnet_ids         = var.private_subnet_ids
  vpc_security_group_ids = [var.proxy_sg_id]
  require_tls            = true

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

# ── AWS Backup (Snapshots de Aurora, retencion 7 dias) ──
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
    schedule          = "cron(0 7 * * ? *)"
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
