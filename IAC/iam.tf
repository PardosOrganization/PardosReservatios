#####################################################################
# ECS EXECUTION ROLE (PULL ECR + LOGS + SECRETS AL ARRANCAR)
#####################################################################
data "aws_iam_policy_document" "ecs_tasks_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ecs_execution" {
  name               = "${local.name}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
  tags = {
    Name        = "${local.name}-ecs-execution"
    Environment = terraform.workspace
    Plane       = "runtime"
  }
}

data "aws_iam_policy_document" "ecs_execution" {
  # GetAuthorizationToken es a nivel de servicio: AWS no permite acotarlo por ARN.
  statement {
    sid       = "ECRAuthToken"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid       = "CloudWatchLogsContenedor"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["arn:aws:logs:${var.region}:${var.account_id}:log-group:/${local.name}/ecs/*:*"]
  }

  statement {
    sid = "ECRPullImagen"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchGetImage",
    ]
    resources = [for r in aws_ecr_repository.this : r.arn]
  }

  statement {
    sid     = "InyeccionSecretosArranque"
    actions = ["secretsmanager:GetSecretValue", "kms:Decrypt"]
    resources = [
      "arn:aws:secretsmanager:${var.region}:${var.account_id}:secret:${local.name}/*",
      "arn:aws:kms:${var.region}:${var.account_id}:key/*",
    ]
  }
}

resource "aws_iam_policy" "ecs_execution" {
  name   = "${local.name}-ecs-execution"
  policy = data.aws_iam_policy_document.ecs_execution.json
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = aws_iam_policy.ecs_execution.arn
}

#####################################################################
# ECS TASK ROLE (RUNTIME: SQS/SNS/X-RAY, SIN ACCESO DIRECTO A AURORA)
#####################################################################
resource "aws_iam_role" "ecs_task" {
  name               = "${local.name}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
  tags = {
    Name        = "${local.name}-ecs-task"
    Environment = terraform.workspace
    Plane       = "runtime"
  }
}

data "aws_iam_policy_document" "ecs_task" {
  statement {
    sid = "SQSReservas"
    actions = [
      "sqs:SendMessage",
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes",
    ]
    resources = [aws_sqs_queue.reservas.arn]
  }
  statement {
    sid       = "SNSNotificaciones"
    actions   = ["sns:Publish"]
    resources = [aws_sns_topic.notificaciones.arn]
  }
  statement {
    sid       = "XRayTrazas"
    actions   = ["xray:PutTraceSegments", "xray:PutTelemetryRecords"]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "ecs_task" {
  name   = "${local.name}-ecs-task"
  policy = data.aws_iam_policy_document.ecs_task.json
}

resource "aws_iam_role_policy_attachment" "ecs_task" {
  role       = aws_iam_role.ecs_task.name
  policy_arn = aws_iam_policy.ecs_task.arn
}

#####################################################################
# RDS PROXY ROLE (LEE CREDENCIALES EN SECRETS MANAGER)
#####################################################################
data "aws_iam_policy_document" "rds_proxy_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["rds.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "rds_proxy" {
  name               = "${local.name}-rds-proxy"
  assume_role_policy = data.aws_iam_policy_document.rds_proxy_assume.json
  tags = {
    Name        = "${local.name}-rds-proxy"
    Environment = terraform.workspace
    Plane       = "runtime"
  }
}

data "aws_iam_policy_document" "rds_proxy" {
  statement {
    sid       = "ProxySecretsAccess"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = ["arn:aws:secretsmanager:${var.region}:${var.account_id}:secret:${local.name}/rds-credentials-*"]
  }
  statement {
    sid       = "ProxyKMSDecrypt"
    actions   = ["kms:Decrypt"]
    resources = ["arn:aws:kms:${var.region}:${var.account_id}:key/*"]
    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["secretsmanager.${var.region}.amazonaws.com"]
    }
  }
}

resource "aws_iam_policy" "rds_proxy" {
  name   = "${local.name}-rds-proxy"
  policy = data.aws_iam_policy_document.rds_proxy.json
}

resource "aws_iam_role_policy_attachment" "rds_proxy" {
  role       = aws_iam_role.rds_proxy.name
  policy_arn = aws_iam_policy.rds_proxy.arn
}

#####################################################################
# S3 REPLICATION ROLE
# CRÍTICO: ESTE ROL FALTABA EN EL CÓDIGO ORIGINAL (iam/outputs.tf LO EXPONÍA SIN DEFINIRLO).
#####################################################################
data "aws_iam_policy_document" "s3_replication_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["s3.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "s3_replication" {
  name               = "${local.name}-s3-replication"
  assume_role_policy = data.aws_iam_policy_document.s3_replication_assume.json
  tags = {
    Name        = "${local.name}-s3-replication"
    Environment = terraform.workspace
    Plane       = "runtime"
  }
}

data "aws_iam_policy_document" "s3_replication" {
  statement {
    sid       = "SourceRead"
    actions   = ["s3:GetReplicationConfiguration", "s3:ListBucket"]
    resources = [for b in aws_s3_bucket.frontend : b.arn]
  }
  statement {
    sid = "SourceObjects"
    actions = [
      "s3:GetObjectVersionForReplication",
      "s3:GetObjectVersionAcl",
      "s3:GetObjectVersionTagging",
    ]
    resources = [for b in aws_s3_bucket.frontend : "${b.arn}/*"]
  }
  dynamic "statement" {
    # Solo se agregan estos permisos cuando la replicacion esta activa: con
    # var.enable_s3_replication=false no existen buckets/CMK destino y un
    # statement con "resources" vacio es rechazado por la API de IAM.
    for_each = var.enable_s3_replication ? [1] : []
    content {
      sid = "DestinationWrite"
      actions = [
        "s3:ReplicateObject",
        "s3:ReplicateDelete",
        "s3:ReplicateTags",
      ]
      resources = [for b in aws_s3_bucket.frontend_replica : "${b.arn}/*"]
    }
  }
  dynamic "statement" {
    for_each = var.enable_s3_replication ? [1] : []
    content {
      sid       = "SourceKmsDecrypt"
      actions   = ["kms:Decrypt"]
      resources = [aws_kms_key.this.arn]
    }
  }
  dynamic "statement" {
    for_each = var.enable_s3_replication ? [1] : []
    content {
      sid       = "DestinationKmsEncrypt"
      actions   = ["kms:Encrypt", "kms:GenerateDataKey*"]
      resources = [aws_kms_key.replica.arn]
    }
  }
}

resource "aws_iam_policy" "s3_replication" {
  name   = "${local.name}-s3-replication"
  policy = data.aws_iam_policy_document.s3_replication.json
}

resource "aws_iam_role_policy_attachment" "s3_replication" {
  role       = aws_iam_role.s3_replication.name
  policy_arn = aws_iam_policy.s3_replication.arn
}

#####################################################################
# AWS BACKUP ROLE
#####################################################################
data "aws_iam_policy_document" "backup_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["backup.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "backup" {
  name               = "${local.name}-backup"
  assume_role_policy = data.aws_iam_policy_document.backup_assume.json
  tags = {
    Name        = "${local.name}-backup"
    Environment = terraform.workspace
    Plane       = "runtime"
  }
}

resource "aws_iam_role_policy_attachment" "backup" {
  role       = aws_iam_role.backup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup"
}

#####################################################################
# VPC FLOW LOGS ROLE
#####################################################################
data "aws_iam_policy_document" "flow_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["vpc-flow-logs.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "flow" {
  name               = "${local.name}-vpc-flow-logs"
  assume_role_policy = data.aws_iam_policy_document.flow_assume.json
  tags = {
    Name        = "${local.name}-vpc-flow-logs"
    Environment = terraform.workspace
    Plane       = "runtime"
  }
}

data "aws_iam_policy_document" "flow" {
  statement {
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogStreams"]
    resources = ["${aws_cloudwatch_log_group.flow.arn}:*"]
  }
}

resource "aws_iam_role_policy" "flow" {
  name   = "${local.name}-vpc-flow-logs"
  role   = aws_iam_role.flow.id
  policy = data.aws_iam_policy_document.flow.json
}
