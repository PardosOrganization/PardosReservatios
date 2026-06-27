#####################################################################
# CERTIFICADO ACM REGIONAL PARA EL ALB DE DR (us-west-2)
# A diferencia de certificate_arn/acm_certificate_arn (ARNs pre-existentes
# pasados por variable), este certificado SÍ lo gestiona Terraform, con
# validación DNS automática contra la zona de Route 53 ya administrada.
#####################################################################

resource "aws_acm_certificate" "dr_alb" {
  count             = var.enable_dr_region ? 1 : 0
  provider          = aws.us_west_2
  domain_name       = var.domain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name        = "${local.name}-dr-alb-cert"
    Environment = terraform.workspace
  }
}

resource "aws_route53_record" "dr_alb_cert_validation" {
  for_each = var.enable_dr_region ? {
    for dvo in aws_acm_certificate.dr_alb[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      type   = dvo.resource_record_type
      record = dvo.resource_record_value
    }
  } : {}

  zone_id         = aws_route53_zone.this.id
  name            = each.value.name
  type            = each.value.type
  records         = [each.value.record]
  ttl             = 60
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "dr_alb" {
  count                   = var.enable_dr_region ? 1 : 0
  provider                = aws.us_west_2
  certificate_arn         = aws_acm_certificate.dr_alb[0].arn
  validation_record_fqdns = [for r in aws_route53_record.dr_alb_cert_validation : r.fqdn]
}
