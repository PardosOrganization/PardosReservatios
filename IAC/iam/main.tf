# ─────────────────────────────────────────────────────────────────────────
# IAM — Mínimo privilegio por capa.
#
# Se separan ESTRICTAMENTE dos planos:
#   1) PROVISIONING: roles que Terraform/CI-CD asumen para crear infraestructura.
#      -> Sin permisos de borrado crítico (rds:DeleteDBCluster, kms:ScheduleKeyDeletion).
#   2) RUNTIME: roles que asumen ECS (execution/task) y el RDS Proxy en ejecución.
#      -> Los microservicios NO tienen rds:* directo; acceden vía RDS Proxy.
# ─────────────────────────────────────────────────────────────────────────

locals {
  tpl_vars = {
    project    = var.project
    region     = var.region
    account_id = var.account_id
  }

  provisioning_layers = [
    "edge",
    "frontend",
    "cicd",
    "compute",
    "messaging",
    "data",
    "observability",
  ]
}

# ===========================================================================
# PLANO 1 — PROVISIONING (un rol Terraform por capa, política desde JSON)
# ===========================================================================
data "aws_iam_policy_document" "terraform_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${var.account_id}:root"]
    }
  }
}

resource "aws_iam_role" "terraform" {
  for_each           = toset(local.provisioning_layers)
  name               = "${var.project}-terraform-${each.key}"
  assume_role_policy = data.aws_iam_policy_document.terraform_assume.json
  tags               = { Plane = "provisioning", Layer = each.key }
}

resource "aws_iam_policy" "terraform" {
  for_each = toset(local.provisioning_layers)
  name     = "${var.project}-terraform-${each.key}"
  policy   = templatefile("${path.module}/policies/provisioning/${each.key}.json", local.tpl_vars)
}

resource "aws_iam_role_policy_attachment" "terraform" {
  for_each   = toset(local.provisioning_layers)
  role       = aws_iam_role.terraform[each.key].name
  policy_arn = aws_iam_policy.terraform[each.key].arn
}

# ===========================================================================
# PLANO 2 — RUNTIME
# ===========================================================================

# --- ECS Task Execution Role (arranca el contenedor) ---
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
  name               = "PardosECSExecutionRole"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
  tags               = { Plane = "runtime" }
}

resource "aws_iam_policy" "ecs_execution" {
  name   = "PardosECSExecutionPolicy"
  policy = templatefile("${path.module}/policies/runtime/ecs-execution.json", local.tpl_vars)
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = aws_iam_policy.ecs_execution.arn
}

# --- ECS Task Role (runtime del microservicio: SQS/SNS/X-Ray, sin rds:*) ---
resource "aws_iam_role" "ecs_task" {
  name               = "PardosECSTaskRole"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
  tags               = { Plane = "runtime" }
}

resource "aws_iam_policy" "ecs_task" {
  name   = "PardosECSTaskPolicy"
  policy = templatefile("${path.module}/policies/runtime/ecs-task.json", local.tpl_vars)
}

resource "aws_iam_role_policy_attachment" "ecs_task" {
  role       = aws_iam_role.ecs_task.name
  policy_arn = aws_iam_policy.ecs_task.arn
}

# --- RDS Proxy Role (lee credenciales de Secrets Manager + KMS Decrypt) ---
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
  name               = "PardosRDSProxyRole"
  assume_role_policy = data.aws_iam_policy_document.rds_proxy_assume.json
  tags               = { Plane = "runtime" }
}

resource "aws_iam_policy" "rds_proxy" {
  name   = "PardosRDSProxyPolicy"
  policy = templatefile("${path.module}/policies/runtime/rds-proxy.json", local.tpl_vars)
}

resource "aws_iam_role_policy_attachment" "rds_proxy" {
  role       = aws_iam_role.rds_proxy.name
  policy_arn = aws_iam_policy.rds_proxy.arn
}
