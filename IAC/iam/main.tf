
locals {
  tpl_vars = {
    project    = var.project
    region     = var.region
    account_id = var.account_id
  }

  provisioning_layers = [
    "edge",
    "frontend",
    "compute",
    "messaging",
    "data",
    "observability",
  ]
}

data "aws_iam_policy_document" "terraform_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${var.account_id}:root"]
    }
  }
}

#   AWS IAM (PROVISIONING)
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

data "aws_iam_policy_document" "ecs_tasks_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

#   AWS IAM (ECS EXECUTION ROLE)
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

#   AWS IAM (ECS TASK ROLE)
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

#   AWS IAM (RDS PROXY ROLE)
data "aws_iam_policy_document" "rds_proxy_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["rds.amazonaws.com"]
    }
  }
}

#   AWS IAM (RDS PROXY ROLE)
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
