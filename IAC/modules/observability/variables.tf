variable "project" {
  type = string
}

variable "env" {
  type = string
}

variable "region" {
  type = string
}

variable "microservices" {
  type = list(string)
}

variable "alb_arn_suffix" {
  type = string
}

variable "ecs_cluster_name" {
  type = string
}

variable "sns_topic_arn" {
  description = "Topic SNS destino de las alarmas SLA."
  type        = string
}

variable "log_retention_days" {
  type    = number
  default = 30
}

variable "kms_key_arn" {
  description = "ARN de la clave KMS para cifrar los Log Groups de CloudWatch."
  type        = string
}