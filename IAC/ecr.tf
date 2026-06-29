resource "aws_ecr_repository" "this" {
  for_each             = toset(var.microservices)
  name                 = "${local.name}-svc-${each.key}"
  image_tag_mutability = "IMMUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = aws_kms_key.this.arn
  }

  tags = {
    Name        = "${local.name}-svc-${each.key}"
    Environment = terraform.workspace
  }
}
