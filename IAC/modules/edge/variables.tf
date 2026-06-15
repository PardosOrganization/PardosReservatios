variable "project" {
  type = string
}

variable "env" {
  type = string
}

variable "domain" {
  type = string
}

variable "alb_dns_name" {
  description = "DNS del ALB que actua como origen dinamico."
  type        = string
}
