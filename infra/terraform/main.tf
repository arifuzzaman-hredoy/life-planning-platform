resource "docker_network" "app" {
  name = "life-planning"
  labels {
    label = "com.oxytumzone.project"
    value = "life-planning"
  }
  lifecycle {
    prevent_destroy = true
  }
}

resource "docker_container" "app" {
  name          = "life-planning-app"
  image         = var.image
  restart       = "unless-stopped"
  user          = "1001:1001"
  read_only     = true
  memory        = var.memory_mb
  memory_swap   = var.memory_mb
  cpus          = "1.0"
  init          = true
  security_opts = ["no-new-privileges:true"]
  capabilities {
    drop = ["ALL"]
  }
  command = ["node", "--env-file=/run/secrets/app.env", "server.js"]
  env     = ["NODE_ENV=production", "HOSTNAME=0.0.0.0", "PORT=3000", "NEXT_TELEMETRY_DISABLED=1"]
  tmpfs   = { "/tmp" = "rw,noexec,nosuid,size=64m", "/app/.next/cache" = "rw,nosuid,size=64m,uid=1001,gid=1001" }
  ports {
    internal = 3000
    external = var.host_port
    ip       = "127.0.0.1"
  }
  volumes {
    host_path      = var.env_file
    container_path = "/run/secrets/app.env"
    read_only      = true
  }
  networks_advanced {
    name = docker_network.app.name
  }
  healthcheck {
    test         = ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
    interval     = "30s"
    timeout      = "5s"
    start_period = "30s"
    retries      = 3
  }
  log_driver            = "json-file"
  log_opts              = { "max-size" = "10m", "max-file" = "3" }
  wait                  = true
  wait_timeout          = 120
  destroy_grace_seconds = 30
  labels {
    label = "com.oxytumzone.project"
    value = "life-planning"
  }
}
