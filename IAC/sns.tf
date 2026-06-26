resource "aws_sns_topic" "notificaciones" {
  name              = "${local.name}-notificaciones"
  kms_master_key_id = aws_kms_key.this.arn
  tags = {
    Name        = "${local.name}-notificaciones"
    Environment = terraform.workspace
  }
}
