variable "project" {
  type = string
}

variable "env" {
  type = string
}

variable "vpc_cidr" {
  type = string
}

variable "azs" {
  description = "Lista de Availability Zones (2 según el diagrama)."
  type        = list(string)
}
