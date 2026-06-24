

locals {
  name = "${var.project}-${var.env}"
}

#   AWS ECR
resource "aws_ecr_repository" "this" {
  for_each             = toset(var.microservices)
  name                 = "${var.project}-svc-${each.key}"
  image_tag_mutability = "IMMUTABLE"              # TAGS NO SOBREESCRIBIBLES

  image_scanning_configuration {
    scan_on_push = true                           # ESCANEO AUTOMÁTICO
  }
  encryption_configuration {
    encryption_type = "KMS"                       # CIFRADO KMS
    kms_key         = var.kms_key_arn
  }
}
