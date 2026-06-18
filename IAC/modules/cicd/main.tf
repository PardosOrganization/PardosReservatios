# CAPA 3 — CI/CD: ECR, CodeBuild, CodeDeploy, CodePipeline.

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

resource "aws_cloudwatch_log_group" "codebuild" {
  name              = "/${var.project}/codebuild"
  retention_in_days = 365
  kms_key_id        = var.kms_key_arn # CKV_AWS_158: encrypt log group with CMK
}

# ── CodeBuild: tests de integracion + SAST ──
resource "aws_codebuild_project" "this" {
  name           = "${var.project}-build"
  service_role   = aws_iam_role.codebuild.arn
  encryption_key = var.kms_key_arn      # CKV_AWS_147

  artifacts {
    type = "CODEPIPELINE"
  }
  environment {
    compute_type    = "BUILD_GENERAL1_SMALL"
    image           = "aws/codebuild/amazonlinux2-x86_64-standard:5.0"
    type            = "LINUX_CONTAINER"
    privileged_mode = false             # CKV_AWS_316
  }
  logs_config {                         # CKV_AWS_314
    cloudwatch_logs {
      group_name = aws_cloudwatch_log_group.codebuild.name
    }
  }
  source {
    type = "CODEPIPELINE"
  }
}

resource "aws_iam_role" "codebuild" {
  name = "${var.project}-codebuild-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "codebuild.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# ── CodeDeploy: despliegue Blue/Green sobre ECS ──
resource "aws_codedeploy_app" "this" {
  name             = "${var.project}-app"
  compute_platform = "ECS"
}

resource "aws_iam_role" "codedeploy" {
  name = "${var.project}-codedeploy-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "codedeploy.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "codedeploy" {
  role       = aws_iam_role.codedeploy.name
  policy_arn = "arn:aws:iam::aws:policy/AWSCodeDeployRoleForECS"
}
