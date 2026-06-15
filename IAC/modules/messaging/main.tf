# CAPA 5 — Mensajeria y cache: SQS FIFO, SNS, ElastiCache Redis Multi-AZ.

locals {
  name = "${var.project}-${var.env}"
}

# ── SQS FIFO: Peticiones de Reserva (orden de llegada garantizado) ──
resource "aws_sqs_queue" "reservas_dlq" {
  name                        = "${var.project}-reservas-dlq.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
  kms_master_key_id           = var.kms_key_arn
}

resource "aws_sqs_queue" "reservas" {
  name                        = "${var.project}-reservas-fifo.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
  kms_master_key_id           = var.kms_key_arn

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.reservas_dlq.arn
    maxReceiveCount     = 5
  })
}

# ── SNS: Notificaciones al cliente (SMS/email) ──
resource "aws_sns_topic" "notificaciones" {
  name              = "${var.project}-notificaciones"
  kms_master_key_id = var.kms_key_arn
}

# ── ElastiCache Redis: cache de disponibilidad de mesas (Primary + Replica) ──
resource "aws_elasticache_subnet_group" "this" {
  name       = "${local.name}-redis"
  subnet_ids = var.private_subnet_ids
}

resource "aws_elasticache_replication_group" "this" {
  replication_group_id       = "${var.project}-redis-${var.env}"
  description                = "Cache de disponibilidad de mesas de Pardos"
  engine                     = "redis"
  node_type                  = "cache.t4g.small"
  num_cache_clusters         = 2
  automatic_failover_enabled = true
  multi_az_enabled           = true
  subnet_group_name          = aws_elasticache_subnet_group.this.name
  security_group_ids         = [var.redis_sg_id]
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  kms_key_id                 = var.kms_key_arn
  port                       = 6379
}
