# Estado remoto en S3 con bloqueo de concurrencia en DynamoDB.
#
# El bucket y la tabla deben existir ANTES del primer `terraform init`
# (paso manual descrito en README.md). El backend de Terraform no admite
# variables, por lo que los valores se pasan con -backend-config o se
# fijan aquí directamente.
#
#   terraform init \
#     -backend-config="bucket=pardos-tfstate" \
#     -backend-config="key=prod/terraform.tfstate" \
#     -backend-config="dynamodb_table=pardos-tflock" \
#     -backend-config="region=us-east-1"

terraform {
  backend "s3" {
    bucket         = "pardos-tfstate"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "pardos-tflock"
    encrypt        = true
  }
}
