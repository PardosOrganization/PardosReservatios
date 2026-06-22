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