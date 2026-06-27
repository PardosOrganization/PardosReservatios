#####################################################################
# REPLICACIÓN DE ECR HACIA us-west-2 (PARA QUE ECS DR PUEDA HACER PULL
# LOCAL DE LAS IMÁGENES SIN DEPENDER DE QUE us-east-1 ESTÉ DISPONIBLE)
#####################################################################

resource "aws_ecr_replication_configuration" "this" {
  count = var.enable_dr_region ? 1 : 0

  replication_configuration {
    rule {
      destination {
        region      = local.dr_region
        registry_id = data.aws_caller_identity.current.account_id
      }
    }
  }
}
