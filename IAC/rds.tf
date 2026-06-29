resource "aws_db_subnet_group" "this" {
  name       = "${local.name}-aurora"
  subnet_ids = aws_subnet.private[*].id
  tags = {
    Name        = "${local.name}-aurora-subnets"
    Environment = terraform.workspace
  }
}

resource "aws_rds_cluster_parameter_group" "this" {
  name        = "${local.name}-aurora-pg"
  family      = "aurora-postgresql16"
  description = "Grupo de parametros para habilitar log de consultas"

  parameter {
    name  = "log_statement"
    value = "all"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1"
  }
}

resource "aws_rds_cluster" "this" {
  cluster_identifier = "${local.name}-aurora"
  engine             = "aurora-postgresql"
  engine_version     = var.engine_version
  database_name      = "pardos"
  master_username    = "pardos_app"
  master_password    = random_password.db.result
  # Une el cluster primario al Aurora Global Database para la replica de
  # DR en us-west-2 (dr_rds.tf). null cuando enable_dr_region = false.
  global_cluster_identifier           = var.enable_dr_region ? aws_rds_global_cluster.this[0].id : null
  db_subnet_group_name                = aws_db_subnet_group.this.name
  vpc_security_group_ids              = [aws_security_group.aurora.id]
  storage_encrypted                   = true
  kms_key_id                          = aws_kms_key.this.arn
  backup_retention_period             = var.aurora_backup_retention
  skip_final_snapshot                 = false
  final_snapshot_identifier           = "${local.name}-aurora-final"
  copy_tags_to_snapshot               = true
  iam_database_authentication_enabled = true
  enabled_cloudwatch_logs_exports     = ["postgresql"]
  deletion_protection                 = var.deletion_protection
  db_cluster_parameter_group_name     = aws_rds_cluster_parameter_group.this.name

  tags = {
    Name        = "${local.name}-aurora"
    Environment = terraform.workspace
  }
}

resource "aws_rds_cluster_instance" "this" {
  count                           = var.aurora_instance_count
  identifier                      = "${local.name}-aurora-${count.index}"
  cluster_identifier              = aws_rds_cluster.this.id
  instance_class                  = var.aurora_instance_class
  engine                          = aws_rds_cluster.this.engine
  engine_version                  = aws_rds_cluster.this.engine_version
  db_subnet_group_name            = aws_db_subnet_group.this.name
  auto_minor_version_upgrade      = true
  monitoring_interval             = 0
  performance_insights_enabled    = true
  performance_insights_kms_key_id = aws_kms_key.this.arn

  tags = {
    Name        = "${local.name}-aurora-${count.index}"
    Environment = terraform.workspace
  }
}

resource "aws_db_proxy" "this" {
  name                   = "${local.name}-proxy"
  engine_family          = "POSTGRESQL"
  role_arn               = aws_iam_role.rds_proxy.arn
  vpc_subnet_ids         = aws_subnet.private[*].id
  vpc_security_group_ids = [aws_security_group.proxy.id]
  require_tls            = true

  auth {
    auth_scheme = "SECRETS"
    iam_auth    = "DISABLED"
    secret_arn  = aws_secretsmanager_secret.db.arn
  }

  tags = {
    Name        = "${local.name}-proxy"
    Environment = terraform.workspace
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
