output "vpc_id" {
  value = aws_vpc.this.id
}

output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}

output "alb_sg_id" {
  value = aws_security_group.alb.id
}

output "ecs_sg_id" {
  value = aws_security_group.ecs.id
}

output "proxy_sg_id" {
  value = aws_security_group.proxy.id
}

output "aurora_sg_id" {
  value = aws_security_group.aurora.id
}

output "redis_sg_id" {
  value = aws_security_group.redis.id
}
