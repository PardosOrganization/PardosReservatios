variable "project" {
  type = string
}

variable "env" {
  type = string
}

variable "kms_key_arn" {
  type = string
}

variable "cloudfront_arn" {
  description = "ARN de la distribucion CloudFront autorizada a leer el bucket (OAC)."
  type        = string
}

variable "cloudfront_oac_id" {
  type = string
}

variable "sns_topic_arn" {
  description = "ARN del topic SNS para notificaciones de eventos S3."
  type        = string
}

variable "replication_role_arn" {
  description = "ARN del rol IAM con permisos para replicar objetos S3."
  type        = string
}