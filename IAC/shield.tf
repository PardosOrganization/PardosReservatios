resource "aws_shield_protection" "cloudfront" {
  name         = "${local.name}-cf"
  resource_arn = aws_cloudfront_distribution.this.arn
  tags = {
    Name        = "${local.name}-cf"
    Environment = terraform.workspace
  }
}
