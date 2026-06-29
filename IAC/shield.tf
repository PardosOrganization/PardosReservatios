resource "aws_shield_protection" "cloudfront" {
  count        = var.enable_dr_region ? 1 : 0
  name         = "${local.name}-cf"
  resource_arn = aws_cloudfront_distribution.this.arn
  tags = {
    Name        = "${local.name}-cf"
    Environment = terraform.workspace
  }
}
