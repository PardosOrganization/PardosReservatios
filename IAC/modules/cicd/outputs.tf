output "ecr_repo_urls" {
  description = "URL de cada repositorio ECR, indexado por microservicio."
  value       = { for k, r in aws_ecr_repository.this : k => r.repository_url }
}

output "codedeploy_app_name" {
  value = aws_codedeploy_app.this.name
}

output "codebuild_project_name" {
  value = aws_codebuild_project.this.name
}
