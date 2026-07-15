resource "aws_kms_key" "rds" {
  description             = "Clave KMS exclusiva para la base de datos RDS del proyecto ${var.project}"
  enable_key_rotation     = true
  deletion_window_in_days = 30

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "DefaultAllow"
        Effect    = "Allow"
        Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }
        Action    = "kms:*"
        Resource  = "*"
      },
      {
        Sid       = "AllowRDS"
        Effect    = "Allow"
        Principal = { Service = "rds.amazonaws.com" }
        Action    = ["kms:Encrypt", "kms:Decrypt", "kms:ReEncrypt*", "kms:GenerateDataKey*", "kms:DescribeKey"]
        Resource  = "*"
      }
    ]
  })

  tags = {
    Name        = "${local.name}-rds-kms"
    Environment = terraform.workspace
  }
}

resource "aws_kms_alias" "rds" {
  name          = "alias/${local.name}-rds-key"
  target_key_id = aws_kms_key.rds.key_id
}

resource "aws_kms_key" "s3" {
  description             = "Clave KMS exclusiva para los buckets S3 y logs del proyecto ${var.project}"
  enable_key_rotation     = true
  deletion_window_in_days = 30

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "DefaultAllow"
        Effect    = "Allow"
        Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }
        Action    = "kms:*"
        Resource  = "*"
      },
      {
        Sid       = "AllowS3ForSNSNotifications"
        Effect    = "Allow"
        Principal = { Service = "s3.amazonaws.com" }
        Action    = ["kms:GenerateDataKey*", "kms:Decrypt"]
        Resource  = "*"
        Condition = {
          StringEquals = { "aws:SourceAccount" = data.aws_caller_identity.current.account_id }
        }
      },
      {
        Sid       = "AllowCloudWatchLogs"
        Effect    = "Allow"
        Principal = { Service = "logs.${var.region}.amazonaws.com" }
        Action    = ["kms:Encrypt", "kms:Decrypt", "kms:ReEncrypt*", "kms:GenerateDataKey*", "kms:Describe*"]
        Resource  = "*"
      },
      {
        Sid       = "AllowCloudFrontDecrypt"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = ["kms:Decrypt", "kms:GenerateDataKey*"]
        Resource  = "*"
        Condition = {
          ArnLike = {
            "aws:SourceArn" = "arn:aws:cloudfront::${data.aws_caller_identity.current.account_id}:distribution/*"
          }
        }
      }
    ]
  })

  tags = {
    Name        = "${local.name}-s3-kms"
    Environment = terraform.workspace
  }
}

resource "aws_kms_alias" "s3" {
  name          = "alias/${local.name}-s3-key"
  target_key_id = aws_kms_key.s3.key_id
}

resource "aws_kms_key" "secrets" {
  description             = "Clave KMS exclusiva para Secrets Manager del proyecto ${var.project}"
  enable_key_rotation     = true
  deletion_window_in_days = 30

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "DefaultAllow"
        Effect    = "Allow"
        Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }
        Action    = "kms:*"
        Resource  = "*"
      },
      {
        Sid       = "AllowSecretsManager"
        Effect    = "Allow"
        Principal = { Service = "secretsmanager.amazonaws.com" }
        Action    = ["kms:Decrypt", "kms:GenerateDataKey*"]
        Resource  = "*"
      }
    ]
  })

  tags = {
    Name        = "${local.name}-secrets-kms"
    Environment = terraform.workspace
  }
}

resource "aws_kms_alias" "secrets" {
  name          = "alias/${local.name}-secrets-key"
  target_key_id = aws_kms_key.secrets.key_id
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

resource "aws_kms_key" "replica" {
  # KMS es un servicio regional: se necesita una CMK propia en la región destino (us-west-2)
  # para cifrar los buckets réplica de la replicación cross-region de S3.
  provider                = aws.us_west_2
  description             = "CMK para buckets replica (us-west-2) de ${local.name}"
  enable_key_rotation     = true
  deletion_window_in_days = 30

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
      },
      {
        Sid       = "AllowS3ReplicationRole"
        Effect    = "Allow"
        Principal = { AWS = aws_iam_role.s3_replication.arn }
        Action    = ["kms:Encrypt", "kms:GenerateDataKey*"]
        Resource  = "*"
      },
      {
        # Reutilizada para cifrar el log group y el Aurora secundario del
        # stack DR en us-west-2 (warm standby de failover).
        Sid       = "AllowCloudWatchLogsDR"
        Effect    = "Allow"
        Principal = { Service = "logs.us-west-2.amazonaws.com" }
        Action    = ["kms:Encrypt", "kms:Decrypt", "kms:ReEncrypt*", "kms:GenerateDataKey*", "kms:Describe*"]
        Resource  = "*"
      }
    ]
  })

  tags = {
    Name        = "${local.name}-replica-kms"
    Environment = terraform.workspace
  }
}

resource "aws_kms_alias" "replica" {
  provider      = aws.us_west_2
  name          = "alias/${local.name}-replica-key"
  target_key_id = aws_kms_key.replica.key_id
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
