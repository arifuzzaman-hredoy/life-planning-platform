terraform {
  required_version = ">= 1.10.0"
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "4.6.0"
    }
  }
}
provider "docker" {}
