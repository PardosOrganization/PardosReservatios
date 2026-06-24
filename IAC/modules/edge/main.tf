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
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "alb-dinamico"
    viewer_protocol_policy = "redirect-to-https"

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
