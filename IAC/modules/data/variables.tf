variable "project" {
  type = string
}

variable "env" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "aurora_sg_id" {
  type = string
}

variable "proxy_sg_id" {
  type = string
}

variable "rds_proxy_role_arn" {
  description = "ARN del rol runtime PardosRDSProxyRole (creado en ./iam)."
  type        = string
}

variable "engine_version" {
  type    = string
  default = "16.1"
}
