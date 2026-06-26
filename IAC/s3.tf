#####################################################################
# BUCKETS DE FRONTEND (LANDING + RESERVAS + EMPLEADOS)
#####################################################################

resource "aws_s3_bucket" "frontend" {
  for_each = local.frontend_buckets
  bucket   = each.value
  tags = {
    Name        = each.value
    Environment = terraform.workspace
  }
}



resource "aws_s3_bucket_public_access_block" "frontend" {
  for_each                = aws_s3_bucket.frontend
  bucket                  = each.value.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "frontend" {
  for_each = local.frontend_buckets
  bucket   = aws_s3_bucket.frontend[each.key].id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "frontend" {
  for_each = local.frontend_buckets
  bucket   = aws_s3_bucket.frontend[each.key].id
  rule {
     apply_server_side_encryption_by_default {
       kms_master_key_id = aws_kms_key.this.arn
       sse_algorithm     = "aws:kms"
     }
 }
}

data "aws_iam_policy_document" "frontend_oac" {
  for_each = aws_s3_bucket.frontend
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
      values   = [aws_cloudfront_distribution.this.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "frontend" {
  for_each = aws_s3_bucket.frontend
  bucket   = each.value.id
  policy   = data.aws_iam_policy_document.frontend_oac[each.key].json
}

resource "aws_s3_bucket_logging" "frontend" {
  for_each      = aws_s3_bucket.frontend
  bucket        = each.value.id
  target_bucket = each.value.id
  target_prefix = "access-logs/"
}

resource "aws_s3_bucket_lifecycle_configuration" "frontend" {
  for_each = local.frontend_buckets
  bucket   = aws_s3_bucket.frontend[each.key].id

  rule {
    id     = "expire-versiones-antiguas"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 90
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

resource "aws_s3_bucket_notification" "frontend" {
  for_each = aws_s3_bucket.frontend
  bucket   = each.value.id

  topic {
    topic_arn = aws_sns_topic.notificaciones.arn
    events    = ["s3:ObjectCreated:*", "s3:ObjectRemoved:*"]
  }
}

# CRÍTICO: LA REPLICACIÓN REQUIERE QUE LOS BUCKETS DESTINO "<bucket>-replica" YA EXISTAN.
resource "aws_s3_bucket_replication_configuration" "frontend" {
  for_each = var.enable_s3_replication ? aws_s3_bucket.frontend : {}
  bucket   = each.value.id
  role     = aws_iam_role.s3_replication.arn

  rule {
    id     = "replicar-todo"
    status = "Enabled"

    destination {
      bucket        = "arn:aws:s3:::${each.value.bucket}-replica"
      storage_class = "STANDARD"
    }
  }

  depends_on = [aws_s3_bucket_versioning.frontend]
}

#####################################################################
# BUCKET DE ACCESS LOGS DEL ALB
#####################################################################
resource "aws_s3_bucket" "alb_logs" {
  #checkov:skip=CKV_AWS_18:El bucket de logs del ALB no puede loggearse a si mismo (loop).
  #checkov:skip=CKV_AWS_144:Replicacion cross-region no requerida para logs efimeros.
  #checkov:skip=CKV2_AWS_62:Bucket de solo escritura de logs, sin consumidor downstream.
  bucket        = "${local.name}-alb-logs-${data.aws_caller_identity.current.account_id}"
  force_destroy = false
  tags = {
    Name        = "${local.name}-alb-logs"
    Environment = terraform.workspace
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id
  rule {
    id     = "expire-alb-logs"
    status = "Enabled"
    filter {}
    expiration {
      days = 365
    }
    noncurrent_version_expiration {
      noncurrent_days = 30
    }
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

resource "aws_s3_bucket_versioning" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.this.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "alb_logs" {
  bucket                  = aws_s3_bucket.alb_logs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowELBLogs"
        Effect    = "Allow"
        Principal = { AWS = "arn:aws:iam::${local.elb_account_id}:root" }
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.alb_logs.arn}/AWSLogs/${data.aws_caller_identity.current.account_id}/*"
      }
    ]
  })
}

#####################################################################
# BUCKETS DE CLOUDFRONT (LOGS + FAILOVER)
#####################################################################
resource "aws_s3_bucket" "cf_logs" {
  #checkov:skip=CKV_AWS_18:El bucket de logs de CloudFront no se loggea a si mismo.
  #checkov:skip=CKV_AWS_144:No se requiere replicacion para logs.
  #checkov:skip=CKV2_AWS_62:No se requieren notificaciones.
  bucket        = "${local.name}-cf-logs-${data.aws_caller_identity.current.account_id}"
  force_destroy = false
  tags = {
    Name        = "${local.name}-cf-logs"
    Environment = terraform.workspace
  }
}

resource "aws_s3_bucket_public_access_block" "cf_logs" {
  bucket                  = aws_s3_bucket.cf_logs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "cf_logs" {
  bucket = aws_s3_bucket.cf_logs.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "cf_logs" {
  bucket = aws_s3_bucket.cf_logs.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "cf_logs" {
  bucket = aws_s3_bucket.cf_logs.id
  rule {
    id     = "expire-logs"
    status = "Enabled"
    filter {}
    expiration {
      days = 365
    }
    noncurrent_version_expiration {
      noncurrent_days = 30
    }
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

resource "aws_s3_bucket_ownership_controls" "cf_logs" {
  bucket = aws_s3_bucket.cf_logs.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket" "cf_failover" {
  #checkov:skip=CKV_AWS_18:El bucket de failover no requiere logs.
  #checkov:skip=CKV_AWS_144:No se requiere replicacion para failover.
  #checkov:skip=CKV2_AWS_62:No se requieren notificaciones.
  bucket        = "${local.name}-cf-failover-${data.aws_caller_identity.current.account_id}"
  force_destroy = false
  tags = {
    Name        = "${local.name}-cf-failover"
    Environment = terraform.workspace
  }
}

resource "aws_s3_bucket_public_access_block" "cf_failover" {
  bucket                  = aws_s3_bucket.cf_failover.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "cf_failover" {
  bucket = aws_s3_bucket.cf_failover.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "cf_failover" {
  bucket = aws_s3_bucket.cf_failover.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "cf_failover" {
  bucket = aws_s3_bucket.cf_failover.id
  rule {
    id     = "expire-failover"
    status = "Enabled"
    filter {}
    expiration {
      days = 365
    }
    noncurrent_version_expiration {
      noncurrent_days = 30
    }
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

resource "aws_s3_bucket_ownership_controls" "cf_failover" {
  bucket = aws_s3_bucket.cf_failover.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}
