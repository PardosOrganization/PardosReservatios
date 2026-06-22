# VPC con 2 AZs y subredes privadas (us-east-1a / us-east-1b del diagrama).

locals {
  name = "${var.project}-${var.env}"
}

resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = { Name = "${local.name}-vpc" }
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = "${local.name}-igw" }
}

# Subredes privadas, una por AZ. Alojan ECS, ElastiCache, Aurora y RDS Proxy.
resource "aws_subnet" "private" {
  count             = length(var.azs)
  vpc_id            = aws_vpc.this.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index)
  availability_zone = var.azs[count.index]
  tags              = { Name = "${local.name}-private-${var.azs[count.index]}", Tier = "private" }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = "${local.name}-rt-private" }
}

resource "aws_route_table_association" "private" {
  count          = length(aws_subnet.private)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# ── Security Groups por componente ──

resource "aws_security_group" "alb" {
  #checkov:skip=CKV2_AWS_5:El SG se asocia al ALB en el modulo compute via output alb_sg_id
  name_prefix = "${local.name}-alb-"
  vpc_id      = aws_vpc.this.id
  description = "ALB: recibe trafico del VPC Link"

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }
  ingress {
    description = "HTTP redirige a HTTPS"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }
  egress {
    description = "Salida permitida hacia la VPC"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [var.vpc_cidr]
  }
  tags = { Name = "${local.name}-alb-sg" }
}

resource "aws_security_group" "ecs" {
  #checkov:skip=CKV2_AWS_5:El SG se asocia a ECS Fargate en el modulo compute via output ecs_sg_id
  name_prefix = "${local.name}-ecs-"
  vpc_id      = aws_vpc.this.id
  description = "ECS Fargate: recibe del ALB"

  ingress {
    description     = "Trafico del ALB"
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    description = "Salida permitida hacia la VPC"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [var.vpc_cidr]
  }
  tags = { Name = "${local.name}-ecs-sg" }
}

resource "aws_security_group" "proxy" {
  #checkov:skip=CKV2_AWS_5:El SG se asocia al RDS Proxy en el modulo data via output proxy_sg_id
  name_prefix = "${local.name}-proxy-"
  vpc_id      = aws_vpc.this.id
  description = "RDS Proxy: solo desde ECS"

  ingress {
    description     = "PostgreSQL desde ECS"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }
  egress {
    description = "Salida permitida hacia la VPC"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [var.vpc_cidr]
  }
  tags = { Name = "${local.name}-proxy-sg" }
}

resource "aws_security_group" "aurora" {
  #checkov:skip=CKV2_AWS_5:El SG se asocia al cluster Aurora en el modulo data via output aurora_sg_id
  name_prefix = "${local.name}-aurora-"
  vpc_id      = aws_vpc.this.id
  description = "Aurora: solo desde RDS Proxy"

  ingress {
    description     = "PostgreSQL desde RDS Proxy"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.proxy.id]
  }
  egress {
    description = "Salida permitida hacia la VPC"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [var.vpc_cidr]
  }
  tags = { Name = "${local.name}-aurora-sg" }
}

resource "aws_security_group" "redis" {
  #checkov:skip=CKV2_AWS_5:El SG se asocia a ElastiCache en el modulo messaging via output redis_sg_id
  name_prefix = "${local.name}-redis-"
  vpc_id      = aws_vpc.this.id
  description = "ElastiCache Redis: solo desde ECS"

  ingress {
    description     = "Redis desde ECS"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }
  egress {
    description = "Salida permitida hacia la VPC"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [var.vpc_cidr]
  }
  tags = { Name = "${local.name}-redis-sg" }
}

#(CKV2_AWS_12)
resource "aws_default_security_group" "default" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = "${local.name}-default-sg-restringido" }
}

#VPC Flow Logs (CKV2_AWS_11)
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

#(CKV_AWS_158 / CKV_AWS_7)
resource "aws_kms_key" "flow" {
  description             = "CMK para VPC Flow Logs de ${local.name}"
  enable_key_rotation     = true
  deletion_window_in_days = 7

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "EnableRootPermissions"
        Effect    = "Allow"
        Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }
        Action    = "kms:*"
        Resource  = "*"
      },
      {
        Sid       = "AllowCloudWatchLogs"
        Effect    = "Allow"
        Principal = { Service = "logs.${data.aws_region.current.name}.amazonaws.com" }
        Action    = ["kms:Encrypt", "kms:Decrypt", "kms:ReEncrypt*", "kms:GenerateDataKey*", "kms:Describe*"]
        Resource  = "*"
      }
    ]
  })
}

#(CKV_AWS_66 / 158 / 338)
resource "aws_cloudwatch_log_group" "flow" {
  name              = "/${var.project}/vpc/flow-logs"
  retention_in_days = 365
  kms_key_id        = aws_kms_key.flow.arn
}

#(CKV_AWS_60)
resource "aws_iam_role" "flow" {
  name = "${local.name}-vpc-flow-logs"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "vpc-flow-logs.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "flow" {
  name = "${local.name}-vpc-flow-logs"
  role = aws_iam_role.flow.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogStreams"]
      Resource = "${aws_cloudwatch_log_group.flow.arn}:*"
    }]
  })
}

# Flow Log de la VPC (CKV2_AWS_11)
resource "aws_flow_log" "this" {
  vpc_id          = aws_vpc.this.id
  traffic_type    = "ALL"
  iam_role_arn    = aws_iam_role.flow.arn
  log_destination = aws_cloudwatch_log_group.flow.arn
  tags            = { Name = "${local.name}-vpc-flow-log" }
}