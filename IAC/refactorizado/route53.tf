resource "aws_route53_zone" "this" {
  name = var.domain
  tags = {
    Name        = "${local.name}-zone"
    Environment = terraform.workspace
  }
}

resource "aws_route53_record" "root" {
  zone_id = aws_route53_zone.this.id
  name    = var.domain
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.this.domain_name
    zone_id                = aws_cloudfront_distribution.this.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_cloudwatch_log_resource_policy" "route53" {
  provider    = aws.us_east_1
  policy_name = "${local.name}-route53-query-logging"
  policy_document = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "route53.amazonaws.com" }
      Action    = ["logs:CreateLogStream", "logs:PutLogEvents"]
      Resource  = "arn:aws:logs:us-east-1:${data.aws_caller_identity.current.account_id}:log-group:/aws/route53/*"
    }]
  })
}

resource "aws_route53_query_log" "this" {
  zone_id                  = aws_route53_zone.this.id
  cloudwatch_log_group_arn = aws_cloudwatch_log_group.route53.arn
  depends_on               = [aws_cloudwatch_log_resource_policy.route53]
}

resource "aws_route53_key_signing_key" "this" {
  provider                   = aws.us_east_1
  hosted_zone_id             = aws_route53_zone.this.id
  key_management_service_arn = aws_kms_key.dnssec.arn
  name                       = "${local.name}-ksk"
}

resource "aws_route53_hosted_zone_dnssec" "this" {
  depends_on     = [aws_route53_key_signing_key.this]
  hosted_zone_id = aws_route53_key_signing_key.this.hosted_zone_id
}
