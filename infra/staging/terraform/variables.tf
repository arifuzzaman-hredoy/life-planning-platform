variable "image" {
  type = string
  validation {
    condition     = can(regex("^life-planning:[0-9a-f]{40}$", var.image))
    error_message = "Staging requires an immutable full-SHA image tag."
  }
}

variable "host_port" {
  type    = number
  default = 3318
}

variable "env_file" {
  type    = string
  default = "/opt/life-planning-staging/shared/app.env"
}

variable "memory_mb" {
  type    = number
  default = 512
}
