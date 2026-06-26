variable "project" {
  description = "Nombre del proyecto, usado como prefijo de recursos."
  type        = string
  default     = "pardos"
}

variable "region" {
  description = "Región AWS principal."
  type        = string
  default     = "us-east-1"
}

variable "azs" {
  description = "Availability Zones (Multi-AZ activo/standby según el diagrama)."
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}

variable "microservices" {
  description = "Microservicios sobre ECS Fargate (SVC del diagrama)."
  type        = list(string)
  default     = ["anfitriona", "mozo", "caja", "cocina"]
}

variable "container_port" {
  description = "Puerto expuesto por los contenedores de los microservicios."
  type        = number
  default     = 8080
}

variable "account_id" {
  description = "ID de la cuenta AWS (12 dígitos) usado para construir ARNs en políticas IAM."
  type        = string
}

variable "domain" {
  description = "Dominio público del entorno (Route 53 / CloudFront / Cognito)."
  type        = string
}

variable "vpc_cidr" {
  description = "Bloque CIDR de la VPC del entorno (debe ser único por entorno para evitar solapes)."
  type        = string
}

variable "certificate_arn" {
  description = "ARN del certificado ACM (región principal) para el listener HTTPS del ALB."
  type        = string
}

variable "acm_certificate_arn" {
  description = "ARN del certificado ACM en us-east-1 para CloudFront."
  type        = string
}

variable "engine_version" {
  description = "Versión del motor Aurora PostgreSQL."
  type        = string
}

variable "aurora_instance_class" {
  description = "Clase de instancia de los nodos Aurora."
  type        = string
}

variable "aurora_instance_count" {
  description = "Número de instancias del cluster Aurora (1 = solo writer, 2 = writer + reader)."
  type        = number
}

variable "aurora_backup_retention" {
  description = "Días de retención de backups automáticos de Aurora."
  type        = number
}

variable "deletion_protection" {
  description = "Activa la protección contra borrado en recursos críticos (Aurora, ALB)."
  type        = bool
}

variable "redis_node_type" {
  description = "Tipo de nodo de ElastiCache Redis."
  type        = string
}

variable "redis_num_cache_clusters" {
  description = "Número de nodos del replication group de Redis."
  type        = number
}

variable "redis_multi_az" {
  description = "Activa Multi-AZ y failover automático en Redis."
  type        = bool
}

variable "ecs_task_cpu" {
  description = "CPU asignada a cada task de ECS Fargate (unidades de CPU)."
  type        = number
}

variable "ecs_task_memory" {
  description = "Memoria asignada a cada task de ECS Fargate (MiB)."
  type        = number
}

variable "ecs_desired_count" {
  description = "Número deseado de tareas por servicio ECS."
  type        = number
}

variable "ecs_min_capacity" {
  description = "Capacidad mínima de tareas para el auto scaling."
  type        = number
}

variable "ecs_max_capacity" {
  description = "Capacidad máxima de tareas para el auto scaling."
  type        = number
}

variable "log_retention_days" {
  description = "Días de retención de los log groups de CloudWatch."
  type        = number
}

variable "waf_rate_limit" {
  description = "Límite de peticiones por IP en 5 minutos para la regla rate-based del WAF."
  type        = number
}

variable "enable_s3_replication" {
  description = "Activa la replicación cross-region de los buckets de frontend."
  type        = bool
}

variable "geo_restriction_locations" {
  description = "Lista de países permitidos (whitelist) en CloudFront."
  type        = list(string)
}
