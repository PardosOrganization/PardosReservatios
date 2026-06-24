output "ecr_repo_urls" {
  description = "URL de cada repositorio ECR, indexado por microservicio."
  value       = { for k, r in aws_ecr_repository.this : k => r.repository_url }
}
