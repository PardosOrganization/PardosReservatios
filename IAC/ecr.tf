resource "aws_ecr_repository" "this" {
  for_each             = toset(var.microservices)
  name                 = "${local.name}-svc-${each.key}"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = aws_kms_key.s3.arn
  }

  tags = {
    Name        = "${local.name}-svc-${each.key}"
    Environment = terraform.workspace
  }
}

# Repositorio para la imagen de Loki con configuración S3 horneada
resource "aws_ecr_repository" "loki" {
  name                 = "${local.name}-loki"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = aws_kms_key.s3.arn
  }

  tags = {
    Name        = "${local.name}-loki"
    Environment = terraform.workspace
  }
}
