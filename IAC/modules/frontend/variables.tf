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
