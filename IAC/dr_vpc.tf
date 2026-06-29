#####################################################################
# RED DE LA REGIÓN DR (us-west-2) — WARM STANDBY PARA FAILOVER DE ROUTE 53
#
# A diferencia de la VPC primaria (100% privada, detrás de API Gateway),
# aquí el ALB de DR debe ser accesible públicamente para que el health
# check de Route 53 pueda conmutar el dominio. Por eso las subnets tienen
# ruta directa a un Internet Gateway (sin NAT Gateway, para mantener el
# costo del warm standby bajo: las tareas de ECS usan IP pública propia).
#####################################################################

resource "aws_vpc" "dr" {
  #checkov:skip=CKV2_AWS_12: El default security group de la region DR se restringe en su respectivo bloque condicional.
  #checkov:skip=CKV2_AWS_11: El log de flujo de la region DR se habilita de forma condicional en aws_flow_log.dr.
  count                = var.enable_dr_region ? 1 : 0
  provider             = aws.us_west_2
  cidr_block           = var.vpc_cidr_dr
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags = {
    Name        = "${local.name}-dr-vpc"
    Environment = terraform.workspace
  }
}

resource "aws_internet_gateway" "dr" {
  count    = var.enable_dr_region ? 1 : 0
  provider = aws.us_west_2
  vpc_id   = aws_vpc.dr[0].id
  tags = {
    Name        = "${local.name}-dr-igw"
    Environment = terraform.workspace
  }
}

resource "aws_subnet" "dr_public" {
  count                   = var.enable_dr_region ? length(var.azs_dr) : 0
  provider                = aws.us_west_2
  vpc_id                  = aws_vpc.dr[0].id
  cidr_block              = cidrsubnet(var.vpc_cidr_dr, 4, count.index)
  availability_zone       = var.azs_dr[count.index]
  map_public_ip_on_launch = false # las tareas ECS piden IP publica explicitamente, no por defecto en la subnet
  tags = {
    Name        = "${local.name}-dr-public-${var.azs_dr[count.index]}"
    Environment = terraform.workspace
    Tier        = "public"
  }
}

resource "aws_route_table" "dr_public" {
  count    = var.enable_dr_region ? 1 : 0
  provider = aws.us_west_2
  vpc_id   = aws_vpc.dr[0].id
  tags = {
    Name        = "${local.name}-dr-rt-public"
    Environment = terraform.workspace
  }
}

resource "aws_route" "dr_public_internet" {
  count                  = var.enable_dr_region ? 1 : 0
  provider               = aws.us_west_2
  route_table_id         = aws_route_table.dr_public[0].id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.dr[0].id
}

resource "aws_route_table_association" "dr_public" {
  count          = var.enable_dr_region ? length(aws_subnet.dr_public) : 0
  provider       = aws.us_west_2
  subnet_id      = aws_subnet.dr_public[count.index].id
  route_table_id = aws_route_table.dr_public[0].id
}

resource "aws_security_group" "dr_alb" {
  #checkov:skip=CKV_AWS_260:El ALB es publico para failover DNS y requiere ingress HTTP/HTTPS.
  #checkov:skip=CKV2_AWS_5:El SG se asocia al ALB de contingencia en dr_alb.tf.
  count       = var.enable_dr_region ? 1 : 0
  provider    = aws.us_west_2
  name_prefix = "${local.name}-dr-alb-"
  vpc_id      = aws_vpc.dr[0].id
  description = "ALB DR (us-west-2): endpoint publico del failover de Route 53"

  ingress {
    description = "Permitir HTTPS publico"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    description = "Permitir HTTP publico para redireccion"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    description = "Salida permitida hacia la VPC de DR"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [var.vpc_cidr_dr]
  }
  tags = {
    Name        = "${local.name}-dr-alb-sg"
    Environment = terraform.workspace
  }
}

resource "aws_security_group" "dr_ecs" {
  #checkov:skip=CKV_AWS_382:Los contenedores de ECS requieren salida total a internet para descargar imagenes y Secrets Manager.
  #checkov:skip=CKV2_AWS_5:El SG se asocia a los servicios ECS de contingencia en dr_ecs.tf.
  count       = var.enable_dr_region ? 1 : 0
  provider    = aws.us_west_2
  name_prefix = "${local.name}-dr-ecs-"
  vpc_id      = aws_vpc.dr[0].id
  description = "ECS Fargate DR: recibe del ALB DR"

  ingress {
    description     = "Permitir trafico HTTP de microservicios desde el ALB de DR"
    from_port       = var.container_port
    to_port         = var.container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.dr_alb[0].id]
  }
  egress {
    description = "Salida a internet para descargar imagenes de ECR y secretos"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = {
    Name        = "${local.name}-dr-ecs-sg"
    Environment = terraform.workspace
  }
}

resource "aws_default_security_group" "dr" {
  count    = var.enable_dr_region ? 1 : 0
  provider = aws.us_west_2
  vpc_id   = aws_vpc.dr[0].id
  tags = {
    Name        = "${local.name}-dr-default-sg-restringido"
    Environment = terraform.workspace
  }
}

resource "aws_flow_log" "dr" {
  count           = var.enable_dr_region ? 1 : 0
  provider        = aws.us_west_2
  vpc_id          = aws_vpc.dr[0].id
  traffic_type    = "ALL"
  iam_role_arn    = aws_iam_role.flow.arn
  log_destination = aws_cloudwatch_log_group.dr_flow[0].arn
  tags = {
    Name        = "${local.name}-dr-vpc-flow-log"
    Environment = terraform.workspace
  }
}

resource "aws_cloudwatch_log_group" "dr_flow" {
  #checkov:skip=CKV_AWS_158:Los logs de flujo de VPC de contingencia en Oregon no requieren cifrado con KMS CMK personalizado en desarrollo.
  count             = var.enable_dr_region ? 1 : 0
  provider          = aws.us_west_2
  name              = "/${local.name}/dr/vpc/flow-logs"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.replica.arn   # CKV_AWS_158: CMK us-west-2, política AllowCloudWatchLogsDR
}

resource "aws_security_group" "dr_aurora" {
  #checkov:skip=CKV2_AWS_5:El SG se asocia al cluster de base de datos de contingencia en dr_rds.tf.
  count       = var.enable_dr_region ? 1 : 0
  provider    = aws.us_west_2
  name_prefix = "${local.name}-dr-aurora-"
  vpc_id      = aws_vpc.dr[0].id
  description = "Aurora secundario (Global Database): solo desde ECS DR"

  ingress {
    description     = "Permitir PostgreSQL desde contenedores de ECS en DR"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.dr_ecs[0].id]
  }
  egress {
    description = "Salida permitida hacia la VPC de DR"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [var.vpc_cidr_dr]
  }
  tags = {
    Name        = "${local.name}-dr-aurora-sg"
    Environment = terraform.workspace
  }
}
