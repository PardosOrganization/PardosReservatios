resource "aws_sns_topic" "notificaciones" {
  name              = "${local.name}-notificaciones"
  kms_master_key_id = aws_kms_key.this.arn
  tags = {
    Name        = "${local.name}-notificaciones"
    Environment = terraform.workspace
  }
}

data "aws_iam_policy_document" "sns_notificaciones" {
  statement {
    sid       = "AllowS3Publish"
    actions   = ["SNS:Publish"]
    resources = [aws_sns_topic.notificaciones.arn]
    principals {
      type        = "Service"
      identifiers = ["s3.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [var.account_id]
    }
    condition {
      test     = "ArnLike"
      variable = "aws:SourceArn"
      values   = [for b in aws_s3_bucket.frontend : b.arn]
    }
  }
}

resource "aws_sns_topic_policy" "notificaciones" {
  arn    = aws_sns_topic.notificaciones.arn
  policy = data.aws_iam_policy_document.sns_notificaciones.json
}
