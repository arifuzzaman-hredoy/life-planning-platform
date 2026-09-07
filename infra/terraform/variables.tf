variable "image" {
  description = "Immutable image tag already built on this Docker daemon, e.g. life-planning:full-commit-sha."
  type        = string
  validation {
    condition     = can(regex("^life-planning:[a-zA-Z0-9][a-zA-Z0-9_.-]+$", var.image)) && !endswith(var.image, ":latest")
    error_message = "Use a versioned life-planning image, never latest."
  }
}

variable "host_port" {
  type        = number
  default     = 3217
  description = "Loopback port reserved for this application only."
}

variable "env_file" {
  type        = string
  default     = "/opt/life-planning/shared/app.env"
  description = "Path only: Terraform never reads the secret contents."
  validation {
    condition     = startswith(var.env_file, "/opt/life-planning/shared/")
    error_message = "Environment files must be inside the application shared directory."
  }
}

variable "memory_mb" {
  type    = number
  default = 640
}
