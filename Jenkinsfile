pipeline {
  agent {
    node {
      label 'life-planning-windows'
      customWorkspace 'G:/Current Project/Development/Life Planning CI/workspace'
    }
  }
  options {
    skipDefaultCheckout(true)
    disableConcurrentBuilds()
    timeout(time: 45, unit: 'MINUTES')
    timestamps()
    buildDiscarder(logRotator(numToKeepStr: '10'))
  }
  parameters {
    booleanParam(name: 'BUILD_REMOTE', defaultValue: false, description: 'Build immutable Docker images on the authorized VPS after local checks')
    booleanParam(name: 'DEPLOY', defaultValue: false, description: 'Also deploy the tested Git revision; requires BUILD_REMOTE')
  }
  environment {
    NEXT_TELEMETRY_DISABLED = '1'
    TEMP = 'G:/Current Project/Development/Life Planning CI/temp'
    TMP = 'G:/Current Project/Development/Life Planning CI/temp'
  }
  stages {
    stage('Checkout') {
      steps {
        bat '@if not exist source\\.git git clone --no-hardlinks "G:\\Current Project\\Development\\Life Planning" source'
        dir('source') {
          bat '@git fetch origin main && git checkout --detach origin/main'
        }
      }
    }
    stage('Source revision') {
      steps {
        script {
          if (params.DEPLOY && !params.BUILD_REMOTE) { error('DEPLOY requires BUILD_REMOTE') }
          dir('source') { env.RELEASE = bat(script: '@git rev-parse HEAD', returnStdout: true).trim() }
        }
      }
    }
    stage('Install and generate') {
      steps {
        dir('source') {
        bat 'call npm.cmd ci --no-audit --no-fund'
        bat 'set "DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build" && call npm.cmd run db:generate'
        }
      }
    }
    stage('Code and unit checks') {
      steps {
        dir('source') {
        bat 'call npm.cmd run format:check'
        bat 'call npm.cmd run lint && call npm.cmd run typecheck && call npm.cmd run test:unit'
        bat 'py -3 -m unittest discover -s scripts -p "test_*.py"'
        bat 'terraform -chdir=infra/terraform init -backend=false -input=false && terraform -chdir=infra/terraform validate'
        bat 'call npm.cmd audit --omit=dev --audit-level=high'
        }
      }
    }
    stage('Database integration') {
      steps {
        dir('source') {
        withCredentials([file(credentialsId: 'life-planning-ci-env', variable: 'CI_ENV')]) {
          bat '@node --env-file="%CI_ENV%" node_modules/prisma/build/index.js migrate deploy'
          bat '@set "RUN_DB_TESTS=true" && node --env-file="%CI_ENV%" node_modules/vitest/vitest.mjs run tests/integration'
        }
        }
      }
    }
    stage('Production build') {
      steps {
        dir('source') {
        bat 'set "DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build" && call npm.cmd run build'
        }
      }
    }
    stage('Browser workflows') {
      steps {
        dir('source') {
          bat 'call npx.cmd playwright install chromium'
          withCredentials([file(credentialsId: 'life-planning-ci-env', variable: 'CI_ENV')]) {
            bat '@py -3 scripts/browser_checks.py --env-file "%CI_ENV%" --port 3317'
          }
        }
      }
    }
    stage('Remote Docker release') {
      when { expression { return params.BUILD_REMOTE } }
      steps {
        dir('source') {
        withCredentials([file(credentialsId: 'life-planning-ssh', variable: 'SSH_JSON')]) {
          script {
            def deployFlag = params.DEPLOY ? ' --deploy' : ''
            bat '@py -3 scripts/remote_release.py --credentials-file "%SSH_JSON%" --known-hosts "%LIFE_PLANNING_KNOWN_HOSTS%" --source . --release "%RELEASE%"' + deployFlag
          }
        }
        }
      }
    }
  }
  post {
    always {
      archiveArtifacts artifacts: 'source/artifacts/**/*.json', allowEmptyArchive: true
    }
  }
}
