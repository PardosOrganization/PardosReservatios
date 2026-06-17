output "cloudfront_arn" {
  value = aws_cloudfront_distribution.this.arn
}

output "cloudfront_domain" {
  value = aws_cloudfront_distribution.this.domain_name
}

output "web_acl_arn" {
  value = aws_wafv2_web_acl.this.arn
}

output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.this.id
}

output "oac_id" {
  value = aws_cloudfront_origin_access_control.this.id
}
