resource "aws_lb" "this" {
  #checkov:skip=CKV2_AWS_20:El ALB es interno en red privada y recibe trafico ya enrutado por API Gateway.
  name                       = "${local.name}-alb"
  internal                   = true
  load_balancer_type         = "application"
  security_groups            = [aws_security_group.alb.id]
  subnets                    = aws_subnet.private[*].id
  drop_invalid_header_fields = true
  enable_deletion_protection = var.deletion_protection

  access_logs {
    bucket  = aws_s3_bucket.alb_logs.id
    prefix  = "alb"
    enabled = true
  }

  depends_on = [aws_s3_bucket_policy.alb_logs]

  tags = {
    Name        = "${local.name}-alb"
    Environment = terraform.workspace
  }
}

resource "aws_lb_target_group" "this" {
  #checkov:skip=CKV_AWS_378:Los contenedores backend corren servidores HTTP en Fargate.
  for_each    = toset(var.microservices)
  name        = "${local.name}-tg-${each.key}"
  port        = var.container_port
  protocol    = "HTTP"
  vpc_id      = aws_vpc.this.id
  target_type = "ip"

  health_check {
    path                = "/health"
    protocol            = "HTTP" # Corregido a HTTP para coincidir con las tareas Express
    matcher             = "200"
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = {
    Name        = "${local.name}-tg-${each.key}"
    Environment = terraform.workspace
  }
}

# CRÍTICO: LISTENER HTTP AÑADIDO PARA CORREGIR LA REFERENCIA ROTA DEL CÓDIGO ORIGINAL
# (API GATEWAY VPC LINK Y LAS LISTENER RULES APUNTAN A ESTE LISTENER).
resource "aws_lb_listener" "http" {
  #checkov:skip=CKV_AWS_2:El ALB es interno y recibe trafico de API Gateway por puerto 80.
  #checkov:skip=CKV_AWS_103:El ALB es interno y la terminacion TLS se realiza en CloudFront o API Gateway.
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this[var.microservices[0]].arn
  }
}

resource "aws_lb_listener_rule" "this" {
  for_each     = toset(var.microservices)
  listener_arn = aws_lb_listener.http.arn
  priority     = index(var.microservices, each.key) + 1

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this[each.key].arn
  }
  condition {
    path_pattern {
      values = ["/${each.key}/*"]
    }
  }
}
