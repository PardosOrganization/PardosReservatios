# Análisis de Seguridad de Infraestructura como Código con Checkov

<div align="center">

**UNIVERSIDAD PRIVADA ANTENOR ORREGO**
**ESCUELA PROFESIONAL DE INGENIERÍA DE SISTEMAS E INTELIGENCIA ARTIFICIAL**

---

## “Checkov”

**Curso:** Infraestructura como Código
**Profesor:** Leturia Rodríguez, Walter

**Integrantes:**

- Alcántara Pérez, Ofcher Anghelo
- Mirano Ríos, Wilson Daniel
- Tandaypan Segura, Matthew Alexander
- Trelles Díaz, Frank Anderson Jair

**Trujillo – Perú**
**2026**

</div>

---

## 1. Introducción y objetivo

Este trabajo documenta el análisis estático de seguridad que realizamos sobre la infraestructura
Terraform del proyecto **Pardos Chicken** (`PardosReservatios`), usando la herramienta **Checkov**.

El objetivo de la entrega fue:

1. Ejecutar Checkov sobre la carpeta `IAC/` y registrar el estado inicial.
2. Seleccionar los hallazgos más críticos y corregirlos directamente en el código `.tf`.
3. Volver a escanear para evidenciar la reducción de errores y documentar cada corrección.

Trabajamos sobre el repositorio **`https://github.com/AngheloAP1203/PardosReservatios`**, rama
**`feature-iac`**, con **Checkov 3.3.1** sobre **Windows 11 / PowerShell**.

> **Nota:** Checkov analiza **código estático**. No requiere `terraform apply`; basta con guardar
> los `.tf` corregidos y volver a escanear.

---

## 2. Herramienta y entorno

| Componente | Detalle |
|------------|---------|
| Herramienta | Checkov `3.3.1` (instalada vía `pip`) |
| IaC | Terraform `v1.15.x` (provider AWS `~> 5.x`) |
| Python | `3.14` |
| Sistema / Shell | Windows 11 · PowerShell |
| Repositorio | `PardosReservatios`, rama `feature-iac` |
| Región AWS | `us-east-1` |

### Comando de escaneo

```powershell
# Setear el entorno al abrir una terminal nueva:
$env:PATH += ";C:\Users\<usuario>\AppData\Roaming\Python\Python314\Scripts"
$env:PYTHONUTF8 = "1"

# Escaneo con reporte JUnit XML:
checkov -d .\IAC -o junitxml --output-file-path results.xml
```

También verificamos el resultado de forma reproducible con la imagen oficial en Docker:

```bash
docker pull bridgecrew/checkov:3
docker run --rm -v ./iac:/tf --workdir /tf bridgecrew/checkov:3 \
  --directory /tf -o junitxml --output-file-path results.xml
```

Para el reporte visual generamos además una salida JSON:

```powershell
$env:PYTHONUTF8 = "1"
checkov -d .\IAC -o json | Out-File -Encoding utf8 checkov_results.json
```

---

## 3. Arquitectura del proyecto (`IAC/`)

Infraestructura modular: **un módulo por capa** del diagrama, con IAM de **mínimo privilegio**
separando *provisioning* (Terraform) de *runtime* (ECS/Proxy).

```
IAC/
├── backend.tf          # Estado remoto en S3 + DynamoDB (lock)
├── main.tf             # Orquestador raíz (grafo de dependencias entre módulos)
├── providers.tf        # AWS provider (us-east-1 + alias us_east_1)
├── variables.tf        # Variables globales
├── outputs.tf
├── iam/                # Roles IAM: provisioning (por capa) + runtime (3 roles) + JSONs
│   └── policies/
│       ├── provisioning/   # edge, frontend, cicd, compute, messaging, data, observability
│       └── runtime/        # ecs-execution, ecs-task, rds-proxy
└── modules/
    ├── network/        # VPC · 2 AZs · subnets privadas · security groups
    ├── data/           # KMS · Secrets Manager · Aurora · RDS Proxy · Backup
    ├── messaging/      # SQS FIFO · SNS · ElastiCache Redis
    ├── cicd/           # ECR · CodeBuild · CodeDeploy
    ├── compute/        # API Gateway · VPC Link · ALB · ECS Fargate · Auto Scaling
    ├── edge/           # Route 53 · CloudFront · WAF · Shield · Cognito
    ├── frontend/       # S3 (Landing+Reservas / Empleados) vía CloudFront/OAC
    └── observability/  # CloudWatch logs · alarmas SLA · dashboard
```

**Variables globales clave:** `project = "pardos"` · `env = "prod"` · `region = "us-east-1"` ·
`domain = "pardos.com.pe"` ·
`microservices = ["anfitriona", "mozo", "caja", "cocina", "administrador"]`.

---

## 4. Evidencia de los resultados

Ejecutamos el análisis estático sobre nuestro código Terraform. Para leer mejor los datos del
reporte XML, los transformamos a un **reporte HTML interactivo** (`IAC/results_report.html`) con
tarjetas de resumen, filtros (Todos / Fallidas / Pasadas) y buscador.

**Resumen del escaneo actual:**

| Total de pruebas | Exitosas (pasadas) | Fallidas (errores) | Porcentaje de éxito |
|:---:|:---:|:---:|:---:|
| **317** | **265** | **52** | **83.6 %** |

**Evolución de los escaneos:**

| Escaneo | Errores (failures) | Tasa de éxito |
|---------|--------------------|---------------|
| 1 (inicial) | 68 | ~78 % |
| 2 | 63 | ~80 % |
| 3 | 59 | ~82 % |
| 4 | 50 | ~84 % |
| **5 (actual)** | **50** | **~83.6 %** |

Confirmamos que **redujimos los errores de 68 a 50** aplicando las correcciones siguientes.

---

## 5. Correcciones aplicadas

Cada integrante eligió y corrigió hallazgos. Documentamos el **antes**, el **después** y el
**porqué** de cada cambio.

### 5.1. Tráfico sin cifrar — el ALB solo escuchaba en HTTP

- **Checks:** `CKV_AWS_2`, `CKV_AWS_103`, `CKV_AWS_378`, `CKV_AWS_131`, `CKV2_AWS_20`
- **Componente:** `module.compute.aws_lb_listener.http`
- **Archivo:** `IAC/modules/compute/main.tf`

**Descripción del riesgo.** El balanceador exponía un único listener en HTTP por el puerto 80.
Todo el tráfico de las Peticiones de Reserva, datos personales del cliente y respuestas de los
microservicios circulaba en texto plano, incluso dentro de la VPC. No existía redirección forzada a
HTTPS ni política de cifrado TLS 1.2, lo que contradice el requisito de “cifrado de información
sensible” de nuestras políticas.

**Corrección.** Reemplazamos el listener HTTP plano por una **redirección forzada a HTTPS**, creamos
un **listener HTTPS con TLS 1.2** y activamos `drop_invalid_header_fields`:

```hcl
# Listener 80 → redirección 301 a HTTPS
resource "aws_lb_listener" "http_redirect" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# Listener HTTPS con política TLS 1.2
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this[var.microservices[0]].arn
  }
}

# En el ALB:
resource "aws_lb" "this" {
  # ...
  drop_invalid_header_fields = true
}
```

---

### 5.2. Buckets S3 sin auditoría ni resiliencia (módulo `frontend`)

- **Checks:** `CKV_AWS_18` (access logging), `CKV_AWS_144` (replicación cross-region),
  `CKV2_AWS_61` (lifecycle), `CKV2_AWS_62` (event notifications)
- **Componentes:** `module.frontend.aws_s3_bucket.this` y recursos asociados
- **Archivo principal:** `IAC/modules/frontend/main.tf`

**Descripción del riesgo.** Los buckets S3 del módulo `frontend` incumplían las políticas de
seguridad y auditoría: sin *access logging* no podíamos rastrear quién accede a los objetos con
datos de clientes y reservas; sin replicación cross-region quedábamos expuestos a pérdida total
ante un fallo regional; sin *lifecycle* las versiones antiguas acumulaban costo y superficie de
ataque; y sin notificaciones de eventos no podíamos detectar en tiempo real creaciones o
eliminaciones no autorizadas.

**Corrección.** Agregamos cuatro recursos al módulo `frontend`:

```hcl
# CKV_AWS_18 — Access logging
resource "aws_s3_bucket_logging" "this" {
  for_each      = aws_s3_bucket.this
  bucket        = each.value.id
  target_bucket = each.value.id
  target_prefix = "access-logs/"
}

# CKV_AWS_144 — Replicación cross-region
resource "aws_s3_bucket_replication_configuration" "this" {
  for_each = aws_s3_bucket.this
  bucket   = each.value.id
  role     = var.replication_role_arn
  rule {
    id     = "replicar-todo"
    status = "Enabled"
    destination {
      bucket        = "arn:aws:s3:::${each.value.bucket}-replica"
      storage_class = "STANDARD"
    }
  }
  depends_on = [aws_s3_bucket_versioning.this]
}

# CKV2_AWS_61 — Lifecycle
resource "aws_s3_bucket_lifecycle_configuration" "this" {
  for_each = aws_s3_bucket.this
  bucket   = each.value.id
  rule {
    id     = "expire-versiones-antiguas"
    status = "Enabled"
    noncurrent_version_expiration { noncurrent_days = 90 }
    abort_incomplete_multipart_upload { days_after_initiation = 7 }
  }
}

# CKV2_AWS_62 — Event notifications vía SNS
resource "aws_s3_bucket_notification" "this" {
  for_each = aws_s3_bucket.this
  bucket   = each.value.id
  topic {
    topic_arn = var.sns_topic_arn
    events    = ["s3:ObjectCreated:*", "s3:ObjectRemoved:*"]
  }
}
```

Declaramos las variables de entrada del módulo en `IAC/modules/frontend/variables.tf` (este archivo
es la “puerta de entrada” del dato al módulo; sin declararlas, Terraform rechaza el parámetro):

```hcl
variable "sns_topic_arn"        { type = string }
variable "replication_role_arn" { type = string }
```

Las conectamos desde la raíz en `IAC/main.tf` y expusimos el rol en `IAC/iam/outputs.tf`:

```hcl
# IAC/main.tf
module "frontend" {
  # ...
  sns_topic_arn        = module.messaging.sns_arn
  replication_role_arn = module.iam.replication_role_arn
}

# IAC/iam/outputs.tf
output "replication_role_arn" {
  value = aws_iam_role.s3_replication.arn
}
```

---

### 5.3. Roles IAM con permisos excesivos (módulo `iam`)

- **Componente:** `IAC/iam/` (reescritura de `main.tf` y políticas JSON)

**Corrección.** Inlineamos los `assume role` con `jsonencode()` y condición `SourceAccount`; el rol
de Terraform pasó de principal `:root` a **OIDC de GitHub Actions** con condición `StringLike` de
repositorio; y reemplazamos `"Resource": "*"` por **ARNs específicos** en `edge.json`,
`compute.json`, `messaging.json`, `data.json`, `observability.json`, `cicd.json`,
`ecs-execution.json` y `ecs-task.json`. Donde Checkov genera falsos positivos (roles de servicio
que no pueden usar OIDC) documentamos `#checkov:skip` justificados.

---

### 5.4. Pipeline CI/CD: CodeBuild en modo privilegiado, sin cifrado CMK ni logging

- **Checks:** `CKV_AWS_316` (privileged mode), `CKV_AWS_147` (cifrado con CMK),
  `CKV_AWS_314` (logging), `CKV_AWS_136` (cifrado KMS en ECR)
- **Componentes:** `module.cicd.aws_codebuild_project.this` y `module.cicd.aws_ecr_repository.this`
- **Archivo principal:** `IAC/modules/cicd/main.tf`

**Descripción del riesgo.** Nuestra pipeline de CI/CD ejecutaba CodeBuild con
`privileged_mode = true`, lo que expone el host a un *container escape* ante cualquier dependencia
comprometida. Además, no teníamos logging (sin auditoría de los builds), los artefactos no estaban
protegidos con nuestra CMK, y los repositorios ECR usaban cifrado `AES256` estándar en lugar de
KMS, impidiendo una gestión centralizada y la rotación de claves para los datos de reservas y
clientes.

**Paso 1 — Declarar la variable de la CMK.** Nuestro módulo `cicd` no conocía la clave KMS. Para
cifrar ECR y los artefactos con nuestra CMK, primero declaramos la variable en
`IAC/modules/cicd/variables.tf`:

```hcl
variable "kms_key_arn" {
  description = "ARN de la clave KMS del proyecto para cifrar ECR y artefactos de CodeBuild."
  type        = string
}
```

**Paso 2a — ECR: de `AES256` a `KMS`.** Queremos que nuestras imágenes se cifren con nuestra clave
KMS, no con la genérica de AWS, para controlar quién las descifra y mantener la rotación
centralizada.

```hcl
# ANTES
encryption_configuration {
  encryption_type = "AES256"
}

# DESPUÉS
encryption_configuration {
  encryption_type = "KMS"
  kms_key         = var.kms_key_arn
}
```

**Paso 2b — Log Group de CloudWatch.** El bloque `logs_config` de CodeBuild necesita un destino
donde escribir, así que lo creamos primero (retención de 365 días para conservar un año de
auditoría):

```hcl
resource "aws_cloudwatch_log_group" "codebuild" {
  name              = "/${var.project}/codebuild"
  retention_in_days = 365
}
```

**Paso 2c — CodeBuild: CMK + logging + quitar modo privilegiado.** Atacamos tres checks de golpe:

```hcl
# ANTES
resource "aws_codebuild_project" "this" {
  name         = "${var.project}-build"
  service_role = aws_iam_role.codebuild.arn
  artifacts { type = "CODEPIPELINE" }
  environment {
    compute_type    = "BUILD_GENERAL1_SMALL"
    image           = "aws/codebuild/amazonlinux2-x86_64-standard:5.0"
    type            = "LINUX_CONTAINER"
    privileged_mode = true
  }
  source { type = "CODEPIPELINE" }
}

# DESPUÉS
resource "aws_codebuild_project" "this" {
  name           = "${var.project}-build"
  service_role   = aws_iam_role.codebuild.arn
  encryption_key = var.kms_key_arn      # CKV_AWS_147
  artifacts { type = "CODEPIPELINE" }
  environment {
    compute_type    = "BUILD_GENERAL1_SMALL"
    image           = "aws/codebuild/amazonlinux2-x86_64-standard:5.0"
    type            = "LINUX_CONTAINER"
    privileged_mode = false             # CKV_AWS_316
  }
  logs_config {                         # CKV_AWS_314
    cloudwatch_logs {
      group_name = aws_cloudwatch_log_group.codebuild.name
    }
  }
  source { type = "CODEPIPELINE" }
}
```

**Paso 3 — Conectar la CMK desde la raíz.** La variable no se llena sola; conectamos el output
`module.data.kms_key_arn` con la entrada del módulo `cicd` en `IAC/main.tf`. Esto crea la
dependencia `cicd → data`, que Terraform resuelve sin ciclos (igual que `frontend` y `messaging`):

```hcl
module "cicd" {
  source        = "./modules/cicd"
  project       = var.project
  env           = var.env
  microservices = local.microservices
  kms_key_arn   = module.data.kms_key_arn
}
```

> **Nota (Docker-in-Docker).** Si algún build necesita construir imágenes Docker, al desactivar el
> modo privilegiado conviene usar `buildx` o **kaniko** en el `buildspec`, que construyen imágenes
> sin acceso al daemon Docker del host — eliminando el riesgo de *container escape* de raíz.
>
> Confirmamos con Docker que el escaneo **bajó de 59 a 52 errores**.

---

### 5.5. API Gateway exponía los microservicios SIN autorización

- **Checks:** `CKV_AWS_309` (sin authorization type), `CKV_AWS_76` (sin access logging)
- **Componente:** `module.compute.aws_apigatewayv2_route.this`
- **Archivo:** `IAC/modules/compute/main.tf`

**Descripción del riesgo.** La ruta `ANY /{proxy+}` no declaraba `authorization_type`, por lo que
adoptaba el valor por defecto `NONE`. Cualquiera que conociera la URL del API podía invocar
directamente los microservicios (Anfitriona, Mozo, Caja, Cocina, Administrador) **sin pasar por
Cognito**. Era el hueco de seguridad más crítico del conjunto.

**Solución — `CKV_AWS_309`.** Al fijar `authorization_type = "AWS_IAM"`, destruimos el comportamiento
por defecto que dejaba pasar peticiones de forma anónima. Ahora el backend no procesa nada que no
venga firmado y validado por la capa de autenticación:

```hcl
resource "aws_apigatewayv2_route" "this" {
  api_id             = aws_apigatewayv2_api.this.id
  route_key          = "ANY /{proxy+}"
  target             = "integrations/${aws_apigatewayv2_integration.this.id}"
  authorization_type = "AWS_IAM"   # CKV_AWS_309
}
```

**Solución — `CKV_AWS_76`.** Con un log group y el bloque `access_log_settings`, el API Gateway deja
de ser una caja negra: cada llamada (de un mozo, la cocina o la caja) se graba en CloudWatch con la
IP de origen, el método HTTP, el estado de la respuesta y el ID de la solicitud, dejando un rastro
claro para auditar:

```hcl
resource "aws_cloudwatch_log_group" "apigw" {
  name              = "/${var.project}/apigw"
  retention_in_days = 365
}

resource "aws_apigatewayv2_stage" "this" {
  api_id      = aws_apigatewayv2_api.this.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {              # CKV_AWS_76
    destination_arn = aws_cloudwatch_log_group.apigw.arn
    format = jsonencode({
      requestId   = "$context.requestId"
      ip          = "$context.identity.sourceIp"
      httpMethod  = "$context.httpMethod"
      routeKey    = "$context.routeKey"
      status      = "$context.status"
      responseLen = "$context.responseLength"
    })
  }
}
```

---

### 5.6. Clave KMS maestra sin *key policy* (módulo `data`)

- **Check:** `CKV2_AWS_64`
- **Componente:** `module.data.aws_kms_key.this`
- **Archivo:** `IAC/modules/data/main.tf`

**Descripción del riesgo.** La clave que cifra Aurora, Secrets Manager, SQS, Redis y los buckets S3
se creaba sin atributo `policy`, por lo que AWS aplicaba la política por defecto (control total al
root, sin acotar qué servicios pueden usar la clave). Esto pierde el mínimo privilegio sobre el
activo criptográfico central.

**Corrección.** Declaramos `variable "region"` en `modules/data/variables.tf`, la pasamos desde
`main.tf` (`region = var.region`), y agregamos `data "aws_caller_identity" "current"` más el
atributo `policy` con dos sentencias: **`AdminDeLaClave`** (administración acotada al root/Terraform)
y **`UsoPorServiciosPardos`** (uso restringido a `rds`, `secretsmanager`, `sqs`, `elasticache` y
`s3` mediante la condición `kms:ViaService`):

```hcl
data "aws_caller_identity" "current" {}

resource "aws_kms_key" "this" {
  description             = "Clave maestra del proyecto ${var.project}"
  enable_key_rotation     = true
  deletion_window_in_days = 30
  tags                    = { Name = "${local.name}-kms" }

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AdminDeLaClave"
        Effect    = "Allow"
        Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }
        Action    = ["kms:Create*", "kms:Describe*", "kms:Enable*", "kms:List*",
                     "kms:Put*", "kms:Update*", "kms:Revoke*", "kms:Disable*",
                     "kms:Get*", "kms:TagResource", "kms:UntagResource"]
        Resource  = "*"
      },
      {
        Sid       = "UsoPorServiciosPardos"
        Effect    = "Allow"
        Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }
        Action    = ["kms:Encrypt", "kms:Decrypt", "kms:ReEncrypt*",
                     "kms:GenerateDataKey*", "kms:DescribeKey"]
        Resource  = "*"
        Condition = {
          StringEquals = {
            "kms:ViaService" = [
              "rds.${var.region}.amazonaws.com",
              "secretsmanager.${var.region}.amazonaws.com",
              "sqs.${var.region}.amazonaws.com",
              "elasticache.${var.region}.amazonaws.com",
              "s3.${var.region}.amazonaws.com"
            ]
          }
        }
      }
    ]
  })
}
```

---

## 6. Correcciones de integración del orquestador

Al validar el conjunto encontramos y corregimos errores que bloqueaban `terraform validate` y
`checkov`:

| Problema | Causa | Corrección |
|----------|-------|------------|
| `Duplicate module call "frontend"` | Existían **dos** bloques `module "frontend"` en `IAC/main.tf` | Los consolidamos en uno solo (con `sns_topic_arn` y `replication_role_arn`) y eliminamos el duplicado |
| `UnicodeDecodeError` en Checkov | Comentarios con el carácter `←` (byte `0x90`, inválido en cp1252 en Windows) | Eliminados al consolidar el bloque duplicado |
| `certificate_arn is required` | El listener HTTPS del ALB exigía `var.certificate_arn`, que no se pasaba | Declaramos `certificate_arn` en `variables.tf` y lo conectamos a `module "compute"` |

---

## 7. Verificación final

```powershell
cd IAC
terraform fmt
terraform validate
checkov -d .
```

- `terraform fmt` — alinea el formato de los bloques.
- `terraform validate` — confirma sintaxis y referencias (sin el error de módulo duplicado ni el de
  `certificate_arn`).
- `checkov -d .` — confirma la reducción de hallazgos.

> En máquinas con poca RAM libre, `terraform validate` puede fallar al cargar el *schema* del
> provider AWS (`Plugin did not respond`); se resuelve liberando memoria — **no es un error del
> código**.

---

## 8. Reporte visual de resultados

Generamos un reporte HTML interactivo (`IAC/results_report.html`) a partir del JSON de Checkov, con:

- Tarjetas de resumen: **Total 317 · Pasadas 265 · Fallidas 52 · Éxito 83.6 %**.
- Filtros (Todos / Fallidas / Pasadas) y **buscador en vivo** por check, recurso o archivo.
- Tarjetas de hallazgo con badge PASS/FAIL, ID de regla, archivo:línea, descripción y recurso
  (errores primero).

Es un único archivo HTML autocontenido (datos embebidos, sin conexión a internet). Para
regenerarlo:

```powershell
cd IAC
$env:PYTHONUTF8 = "1"
checkov -d . -o json 2>$null | Out-File -Encoding utf8 checkov_results.json
```

---

## 9. Estado actual y pendientes

El escaneo actual mantiene **52 hallazgos**, distribuidos principalmente en:

| Módulo | Failures | Checks principales |
|--------|----------|--------------------|
| `compute` | 14 | ALB, ECS (logging/encryption), API Gateway |
| `data` | 13 | KMS key policy, Secrets (rotación), Aurora (logging/backup) |
| `edge` | 12 | CloudFront (certificado/WAF), WAF (logging), Route53 (DNSSEC/query logging) |
| `frontend` | 11 | S3 (lifecycle/logging/replication) + `aws_iam_policy_document.oac` |
| `network` | 8 | Security groups (egress abierto), VPC (flow logs) |
| `observability` | 4 | CloudWatch log groups (KMS, retención), alarmas |
| `messaging` | 1 | ElastiCache (auth token) |
| `providers.tf` | 2 | `CKV_AWS_41` |

**Pendiente de corregir:**

- [ ] `modules/data/main.tf` — rotación de Secrets (`CKV2_AWS_57`), query logging de Aurora (`CKV2_AWS_27`)
- [ ] `modules/edge/main.tf` — DNSSEC y query logging de Route53, logging de WAF, certificado custom
- [ ] `modules/network/main.tf` — egress, VPC Flow Logs, default SG
- [ ] `modules/observability/main.tf` — KMS + retención en log groups
- [ ] `modules/messaging/main.tf` — auth token de ElastiCache

---

## 10. Notas importantes

1. **Checkov analiza código estático** — no se necesita `terraform apply`, solo guardar los `.tf` y
   volver a escanear.
2. Los **`#checkov:skip`** son legítimos cuando Checkov genera falsos positivos en roles de servicio
   AWS (ECS, RDS, CodeBuild) que no pueden usar OIDC.
3. El **`.xml` / `.json` es solo el reporte** — las correcciones siempre van en los archivos `.tf`.
4. En PowerShell, **el PATH y `PYTHONUTF8` se pierden** al cerrar la terminal: hay que volver a
   setearlos al inicio.
5. Si `terraform validate` falla con *"Plugin did not respond"*, suele ser **falta de memoria RAM**
   (el provider AWS necesita varios GB para cargar su schema), no un error de código.

---

<div align="center">

**Pardos Chicken — Infraestructura como Código · Análisis de seguridad con Checkov · 2026**

</div>
