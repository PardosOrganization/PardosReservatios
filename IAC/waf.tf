resource "aws_wafv2_web_acl" "this" {
  provider = aws.us_east_1
  name     = "${local.name}-webacl"
  scope    = "CLOUDFRONT"

  default_action {
    allow {}
  }

  rule {
    name     = "rate-limit-reservas"
    priority = 1

    action {
      block {}
    }
    statement {
      rate_based_statement {
        limit              = var.waf_rate_limit
        aggregate_key_type = "IP"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "rate-limit-reservas"
      sampled_requests_enabled   = true
    }
  }

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
    metric_name                = "${local.name}-webacl"
    sampled_requests_enabled   = true
  }

  tags = {
    Name        = "${local.name}-webacl"
    Environment = terraform.workspace
  }
}

resource "aws_wafv2_web_acl_logging_configuration" "this" {
  provider                = aws.us_east_1
  resource_arn            = aws_wafv2_web_acl.this.arn
  log_destination_configs = [aws_cloudwatch_log_group.waf.arn]
}
