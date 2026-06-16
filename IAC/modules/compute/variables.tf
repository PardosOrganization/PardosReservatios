variable "project" {
  type = string
}

variable "env" {
  type = string
}

variable "region" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "alb_sg_id" {
  type = string
}

variable "ecs_sg_id" {
  type = string
}

variable "microservices" {
  type = list(string)
}

variable "ecr_repo_urls" {
  type = map(string)
}

variable "execution_role_arn" {
  type = string
}

variable "task_role_arn" {
  type = string
}

variable "rds_proxy_endpoint" {
  description = "Endpoint del RDS Proxy (se inyecta como env var; NO se da rds:* a las tareas)."
  type        = string
}

variable "db_secret_arn" {
  type = string
}

variable "sqs_queue_arn" {
  type = string
}

variable "sns_topic_arn" {
  type = string
}

variable "container_port" {
  type    = number
  default = 8080
}

variable "certificate_arn" {
  description = "ARN del certificado ACM para el listener HTTPS del ALB."
  type        = string
}