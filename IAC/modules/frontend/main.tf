

locals {
  buckets = {
    frontend  = "${var.project}-frontend-${var.env}"
    empleados = "${var.project}-empleados-${var.env}"
  }
}

#   AWS S3 (FRONTEND)
resource "aws_s3_bucket" "this" {
  for_each = local.buckets
  bucket   = each.value
}

resource "aws_s3_bucket_public_access_block" "this" {
  for_each                = aws_s3_bucket.this
  bucket                  = each.value.id
  block_public_acls       = true                # BLOQUEA ACL PÚBLICAS
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "this" {
  for_each = aws_s3_bucket.this
  bucket   = each.value.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  for_each = aws_s3_bucket.this
  bucket   = each.value.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"             # CIFRADO KMS
      kms_master_key_id = var.kms_key_arn
    }
  }
}

#   AWS IAM POLICY (CLOUDFRONT OAC)
# Politica de bucket: solo CloudFront (OAC) puede leer.
data "aws_iam_policy_document" "oac" {
  for_each = aws_s3_bucket.this
  statement {
    sid       = "AllowCloudFrontOAC"
    actions   = ["s3:GetObject"]
    resources = ["${each.value.arn}/*"]
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [var.cloudfront_arn]
    }
  }
}

resource "aws_s3_bucket_policy" "this" {
  for_each = aws_s3_bucket.this
  bucket   = each.value.id
  policy   = data.aws_iam_policy_document.oac[each.key].json
}

# CKV_AWS_18 — Access logging habilitado
resource "aws_s3_bucket_logging" "this" {
  for_each      = aws_s3_bucket.this
  bucket        = each.value.id
  target_bucket = each.value.id
  target_prefix = "access-logs/"
}

#   AWS S3 REPLICATION
# CKV_AWS_144 — Cross-region replication
resource "aws_s3_bucket_replication_configuration" "this" {
  for_each = aws_s3_bucket.this
  bucket   = each.value.id
  role     = var.replication_role_arn

  rule {
    id     = "replicar-todo"
    status = "Enabled"

    destination {
      bucket        = "arn:aws:s3:::${each.value.bucket}-replica"
      storage_class = "STANDARD"
    }
  }

  depends_on = [aws_s3_bucket_versioning.this]
}

# CKV2_AWS_61 — Lifecycle configuration
resource "aws_s3_bucket_lifecycle_configuration" "this" {
  for_each = aws_s3_bucket.this
  bucket   = each.value.id

  rule {
    id     = "expire-versiones-antiguas"
    status = "Enabled"

    noncurrent_version_expiration {
      noncurrent_days = 90                      # EXPIRA EN 90 DÍAS
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

#   AWS S3 NOTIFICATIONS
# CKV2_AWS_62 — Event notifications
resource "aws_s3_bucket_notification" "this" {
  for_each = aws_s3_bucket.this
  bucket   = each.value.id

  topic {
    topic_arn = var.sns_topic_arn
    events    = ["s3:ObjectCreated:*", "s3:ObjectRemoved:*"]
  }
}