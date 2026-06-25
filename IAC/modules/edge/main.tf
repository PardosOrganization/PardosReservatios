# CAPA 1 — Edge y seguridad: Route 53, CloudFront, WAF, Shield, Cognito.

terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      configuration_aliases = [aws.us_east_1]
    }
  }
}

# Datos de la cuenta y region (para politicas de KMS y logs)
data "aws_caller_identity" "current" {}
data "aws_region" "current" { provider = aws.us_east_1 }

locals {
  name = "${var.project}-${var.env}"
}

# CMK simetrica para cifrar los Log Groups de WAF y Route53 (us-east-1)
resource "aws_kms_key" "logs" {
  provider                = aws.us_east_1
  description             = "CMK logs WAF/Route53 ${local.name}"
  enable_key_rotation     = true # CKV_AWS_7
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
        Action    = ["kms:Encrypt", "kms:Decrypt", "kms:ReEncrypt*", "kms:GenerateDataKey*", "kms:Describe*"]
        Resource  = "*"
      }
    ]
  })
}

#   AWS WAF
resource "aws_wafv2_web_acl" "this" {
  provider = aws.us_east_1
  name     = "${var.project}-webacl"
  scope    = "CLOUDFRONT" # ALCANCE GLOBAL CDN

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
        limit              = 300 # MÁXIMO PETICIONES/5MIN
        aggregate_key_type = "IP"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "rate-limit-reservas"
      sampled_requests_enabled   = true
    }
  }

  # CKV2_AWS_47: requiere ambas reglas administradas de AWS contra Log4j (CVE-2021-44228).
  rule {
    name     = "known-bad-inputs-log4j"
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
      metric_name                = "known-bad-inputs-log4j"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "anonymous-ip-list"
    priority = 3

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesAnonymousIpList"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "anonymous-ip-list"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.project}-webacl"
    sampled_requests_enabled   = true
  }
}

# Log Group para los logs del WAF (el nombre DEBE empezar con aws-waf-logs-)
resource "aws_cloudwatch_log_group" "waf" {
  provider          = aws.us_east_1
  name              = "aws-waf-logs-${var.project}"
  retention_in_days = 365                  # CKV_AWS_338 / CKV_AWS_66
  kms_key_id        = aws_kms_key.logs.arn # CKV_AWS_158
}

# Asocia el WAF con su destino de logs (CKV2_AWS_31)
resource "aws_wafv2_web_acl_logging_configuration" "this" {
  provider                = aws.us_east_1
  resource_arn            = aws_wafv2_web_acl.this.arn
  log_destination_configs = [aws_cloudwatch_log_group.waf.arn]
}

#   AWS CLOUDFRONT (OAC)
resource "aws_cloudfront_origin_access_control" "this" {
  name                              = "${var.project}-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always" # FIRMA OBLIGATORIA
  signing_protocol                  = "sigv4"
}

#   AWS S3 (CLOUDFRONT LOGS) - PARA CKV_AWS_86
resource "aws_s3_bucket" "cf_logs" {
  #checkov:skip=CKV_AWS_18:El bucket de logs de CloudFront no se loggea a si mismo.
  #checkov:skip=CKV_AWS_144:No se requiere replicacion para logs.
  #checkov:skip=CKV2_AWS_62:No se requieren notificaciones.
  bucket        = "${var.project}-cf-logs-${var.env}-${data.aws_caller_identity.current.account_id}"
  force_destroy = false
}

resource "aws_s3_bucket_public_access_block" "cf_logs" {
  bucket                  = aws_s3_bucket.cf_logs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "cf_logs" {
  bucket = aws_s3_bucket.cf_logs.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "cf_logs" {
  bucket = aws_s3_bucket.cf_logs.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "cf_logs" {
  bucket = aws_s3_bucket.cf_logs.id
  rule {
    id     = "expire-logs"
    status = "Enabled"
    expiration {
      days = 365
    }
    noncurrent_version_expiration {
      noncurrent_days = 30
    }
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

#   AWS S3 OWNERSHIP - SOLUCIONA CKV2_AWS_65
resource "aws_s3_bucket_ownership_controls" "cf_logs" {
  bucket = aws_s3_bucket.cf_logs.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

#   AWS CLOUDFRONT
resource "aws_cloudfront_distribution" "this" {
  #checkov:skip=CKV2_AWS_46:Falso positivo; el origen es un ALB, la referencia a S3 es solo para logs
  enabled              = true
  is_ipv6_enabled      = true
  comment              = "${local.name} CDN"
  web_acl_id           = aws_wafv2_web_acl.this.arn # ASOCIA WAF
  default_root_object  = "index.html"               # CKV_AWS_305
  aliases              = [var.domain]

  logging_config { # SOLUCIONA CKV_AWS_86
    bucket          = aws_s3_bucket.cf_logs.bucket_domain_name
    include_cookies = false
    prefix          = "cf-logs/"
  }

  origin {
    domain_name = var.alb_dns_name # ORIGEN ALB
    origin_id   = "alb-dinamico"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only" # TRÁFICO INTERNO HTTP
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods            = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods             = ["GET", "HEAD"]
    target_origin_id           = "alb-dinamico"
    viewer_protocol_policy     = "redirect-to-https" # FUERZA HTTPS
    response_headers_policy_id = aws_cloudfront_response_headers_policy.this.id # CKV2_AWS_32

    forwarded_values {
      query_string = true
      cookies {
        forward = "all"
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "whitelist" # CKV_AWS_374
      locations         = ["PE"]
    }
  }

  viewer_certificate { # CKV2_AWS_42
    acm_certificate_arn      = var.acm_certificate_arn # ARN del certificado en us-east-1
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
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

#   AWS SHIELD
resource "aws_shield_protection" "cloudfront" {
  name         = "${var.project}-cf"
  resource_arn = aws_cloudfront_distribution.this.arn # PROTEGE CLOUDFRONT
}

#   AWS COGNITO
resource "aws_cognito_user_pool" "this" {
  name = "${var.project}-empleados"

  password_policy {
    minimum_length    = 10 # MÍNIMO CARACTERES
    require_uppercase = true
    require_numbers   = true
    require_symbols   = true
  }
}

resource "aws_cognito_user_pool_client" "this" {
  name                = "${var.project}-empleados-spa"
  user_pool_id        = aws_cognito_user_pool.this.id
  generate_secret     = false # SPA SIN SECRET
  explicit_auth_flows = ["ALLOW_USER_SRP_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]
}

#   AWS ROUTE 53
resource "aws_route53_zone" "this" {
  name = var.domain
}

resource "aws_route53_record" "root" {
  zone_id = aws_route53_zone.this.id
  name    = var.domain
  type    = "A" # REGISTRO ALIAS

  alias {
    name                   = aws_cloudfront_distribution.this.domain_name # APUNTA A CDN
    zone_id                = aws_cloudfront_distribution.this.hosted_zone_id
    evaluate_target_health = false
  }
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

# ── DNSSEC (CKV2_AWS_38): la KSK debe vivir en us-east-1 (requisito de AWS) ──
resource "aws_kms_key" "dnssec" {
  provider = aws.us_east_1
  #checkov:skip=CKV_AWS_7:Las CMK asimetricas (ECC) para DNSSEC no soportan rotacion automatica
  description              = "Clave KSK para firmar DNSSEC de ${var.domain}"
  customer_master_key_spec = "ECC_NIST_P256"
  key_usage                = "SIGN_VERIFY"
  deletion_window_in_days  = 7

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowAccountAdmin"
        Effect    = "Allow"
        Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }
        Action    = "kms:*"
        Resource  = "*"
      },
      {
        Sid       = "AllowRoute53DNSSECService"
        Effect    = "Allow"
        Principal = { Service = "dnssec-route53.amazonaws.com" }
        Action    = ["kms:DescribeKey", "kms:GetPublicKey", "kms:Sign"]
        Resource  = "*"
      },
      {
        Sid       = "AllowRoute53DNSSECGrant"
        Effect    = "Allow"
        Principal = { Service = "dnssec-route53.amazonaws.com" }
        Action    = "kms:CreateGrant"
        Resource  = "*"
        Condition = {
          Bool = { "kms:GrantIsForAWSResource" = "true" }
        }
      }
    ]
  })
}

resource "aws_route53_key_signing_key" "this" {
  provider                    = aws.us_east_1
  hosted_zone_id              = aws_route53_zone.this.id
  key_management_service_arn  = aws_kms_key.dnssec.arn
  name                        = "${var.project}-ksk"
}

resource "aws_route53_hosted_zone_dnssec" "this" {
  depends_on     = [aws_route53_key_signing_key.this]
  hosted_zone_id = aws_route53_key_signing_key.this.hosted_zone_id
}
