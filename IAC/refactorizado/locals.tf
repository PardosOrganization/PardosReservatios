locals {
  env  = terraform.workspace
  name = "${var.project}-${terraform.workspace}"

  elb_account_ids = {
    us-east-1      = "127311923021"
    us-east-2      = "033677994240"
    us-west-1      = "027434742980"
    us-west-2      = "797873946194"
    eu-west-1      = "156460612806"
    eu-central-1   = "054676820928"
    ap-southeast-1 = "114774131450"
    ap-northeast-1 = "582318560864"
    sa-east-1      = "507241528517"
  }
  elb_account_id = local.elb_account_ids[data.aws_region.current.name]

  frontend_buckets = {
    frontend  = "${var.project}-frontend-${terraform.workspace}"
    empleados = "${var.project}-empleados-${terraform.workspace}"
  }
}
