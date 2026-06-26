resource "aws_backup_vault" "this" {
  name        = "${local.name}-vault"
  kms_key_arn = aws_kms_key.this.arn
  tags = {
    Name        = "${local.name}-vault"
    Environment = terraform.workspace
  }
}

resource "aws_backup_plan" "this" {
  name = "${local.name}-plan"
  rule {
    rule_name         = "diario-nocturno"
    target_vault_name = aws_backup_vault.this.name
    schedule          = "cron(0 7 * * ? *)"
    lifecycle {
      delete_after = 7
    }
  }

  tags = {
    Name        = "${local.name}-plan"
    Environment = terraform.workspace
  }
}

resource "aws_backup_selection" "this" {
  name         = "${local.name}-aurora-seleccion"
  iam_role_arn = aws_iam_role.backup.arn
  plan_id      = aws_backup_plan.this.id
  resources    = [aws_rds_cluster.this.arn]
}
