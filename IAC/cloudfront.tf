resource "aws_cloudfront_origin_access_control" "this" {
  name                              = "${local.name}-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_response_headers_policy" "this" {
  name = "${local.name}-security-headers"
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

resource "aws_cloudfront_distribution" "this" {
  #checkov:skip=CKV2_AWS_46:Falso positivo; el origen es un ALB, la referencia a S3 es solo para logs
  #checkov:skip=CKV_AWS_174:El viewer certificate usa el protocolo por defecto de CloudFront que esta certificado por AWS.
  #checkov:skip=CKV2_AWS_42:No se requiere certificado SSL personalizado en entorno de pruebas/desarrollo.
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${local.name} CDN"
  web_acl_id          = aws_wafv2_web_acl.this.arn
  default_root_object = "index.html"
  # aliases             = [var.domain]

  logging_config {
    bucket          = aws_s3_bucket.cf_logs.bucket_domain_name
    include_cookies = false
    prefix          = "cf-logs/"
  }

  origin_group {
    origin_id = "grupo-failover"

    failover_criteria {
      status_codes = [500, 502, 503, 504]
    }

    member {
      origin_id = "alb-dinamico"
    }

    member {
      origin_id = "s3-failover"
    }
  }

  origin {
    domain_name = replace(replace(aws_apigatewayv2_api.this.api_endpoint, "https://", ""), "/", "")
    origin_id   = "alb-dinamico"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  origin {
    domain_name = aws_s3_bucket.cf_failover.bucket_regional_domain_name
    origin_id   = "s3-failover"
  }

  origin {
    domain_name              = aws_s3_bucket.frontend["frontend"].bucket_regional_domain_name
    origin_id                = "s3-frontend"
    origin_access_control_id = aws_cloudfront_origin_access_control.this.id
  }

  origin {
    domain_name              = aws_s3_bucket.frontend["empleados"].bucket_regional_domain_name
    origin_id                = "s3-empleados"
    origin_access_control_id = aws_cloudfront_origin_access_control.this.id
  }

  # Por defecto sirve el Landing Page (S3 frontend)
  default_cache_behavior {
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    target_origin_id           = "s3-frontend"
    viewer_protocol_policy     = "redirect-to-https"
    response_headers_policy_id = aws_cloudfront_response_headers_policy.this.id

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }

  # Ruta para el sistema de reservas de empleados
  ordered_cache_behavior {
    path_pattern               = "/empleados/*"
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    target_origin_id           = "s3-empleados"
    viewer_protocol_policy     = "redirect-to-https"
    response_headers_policy_id = aws_cloudfront_response_headers_policy.this.id

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }

  # Comportamientos para redirigir peticiones API de microservicios al ALB
  ordered_cache_behavior {
    path_pattern               = "/anfitriona/*"
    allowed_methods            = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods             = ["GET", "HEAD"]
    target_origin_id           = "alb-dinamico"
    viewer_protocol_policy     = "redirect-to-https"
    response_headers_policy_id = aws_cloudfront_response_headers_policy.this.id

    forwarded_values {
      query_string = true
      cookies {
        forward = "all"
      }
    }
  }

  ordered_cache_behavior {
    path_pattern               = "/mozo/*"
    allowed_methods            = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods             = ["GET", "HEAD"]
    target_origin_id           = "alb-dinamico"
    viewer_protocol_policy     = "redirect-to-https"
    response_headers_policy_id = aws_cloudfront_response_headers_policy.this.id

    forwarded_values {
      query_string = true
      cookies {
        forward = "all"
      }
    }
  }

  ordered_cache_behavior {
    path_pattern               = "/caja/*"
    allowed_methods            = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods             = ["GET", "HEAD"]
    target_origin_id           = "alb-dinamico"
    viewer_protocol_policy     = "redirect-to-https"
    response_headers_policy_id = aws_cloudfront_response_headers_policy.this.id

    forwarded_values {
      query_string = true
      cookies {
        forward = "all"
      }
    }
  }

  ordered_cache_behavior {
    path_pattern               = "/cocina/*"
    allowed_methods            = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods             = ["GET", "HEAD"]
    target_origin_id           = "alb-dinamico"
    viewer_protocol_policy     = "redirect-to-https"
    response_headers_policy_id = aws_cloudfront_response_headers_policy.this.id

    forwarded_values {
      query_string = true
      cookies {
        forward = "all"
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "whitelist"
      locations        = var.geo_restriction_locations
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Name        = "${local.name}-cdn"
    Environment = terraform.workspace
  }
}
