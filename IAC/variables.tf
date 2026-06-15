variable "project" {
  description = "Nombre del proyecto, usado como prefijo de recursos."
  type        = string
  default     = "pardos"
}

variable "env" {
  description = "Entorno de despliegue (dev, prod). Forma parte del key del tfstate y del nombre de recursos."
  type        = string
  default     = "prod"
}

variable "region" {
  description = "Región AWS principal."
  type        = string
  default     = "us-east-1"
}

variable "account_id" {
  description = "ID de la cuenta AWS (12 dígitos), usado para construir ARNs específicos en las políticas IAM."
  type        = string
}

variable "domain" {
  description = "Dominio público del proyecto (Route 53 / CloudFront / Cognito)."
  type        = string
  default     = "pardos.com.pe"
}

variable "vpc_cidr" {
  description = "Bloque CIDR de la VPC."
  type        = string
  default     = "10.20.0.0/16"
}

variable "azs" {
  description = "Availability Zones (Multi-AZ activo/standby según el diagrama)."
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}

variable "microservices" {
  description = "Microservicios sobre ECS Fargate (SVC del diagrama)."
  type        = list(string)
  default     = ["anfitriona", "mozo", "caja", "cocina", "administrador"]
}
