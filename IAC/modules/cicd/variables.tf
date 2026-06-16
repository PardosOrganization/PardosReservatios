variable "project" {
  type = string
}

variable "env" {
  type = string
}

variable "microservices" {
  type = list(string)
}

variable "kms_key_arn" {
  description = "ARN de la clave KMS del proyecto para cifrar ECR y artefactos de CodeBuild."
  type        = string
}