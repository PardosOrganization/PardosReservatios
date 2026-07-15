terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # CRÍTICO: EL BUCKET Y LA TABLA DE LOCK DEBEN EXISTIR ANTES DEL PRIMER `terraform init`.
  # EL ESTADO SE SEPARA POR WORKSPACE AUTOMÁTICAMENTE BAJO env:/<workspace>/<key>.

  backend "s3" {
    bucket         = "pardos-tfstate-181777503681"
    key            = "pardos/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "pardos-tflock"
    encrypt        = true
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project     = var.project
      Environment = terraform.workspace
      ManagedBy   = "Terraform"
    }
  }
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = var.project
      Environment = terraform.workspace
      ManagedBy   = "Terraform"
    }
  }
}

provider "aws" {
  # Región secundaria de failover de Route 53 (ver Informe_Avance_IaC_Pardos).
  alias  = "us_west_2"
  region = "us-west-2"

  default_tags {
    tags = {
      Project     = var.project
      Environment = terraform.workspace
      ManagedBy   = "Terraform"
    }
  }
}
