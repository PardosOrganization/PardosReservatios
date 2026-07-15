resource "aws_elasticache_subnet_group" "this" {
  name       = "${local.name}-redis"
  subnet_ids = aws_subnet.private[*].id
}

resource "random_password" "redis_auth" {
  length           = 32
  special          = true
  override_special = "!&#$^<>-"
}

resource "aws_elasticache_replication_group" "this" {
  replication_group_id       = "${local.name}-redis"
  description                = "Cache de disponibilidad de mesas de Pardos"
  engine                     = "redis"
  node_type                  = var.redis_node_type
  num_cache_clusters         = var.redis_num_cache_clusters
  automatic_failover_enabled = var.redis_multi_az
  multi_az_enabled           = var.redis_multi_az
  subnet_group_name          = aws_elasticache_subnet_group.this.name
  security_group_ids         = [aws_security_group.redis.id]
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  transit_encryption_mode    = "required"
  auth_token                 = random_password.redis_auth.result
  kms_key_id                 = aws_kms_key.rds.arn
  port                       = 6379

  tags = {
    Name        = "${local.name}-redis"
    Environment = terraform.workspace
  }
}
