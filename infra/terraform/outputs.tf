output "container_name" {
  value = docker_container.app.name
}
output "loopback_url" {
  value = "http://127.0.0.1:${var.host_port}"
}
