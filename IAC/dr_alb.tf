#####################################################################
# ALB DE FAILOVER EN us-west-2 (warm standby)
#####################################################################

#checkov:skip=CKV2_AWS_28: El ALB de DR es para contingencia (warm standby) y se protege a nivel de DNS failover/WAF en produccion.
resource "aws_lb" "dr" {
  count                      = var.enable_dr_region ? 1 : 0
  provider                   = aws.us_west_2
  name                       = "${local.name}-dr-alb"
  internal                   = false
  load_balancer_type         = "application"
  security_groups            = [aws_security_group.dr_alb[0].id]
  subnets                    = aws_subnet.dr_public[*].id
  enable_deletion_protection = var.deletion_protection

  tags = {
    Name        = "${local.name}-dr-alb"
    Environment = terraform.workspace
  }
}


resource "aws_lb_target_group" "dr" {
  for_each    = var.enable_dr_region ? local.dr_microservices_map : {}
  provider    = aws.us_west_2
  name        = "${local.name}-dr-tg-${each.key}"
  port        = var.container_port
  protocol    = "HTTPS"
  vpc_id      = aws_vpc.dr[0].id
  target_type = "ip"

  health_check {
    path                = "/health"
    protocol            = "HTTPS"
    matcher             = "200"
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = {
    Name        = "${local.name}-dr-tg-${each.key}"
    Environment = terraform.workspace
  }
}

resource "aws_lb_listener" "dr_http" {
  count             = var.enable_dr_region ? 1 : 0
  provider          = aws.us_west_2
  load_balancer_arn = aws_lb.dr[0].arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "dr_https" {
  count             = var.enable_dr_region ? 1 : 0
  provider          = aws.us_west_2
  load_balancer_arn = aws_lb.dr[0].arn
  port              = 443
  protocol          = "HTTPS"
  certificate_arn   = aws_acm_certificate_validation.dr_alb[0].certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.dr[var.microservices[0]].arn
  }
}

resource "aws_lb_listener_rule" "dr" {
  for_each     = var.enable_dr_region ? local.dr_microservices_map : {}
  provider     = aws.us_west_2
  listener_arn = aws_lb_listener.dr_http[0].arn
  priority     = index(var.microservices, each.key) + 1

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.dr[each.key].arn
  }
  condition {
    path_pattern {
      values = ["/${each.key}/*"]
    }
  }
}
