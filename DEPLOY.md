# Guía de Despliegue de la Infraestructura y Aplicación

Este documento detalla los pasos para compilar, empaquetar y desplegar el sistema de reservas de Pardos Chicken en el entorno de AWS utilizando Terraform, Docker y AWS CLI.

---

## 1. Requisitos Previos
* AWS CLI instalado y configurado con credenciales de administrador.
* Terraform v1.5.0 o superior.
* Docker Desktop activo localmente.
* Node.js v20.x y npm instalados.

---

## 2. Preparación del Estado Remoto de Terraform
Este paso solo es necesario si se eliminaron estos recursos del estado remoto manualmente tras una destrucción total.

Antes de inicializar la infraestructura, es necesario crear el bucket de S3 para almacenar el estado y la tabla de DynamoDB para el bloqueo de concurrencia.

### Crear Bucket de S3 para el State:
```bash
aws s3api create-bucket --bucket pardos-tfstate-181777503681 --region us-east-1
```

### Crear Tabla de DynamoDB para el Lock:
```bash
aws dynamodb create-table \
    --table-name pardos-tflock \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region us-east-1
```

---

## 3. Despliegue de la Infraestructura Inicial (Terraform)
Accede a la carpeta de infraestructura y ejecuta el aprovisionamiento. Esto creará los recursos básicos, incluyendo la red (VPC), bases de datos y los repositorios ECR vacíos.

```bash
cd iac

# Inicializar proveedores y backend remoto
terraform init

# Seleccionar o crear el espacio de trabajo (workspace)
terraform workspace select dev || terraform workspace new dev

# Planificar y aplicar los cambios
terraform plan -var-file="dev.tfvars"
terraform apply -var-file="dev.tfvars" -auto-approve
```
*Guarda los valores de salida (Outputs) mostrados en la consola al finalizar el comando, especialmente el dominio de CloudFront (`cloudfront_domain`), los endpoints de ECR y los nombres de los buckets S3.*

---

## 4. Construcción y Subida de Contenedores Backend (Docker a ECR)
Debes compilar las imágenes locales de Docker de los 4 microservicios backend y subirlas a los repositorios de AWS ECR creados por Terraform.

### Inicio de sesión en AWS ECR:
```powershell
$pass = aws ecr get-login-password --region us-east-1
docker login --username AWS --password $pass 181777503681.dkr.ecr.us-east-1.amazonaws.com
```

### Compilar y subir imágenes:
Ejecuta los siguientes comandos desde la raíz del proyecto para cada servicio (`anfitriona`, `mozo`, `caja`, `cocina`):

#### Microservicio: Anfitriona
```bash
docker build -t pardos-dev-svc-anfitriona ./apps/backend/anfitriona
docker tag pardos-dev-svc-anfitriona:latest 181777503681.dkr.ecr.us-east-1.amazonaws.com/pardos-dev-svc-anfitriona:latest
docker push 181777503681.dkr.ecr.us-east-1.amazonaws.com/pardos-dev-svc-anfitriona:latest
```

#### Microservicio: Mozo
```bash
docker build -t pardos-dev-svc-mozo ./apps/backend/mozo
docker tag pardos-dev-svc-mozo:latest 181777503681.dkr.ecr.us-east-1.amazonaws.com/pardos-dev-svc-mozo:latest
docker push 181777503681.dkr.ecr.us-east-1.amazonaws.com/pardos-dev-svc-mozo:latest
```

#### Microservicio: Caja
```bash
docker build -t pardos-dev-svc-caja ./apps/backend/caja
docker tag pardos-dev-svc-caja:latest 181777503681.dkr.ecr.us-east-1.amazonaws.com/pardos-dev-svc-caja:latest
docker push 181777503681.dkr.ecr.us-east-1.amazonaws.com/pardos-dev-svc-caja:latest
```

#### Microservicio: Cocina
```bash
docker build -t pardos-dev-svc-cocina ./apps/backend/cocina
docker tag pardos-dev-svc-cocina:latest 181777503681.dkr.ecr.us-east-1.amazonaws.com/pardos-dev-svc-cocina:latest
docker push 181777503681.dkr.ecr.us-east-1.amazonaws.com/pardos-dev-svc-cocina:latest
```

### Forzar actualización de contenedores en ECS:
Una vez subidas las imágenes a ECR, fuerza a ECS Fargate a descargar la última versión y reiniciar los contenedores:
```bash
aws ecs update-service --cluster pardos-dev-cluster --service svc-anfitriona --force-new-deployment --region us-east-1
aws ecs update-service --cluster pardos-dev-cluster --service svc-mozo --force-new-deployment --region us-east-1
aws ecs update-service --cluster pardos-dev-cluster --service svc-caja --force-new-deployment --region us-east-1
aws ecs update-service --cluster pardos-dev-cluster --service svc-cocina --force-new-deployment --region us-east-1
```

---

## 5. Compilación y Despliegue de Páginas Web (Frontend a S3)
Genera el compilado estático de React y súbelo a los buckets S3 correspondientes.

### Landing Page (Página pública de reservas):
```bash
cd apps/landing-page
npm install
npm run build
aws s3 sync ./dist s3://pardos-frontend-dev --delete --region us-east-1
cd ../..
```

### Reservation System (Portal de empleados):
```bash
cd apps/reservation-system
npm install
npm run build
aws s3 sync ./dist s3://pardos-empleados-dev --delete --region us-east-1
cd ../..
```

---

## 6. Invalidación de la Caché de CloudFront
Para asegurar que los usuarios visualicen los cambios y nuevas compilaciones del frontend de inmediato, invalida la caché de la distribución CDN:

```bash
aws cloudfront create-invalidation --distribution-id E3W0FT3SXH82DE --paths "/*" --region us-east-1
```

---

## 7. Direcciones de Acceso al Sistema
Para consultar los enlaces de acceso generados de forma dinámica por AWS, revisa los Outputs de Terraform al final del despliegue (`terraform output`).

* **Landing Page Pública (Reservas de Clientes):**
  `https://<cloudfront_domain>`
  *(Por ejemplo: https://d3c9w37d2aqmux.cloudfront.net)*

* **Portal Interno de Empleados (Gestión de Mesas y Caja):**
  `https://<cloudfront_domain>/empleados/index.html`
  *(Por ejemplo: https://d3c9w37d2aqmux.cloudfront.net/empleados/index.html)*

---

## 8. Destrucción de la Infraestructura
Para eliminar por completo todos los recursos aprovisionados en AWS y detener los cobros de facturación, sitúate en la carpeta `iac` y ejecuta:

```bash
cd iac
terraform destroy -var-file="dev.tfvars" -auto-approve
```

*Nota: Este comando destruirá bases de datos, redes, balanceadores y contenedores. El bucket de estado remoto de S3 y la tabla de DynamoDB creados en el Paso 2 deben eliminarse manualmente desde la consola de AWS si se desea borrar todo por completo.*
