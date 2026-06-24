# CAPA 3 — CI/CD: ECR (GitHub Actions se encarga del build y deploy).

locals {
  name = "${var.project}-${var.env}"
}

# ── ECR: un repositorio por microservicio (pardos-svc-mozo, etc.) ──
resource "aws_ecr_repository" "this" {
  for_each             = toset(var.microservices)
  name                 = "${var.project}-svc-${each.key}"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = var.kms_key_arn
  }
}
