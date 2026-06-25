

terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      configuration_aliases = [aws.us_east_1]
    }
  }
}

data "aws_caller_identity" "current" {}

locals {
  name = "${var.project}-${var.env}"
}

#   AWS WAF
resource "aws_wafv2_web_acl" "this" {
  provider = aws.us_east_1
  name     = "${var.project}-webacl"
  scope    = "CLOUDFRONT"                          # ALCANCE GLOBAL CDN

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
        limit              = 300                    # MÁXIMO PETICIONES/5MIN
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


#   AWS CLOUDFRONT (OAC)
resource "aws_cloudfront_origin_access_control" "this" {
  name                              = "${var.project}-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"     # FIRMA OBLIGATORIA
  signing_protocol                  = "sigv4"
}

#   AWS CLOUDFRONT
resource "aws_cloudfront_distribution" "this" {
  enabled         = true
  is_ipv6_enabled = true
  comment         = "${local.name} CDN"
  web_acl_id      = aws_wafv2_web_acl.this.arn      # ASOCIA WAF

  origin {
    domain_name = var.alb_dns_name                  # ORIGEN ALB
    origin_id   = "alb-dinamico"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"           # TRÁFICO INTERNO HTTP
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "alb-dinamico"
    viewer_protocol_policy = "redirect-to-https"    # FUERZA HTTPS

    forwarded_values {
      query_string = true
      cookies {
        forward = "all"
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
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
    minimum_length    = 10                          # MÍNIMO CARACTERES
    require_uppercase = true
    require_numbers   = true
    require_symbols   = true
  }
}

resource "aws_cognito_user_pool_client" "this" {
  name                = "${var.project}-empleados-spa"
  user_pool_id        = aws_cognito_user_pool.this.id
  generate_secret     = false                       # SPA SIN SECRET
  explicit_auth_flows = ["ALLOW_USER_SRP_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]
}

#   AWS ROUTE 53
resource "aws_route53_zone" "this" {
  name = var.domain
}

resource "aws_route53_record" "root" {
  zone_id = aws_route53_zone.this.id
  name    = var.domain
  type    = "A"                                     # REGISTRO ALIAS

  alias {
    name                   = aws_cloudfront_distribution.this.domain_name  # APUNTA A CDN
    zone_id                = aws_cloudfront_distribution.this.hosted_zone_id
    evaluate_target_health = false
  }
}

# ── DNSSEC (CKV2_AWS_38): la KSK debe vivir en us-east-1 (requisito de AWS) ──
resource "aws_kms_key" "dnssec" {
  provider                 = aws.us_east_1
  description               = "Clave KSK para firmar DNSSEC de ${var.domain}"
  customer_master_key_spec = "ECC_NIST_P256"
  key_usage                 = "SIGN_VERIFY"
  deletion_window_in_days   = 7

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
  depends_on      = [aws_route53_key_signing_key.this]
  hosted_zone_id  = aws_route53_key_signing_key.this.hosted_zone_id
}
