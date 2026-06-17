# IAC — Pardos Chicken

Infraestructura como Código (Terraform) del sistema de Pardos Chicken sobre AWS.
Estructura modular: **un módulo por capa** del diagrama de arquitectura, con IAM
de **mínimo privilegio** separando provisioning (Terraform) de runtime (ECS/Proxy).

## Estructura

```
IAC/
├── main.tf / variables.tf / outputs.tf / providers.tf / backend.tf
├── iam/                  Roles de provisioning (por capa) + runtime (3 roles) + JSONs
└── modules/
    ├── network/          VPC · 2 AZs · subnets privadas · SGs
    ├── edge/             Route 53 · CloudFront · WAF · Shield · Cognito
    ├── frontend/         S3 (Landing+Reservas / Empleados) vía OAC
    ├── cicd/             ECR · CodeBuild · CodeDeploy
    ├── compute/          API Gateway · VPC Link · ALB · ECS Fargate · Auto Scaling
    ├── messaging/        SQS FIFO · SNS · ElastiCache Redis
    ├── data/             KMS · Secrets Manager · Aurora · RDS Proxy · Backup
    └── observability/    CloudWatch logs · alarmas SLA · dashboard
```

## Principios de seguridad aplicados

- **Separación provisioning / runtime.** Los roles `Terraform*` (en `iam/`) crean
  infraestructura; los roles runtime (`PardosECSExecutionRole`, `PardosECSTaskRole`,
  `PardosRDSProxyRole`) solo operan en ejecución.
- **Sin borrado crítico en CI/CD.** `iam/policies/provisioning/data.json` **no** incluye
  `rds:DeleteDBCluster` ni `kms:ScheduleKeyDeletion`.
- **Aurora solo vía RDS Proxy.** `ecs-task.json` no tiene ninguna acción `rds:*`; el acceso
  es por red (SG) a través del Proxy.
- **ARNs específicos** en las políticas siempre que AWS lo permite (`pardos/*`, `pardos-svc-*`, etc.).

## Estado remoto (un paso manual, una sola vez)

El bucket S3 y la tabla DynamoDB del estado deben existir antes del primer `init`:

```bash
aws s3api create-bucket --bucket pardos-tfstate --region us-east-1
aws s3api put-bucket-versioning --bucket pardos-tfstate \
  --versioning-configuration Status=Enabled
aws dynamodb create-table --table-name pardos-tflock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST --region us-east-1
```

DynamoDB toma el lock `LockID` en cada `plan/apply`, evitando que dos ejecuciones
simultáneas corrompan el `tfstate`.

## Uso

```bash
cp terraform.tfvars.example terraform.tfvars   # rellena account_id, etc.
terraform init
terraform plan
terraform apply
```
