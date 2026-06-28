#####################################################################
# AURORA GLOBAL DATABASE — RÉPLICA CROSS-REGION EN us-west-2
# Único mecanismo soportado por AWS para tener una réplica de Aurora en
# otra región con failover gestionado. El cluster secundario es de solo
# lectura hasta que se promueva manualmente (o vía automatizacion futura)
# durante un failover real de region.
#####################################################################

resource "aws_rds_global_cluster" "this" {
  count                     = var.enable_dr_region ? 1 : 0
  global_cluster_identifier = "${local.name}-aurora-global"
  engine                    = "aurora-postgresql"
  engine_version            = var.engine_version
  database_name             = "pardos"
  storage_encrypted         = true
}

resource "aws_db_subnet_group" "dr" {
  count      = var.enable_dr_region ? 1 : 0
  provider   = aws.us_west_2
  name       = "${local.name}-dr-aurora"
  subnet_ids = aws_subnet.dr_public[*].id
  tags = {
    Name        = "${local.name}-dr-aurora-subnets"
    Environment = terraform.workspace
  }
}

resource "aws_rds_cluster_parameter_group" "dr" {
  provider    = aws.us_west_2
  name        = "${local.name}-dr-aurora-pg"
  family      = "aurora-postgresql16"
  description = "Grupo de parametros para habilitar log de consultas en DR"

  parameter {
    name  = "log_statement"
    value = "all"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1"
  }
}

resource "aws_rds_cluster" "dr" {
  count                           = var.enable_dr_region ? 1 : 0
  provider                        = aws.us_west_2
  cluster_identifier              = "${local.name}-dr-aurora"
  engine                          = "aurora-postgresql"
  engine_version                  = var.engine_version
  global_cluster_identifier       = aws_rds_global_cluster.this[0].id
  db_subnet_group_name            = aws_db_subnet_group.dr[0].name
  vpc_security_group_ids          = [aws_security_group.dr_aurora[0].id]
  skip_final_snapshot             = true
  deletion_protection             = var.deletion_protection
  db_cluster_parameter_group_name = aws_rds_cluster_parameter_group.dr.name
  enabled_cloudwatch_logs_exports = ["postgresql"]

  lifecycle {
    ignore_changes = [master_username, master_password]
  }

  depends_on = [aws_rds_cluster_instance.this]

  tags = {
    Name        = "${local.name}-dr-aurora"
    Environment = terraform.workspace
  }
}

resource "aws_rds_cluster_instance" "dr" {
  count                = var.enable_dr_region ? 1 : 0
  provider             = aws.us_west_2
  identifier           = "${local.name}-dr-aurora-0"
  cluster_identifier   = aws_rds_cluster.dr[0].id
  instance_class       = var.aurora_instance_class
  engine               = aws_rds_cluster.dr[0].engine
  engine_version       = aws_rds_cluster.dr[0].engine_version
  db_subnet_group_name = aws_db_subnet_group.dr[0].name

  tags = {
    Name        = "${local.name}-dr-aurora-0"
    Environment = terraform.workspace
  }
}
