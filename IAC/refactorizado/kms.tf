resource "aws_kms_key" "this" {
  description             = "Clave maestra del proyecto ${var.project}"
  enable_key_rotation     = true
  deletion_window_in_days = 30

  # CRÍTICO: POLÍTICA BASADA EN LA CUENTA REAL VIA DATA SOURCE (NO HARDCODEAR ACCOUNT ID).
  policy = jsonencode({
    Version = "2012-10-17"
    Id      = "default"
    Statement = [
      {
        Sid       = "DefaultAllow"
        Effect    = "Allow"
        Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }
        Action    = "kms:*"
        Resource  = "*"
      }
    ]
  })

  tags = {
    Name        = "${local.name}-kms"
    Environment = terraform.workspace
  }
}

resource "aws_kms_alias" "this" {
  name          = "alias/${local.name}-key"
  target_key_id = aws_kms_key.this.key_id
}

resource "aws_kms_key" "flow" {
  description             = "CMK para VPC Flow Logs de ${local.name}"
  enable_key_rotation     = true
  deletion_window_in_days = 7

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "EnableRootPermissions"
        Effect    = "Allow"
        Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }
        Action    = "kms:*"
        Resource  = "*"
      },
      {
        Sid       = "AllowCloudWatchLogs"
        Effect    = "Allow"
        Principal = { Service = "logs.${data.aws_region.current.name}.amazonaws.com" }
        Action    = ["kms:Encrypt", "kms:Decrypt", "kms:ReEncrypt*", "kms:GenerateDataKey*", "kms:Describe*"]
        Resource  = "*"
      }
    ]
  })

  tags = {
    Name        = "${local.name}-flow-kms"
    Environment = terraform.workspace
  }
}

resource "aws_kms_key" "logs" {
  provider                = aws.us_east_1
  description             = "CMK logs WAF/Route53 ${local.name}"
  enable_key_rotation     = true
  deletion_window_in_days = 7

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "Root"
        Effect    = "Allow"
        Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }
        Action    = "kms:*"
        Resource  = "*"
      },
      {
        Sid       = "CloudWatchLogs"
        Effect    = "Allow"
        Principal = { Service = "logs.${data.aws_region.us_east_1.name}.amazonaws.com" }
        Action    = ["kms:Encrypt", "kms:Decrypt", "kms:ReEncrypt*", "kms:GenerateDataKey*", "kms:Describe*"]
        Resource  = "*"
      }
    ]
  })

  tags = {
    Name        = "${local.name}-logs-kms"
    Environment = terraform.workspace
  }
}

resource "aws_kms_key" "dnssec" {
  provider = aws.us_east_1
  #checkov:skip=CKV_AWS_7:Las CMK asimetricas (ECC) para DNSSEC no soportan rotacion automatica
  description              = "Clave KSK para firmar DNSSEC de ${var.domain}"
  customer_master_key_spec = "ECC_NIST_P256"
  key_usage                = "SIGN_VERIFY"
  deletion_window_in_days  = 7

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowAccountAdmin"
        Effect    = "Allow"
        Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }
        Action    = "kms:*"
        Resource  = "*"
      },
      {
        Sid       = "AllowRoute53DNSSECService"
        Effect    = "Allow"
        Principal = { Service = "dnssec-route53.amazonaws.com" }
        Action    = ["kms:DescribeKey", "kms:GetPublicKey", "kms:Sign"]
        Resource  = "*"
      },
      {
        Sid       = "AllowRoute53DNSSECGrant"
        Effect    = "Allow"
        Principal = { Service = "dnssec-route53.amazonaws.com" }
        Action    = "kms:CreateGrant"
        Resource  = "*"
        Condition = {
          Bool = { "kms:GrantIsForAWSResource" = "true" }
        }
      }
    ]
  })

  tags = {
    Name        = "${local.name}-dnssec-kms"
    Environment = terraform.workspace
  }
}
