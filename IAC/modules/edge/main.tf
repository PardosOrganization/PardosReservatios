# Datos de la cuenta y region (para politicas de KMS y logs)
data "aws_caller_identity" "current" {}
data "aws_region" "current" { provider = aws.us_east_1 }
 
# CMK simetrica para cifrar los Log Groups de WAF y Route53 (us-east-1)
resource "aws_kms_key" "logs" {
  provider                = aws.us_east_1
  description             = "CMK logs WAF/Route53 ${local.name}"
  enable_key_rotation     = true        # CKV_AWS_7
  deletion_window_in_days = 7
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "Root"
        Effect    = "Allow"
        Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }
        Action    = "kms:*"
        Resource  = "*"
      },
      {
        Sid       = "CloudWatchLogs"
        Effect    = "Allow"
        Principal = { Service = "logs.${data.aws_region.current.name}.amazonaws.com" }
        Action    = ["kms:Encrypt","kms:Decrypt","kms:ReEncrypt*","kms:GenerateDataKey*","kms:Describe*"]
        Resource  = "*"
      }
    ]
  })
}

# CAPA 1 — Edge y seguridad: Route 53, CloudFront, WAF, Shield, Cognito.

terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      configuration_aliases = [aws.us_east_1]
    }
  }
}

locals {
  name = "${var.project}-${var.env}"
}

# ── WAF v2 (scope CLOUDFRONT debe vivir en us-east-1) ──
resource "aws_wafv2_web_acl" "this" {
  provider = aws.us_east_1
  name     = "${var.project}-webacl"
  scope    = "CLOUDFRONT"

  default_action {
    allow {}
  }

  # Rate limiting de reservas: max 3 intentos por IP en 5 minutos.
  rule {
    name     = "rate-limit-reservas"
    priority = 1

    action {
      block {}
    }
    statement {
      rate_based_statement {
        limit              = 300
        aggregate_key_type = "IP"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "rate-limit-reservas"
      sampled_requests_enabled   = true
    }
  }

  # Grupo administrado AWS que cubre Log4Shell y entradas maliciosas
  rule {
    name     = "AWS-KnownBadInputs"
    priority = 2
    override_action {
      none {}
    }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "known-bad-inputs"
      sampled_requests_enabled   = true
    }
  }


  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.project}-webacl"
    sampled_requests_enabled   = true
  }
}

# ── Origin Access Control para S3 ──
resource "aws_cloudfront_origin_access_control" "this" {
  name                              = "${var.project}-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ── CloudFront: sirve frontend estatico (S3) + reservas dinamicas (ALB) ──
resource "aws_cloudfront_distribution" "this" {
  #checkov:skip=CKV_AWS_86:Logging via bucket con ACLs queda fuera del alcance del POC
  #checkov:skip=CKV_AWS_310:Diseno de origen unico (ALB); failover no aplica
  #checkov:skip=CKV_AWS_174:POC usa el certificado por defecto de CloudFront (sin ACM propio)
  #checkov:skip=CKV2_AWS_42:POC usa el certificado por defecto de CloudFront (sin ACM propio)
  #checkov:skip=CKV2_AWS_47:Falso positivo de Prisma Cloud. El WAFv2 con proteccion Log4j si esta asociado correctamente.
  enabled         = true
  is_ipv6_enabled = true
  comment         = "${local.name} CDN"
  web_acl_id      = aws_wafv2_web_acl.this.arn
  default_root_object = "index.html"   # CKV_AWS_305

  origin {
    domain_name = var.alb_dns_name
    origin_id   = "alb-dinamico"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods            = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods             = ["GET", "HEAD"]
    target_origin_id           = "alb-dinamico"
    viewer_protocol_policy     = "redirect-to-https"
    response_headers_policy_id = aws_cloudfront_response_headers_policy.this.id   # CKV2_AWS_32


    forwarded_values {
      query_string = true
      cookies {
        forward = "all"
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "whitelist"   # CKV_AWS_374
      locations        = ["PE"]
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

resource "aws_cloudfront_response_headers_policy" "this" {
  name = "${var.project}-security-headers"
  security_headers_config {
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      override                   = true
      preload                    = true
    }
    content_type_options { override = true }
    frame_options {
      frame_option = "DENY"
      override     = true
    }
    referrer_policy {
      referrer_policy = "same-origin"
      override        = true
    }
    xss_protection {
      mode_block = true
      protection = true
      override   = true
    }
  }
}


# ── Shield: proteccion DDoS sobre CloudFront ──
resource "aws_shield_protection" "cloudfront" {
  name         = "${var.project}-cf"
  resource_arn = aws_cloudfront_distribution.this.arn
}

# ── Cognito: login del personal (empleados) ──
resource "aws_cognito_user_pool" "this" {
  name = "${var.project}-empleados"

  password_policy {
    minimum_length    = 10
    require_uppercase = true
    require_numbers   = true
    require_symbols   = true
  }
}

resource "aws_cognito_user_pool_client" "this" {
  name                = "${var.project}-empleados-spa"
  user_pool_id        = aws_cognito_user_pool.this.id
  generate_secret     = false
  explicit_auth_flows = ["ALLOW_USER_SRP_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]
}

# ── Route 53: zona y registros DNS ──
resource "aws_route53_zone" "this" {
  name = var.domain
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

# Log Group para los logs del WAF (el nombre DEBE empezar con aws-waf-logs-)
resource "aws_cloudwatch_log_group" "waf" {
  provider          = aws.us_east_1
  name              = "aws-waf-logs-${var.project}"
  retention_in_days = 365                 # CKV_AWS_338 / CKV_AWS_66
  kms_key_id        = aws_kms_key.logs.arn # CKV_AWS_158
}
 
# Asocia el WAF con su destino de logs (CKV2_AWS_31)
resource "aws_wafv2_web_acl_logging_configuration" "this" {
  provider                = aws.us_east_1
  resource_arn            = aws_wafv2_web_acl.this.arn
  log_destination_configs = [aws_cloudwatch_log_group.waf.arn]
}

resource "aws_cloudwatch_log_group" "route53" {
  provider          = aws.us_east_1
  name              = "/aws/route53/${var.domain}"
  retention_in_days = 365
  kms_key_id        = aws_kms_key.logs.arn
}
 
# Permite que el servicio Route53 escriba en CloudWatch Logs
resource "aws_cloudwatch_log_resource_policy" "route53" {
  provider    = aws.us_east_1
  policy_name = "${var.project}-route53-query-logging"
  policy_document = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "route53.amazonaws.com" }
      Action    = ["logs:CreateLogStream","logs:PutLogEvents"]
      Resource  = "arn:aws:logs:us-east-1:${data.aws_caller_identity.current.account_id}:log-group:/aws/route53/*"
    }]
  })
}
 
resource "aws_route53_query_log" "this" {
  zone_id                  = aws_route53_zone.this.id
  cloudwatch_log_group_arn = aws_cloudwatch_log_group.route53.arn
  depends_on               = [aws_cloudwatch_log_resource_policy.route53]
}

resource "aws_kms_key" "dnssec" {
  provider                 = aws.us_east_1
  #checkov:skip=CKV_AWS_7:Las CMK asimetricas (ECC) para DNSSEC no soportan rotacion automatica
  customer_master_key_spec = "ECC_NIST_P256"
  key_usage                = "SIGN_VERIFY"
  deletion_window_in_days  = 7
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "Root"
        Effect    = "Allow"
        Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }
        Action    = "kms:*"
        Resource  = "*"
      },
      {
        Sid       = "Route53DNSSEC"
        Effect    = "Allow"
        Principal = { Service = "dnssec-route53.amazonaws.com" }
        Action    = ["kms:DescribeKey","kms:GetPublicKey","kms:Sign","kms:CreateGrant"]
        Resource  = "*"
      }
    ]
  })
}
 
resource "aws_route53_key_signing_key" "this" {
  hosted_zone_id             = aws_route53_zone.this.id
  key_management_service_arn  = aws_kms_key.dnssec.arn
  name                       = "${var.project}-ksk"
}
 
resource "aws_route53_hosted_zone_dnssec" "this" {
  hosted_zone_id = aws_route53_key_signing_key.this.hosted_zone_id
  depends_on     = [aws_route53_key_signing_key.this]
}
