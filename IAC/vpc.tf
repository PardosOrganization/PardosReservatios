resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags = {
    Name        = "${local.name}-vpc"
    Environment = terraform.workspace
  }
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags = {
    Name        = "${local.name}-igw"
    Environment = terraform.workspace
  }
}

resource "aws_subnet" "private" {
  count             = length(var.azs)
  vpc_id            = aws_vpc.this.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index)
  availability_zone = var.azs[count.index]
  tags = {
    Name        = "${local.name}-private-${var.azs[count.index]}"
    Environment = terraform.workspace
    Tier        = "private"
  }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.this.id
  tags = {
    Name        = "${local.name}-rt-private"
    Environment = terraform.workspace
  }
}

resource "aws_route_table_association" "private" {
  count          = length(aws_subnet.private)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

resource "aws_security_group" "alb" {
  #checkov:skip=CKV2_AWS_5:El SG se asocia al ALB en alb.tf
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
  tags = {
    Name        = "${local.name}-alb-sg"
    Environment = terraform.workspace
  }
}

resource "aws_security_group" "ecs" {
  #checkov:skip=CKV2_AWS_5:El SG se asocia a ECS Fargate en ecs.tf
  name_prefix = "${local.name}-ecs-"
  vpc_id      = aws_vpc.this.id
  description = "ECS Fargate: recibe del ALB"

  ingress {
    description     = "Trafico del ALB"
    from_port       = var.container_port
    to_port         = var.container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    description = "Salida permitida hacia Internet (ECR, Secrets Manager, etc)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = {
    Name        = "${local.name}-ecs-sg"
    Environment = terraform.workspace
  }
}

resource "aws_security_group" "proxy" {
  #checkov:skip=CKV2_AWS_5:El SG se asocia al RDS Proxy en rds.tf
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
  tags = {
    Name        = "${local.name}-proxy-sg"
    Environment = terraform.workspace
  }
}

resource "aws_security_group" "aurora" {
  #checkov:skip=CKV2_AWS_5:El SG se asocia al cluster Aurora en rds.tf
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
  tags = {
    Name        = "${local.name}-aurora-sg"
    Environment = terraform.workspace
  }
}

resource "aws_security_group" "redis" {
  #checkov:skip=CKV2_AWS_5:El SG se asocia a ElastiCache en elasticache.tf
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
  tags = {
    Name        = "${local.name}-redis-sg"
    Environment = terraform.workspace
  }
}

resource "aws_default_security_group" "default" {
  vpc_id = aws_vpc.this.id
  tags = {
    Name        = "${local.name}-default-sg-restringido"
    Environment = terraform.workspace
  }
}

resource "aws_flow_log" "this" {
  vpc_id          = aws_vpc.this.id
  traffic_type    = "ALL"
  iam_role_arn    = aws_iam_role.flow.arn
  log_destination = aws_cloudwatch_log_group.flow.arn
  tags = {
    Name        = "${local.name}-vpc-flow-log"
    Environment = terraform.workspace
  }
}

resource "aws_route" "internet" {
  route_table_id         = aws_route_table.private.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.this.id
}
