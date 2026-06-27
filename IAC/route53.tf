resource "aws_route53_zone" "this" {
  name = var.domain
  tags = {
    Name        = "${local.name}-zone"
    Environment = terraform.workspace
  }
}

resource "aws_route53_record" "root" {
  # Solo existe cuando el DR esta desactivado (dev/qa): record simple, sin
  # costo de health check. En prod, lo reemplazan root_primary/root_secondary.
  count   = var.enable_dr_region ? 0 : 1
  zone_id = aws_route53_zone.this.id
  name    = var.domain
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.this.domain_name
    zone_id                = aws_cloudfront_distribution.this.hosted_zone_id
    evaluate_target_health = false
  }
}

#####################################################################
# FAILOVER REAL DE REGIÓN: us-east-1 (CloudFront/ALB) -> us-west-2 (ALB DR)
#####################################################################

resource "aws_route53_health_check" "primary" {
  count             = var.enable_dr_region ? 1 : 0
  fqdn              = aws_cloudfront_distribution.this.domain_name
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = 3
  request_interval  = 30

  tags = {
    Name        = "${local.name}-health-primary"
    Environment = terraform.workspace
  }
}

resource "aws_route53_record" "root_primary" {
  count          = var.enable_dr_region ? 1 : 0
  zone_id        = aws_route53_zone.this.id
  name           = var.domain
  type           = "A"
  set_identifier = "primary-us-east-1"

  failover_routing_policy {
    type = "PRIMARY"
  }

  health_check_id = aws_route53_health_check.primary[0].id

  alias {
    name                   = aws_cloudfront_distribution.this.domain_name
    zone_id                = aws_cloudfront_distribution.this.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "root_secondary" {
  count          = var.enable_dr_region ? 1 : 0
  zone_id        = aws_route53_zone.this.id
  name           = var.domain
  type           = "A"
  set_identifier = "secondary-us-west-2"

  failover_routing_policy {
    type = "SECONDARY"
  }

  alias {
    name                   = aws_lb.dr[0].dns_name
    zone_id                = aws_lb.dr[0].zone_id
    evaluate_target_health = true
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
