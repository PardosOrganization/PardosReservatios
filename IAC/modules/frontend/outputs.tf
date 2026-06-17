output "bucket_arns" {
  description = "ARNs de los buckets de frontend, indexados por nombre logico."
  value       = { for k, b in aws_s3_bucket.this : k => b.arn }
}

output "bucket_names" {
  value = { for k, b in aws_s3_bucket.this : k => b.id }
}

output "bucket_regional_domains" {
  description = "Dominios regionales para configurar como origen S3 en CloudFront."
  value       = { for k, b in aws_s3_bucket.this : k => b.bucket_regional_domain_name }
}
