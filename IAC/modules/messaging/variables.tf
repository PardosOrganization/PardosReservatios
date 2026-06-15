variable "project" {
  type = string
}

variable "env" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "redis_sg_id" {
  type = string
}

variable "kms_key_arn" {
  description = "ARN de la clave KMS del proyecto (creada en modules/data)."
  type        = string
}
