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
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }

  parameters {
    choice(
      name: 'MODE',
      choices: ['VALIDATE', 'BUILD', 'DEPLOY'],
      description: 'VALIDATE = full validation; BUILD = immutable Docker images; DEPLOY = reuse existing validated images'
    )

    string(
      name: 'RELEASE_SHA',
      defaultValue: '',
      description: 'Full 40-character Git SHA'
    )
  }

  environment {
    NEXT_TELEMETRY_DISABLED = '1'
    PYTHONIOENCODING = 'utf-8'
    PYTHONUTF8 = '1'

    TEMP = 'G:/Current Project/Development/Life Planning CI/temp'
    TMP = 'G:/Current Project/Development/Life Planning CI/temp'

    VALIDATION_DIR = 'G:/Current Project/Development/Life Planning CI/state/validated'
  }

  stages {

    stage('Checkout') {
      steps {
        bat '@if not exist source\\.git git clone --no-hardlinks "G:\\Current Project\\Development\\Life Planning" source'

        dir('source') {
          bat '@git fetch origin main'

          script {
            def requested = params.RELEASE_SHA.trim()

            if (requested && !(requested ==~ /[0-9a-f]{40}/)) {
              error('RELEASE_SHA must be a full lowercase 40-character Git SHA')
            }

            if (params.MODE != 'VALIDATE' && !requested) {
              error('BUILD and DEPLOY require RELEASE_SHA')
            }

            if (requested) {
              bat "@git rev-parse --verify ${requested}"
              bat "@git merge-base --is-ancestor ${requested} origin/main"
              bat "@git checkout --detach ${requested}"
            } else {
              bat '@git checkout --detach origin/main'
            }
          }
        }
      }
    }


    stage('Source revision') {
      steps {
        script {
          dir('source') {
            env.RELEASE = bat(
              script: '@git rev-parse HEAD',
              returnStdout: true
            ).trim()
          }

          def requested = params.RELEASE_SHA.trim()

          if (requested && requested != env.RELEASE) {
            error('Requested release does not match checkout')
          }

          echo "MODE=${params.MODE}"
          echo "RELEASE=${env.RELEASE}"
        }
      }
    }


    stage('Install and generate') {
      when {
        expression { params.MODE == 'VALIDATE' }
      }

      steps {
        dir('source') {
          bat 'call npm.cmd ci --no-audit --no-fund'
          bat 'set "DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build" && call npm.cmd run db:generate'
        }
      }
    }


    stage('Code and unit checks') {
      when {
        expression { params.MODE == 'VALIDATE' }
      }

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
      when {
        expression { params.MODE == 'VALIDATE' }
      }

      steps {
        dir('source') {
          withCredentials([
            file(
              credentialsId: 'life-planning-ci-env',
              variable: 'CI_ENV'
            )
          ]) {
            bat '@node --env-file="%CI_ENV%" node_modules/prisma/build/index.js migrate deploy'
            bat '@set "RUN_DB_TESTS=true" && node --env-file="%CI_ENV%" node_modules/vitest/vitest.mjs run tests/integration'
          }
        }
      }
    }


    stage('Production build') {
      when {
        expression { params.MODE == 'VALIDATE' }
      }

      steps {
        dir('source') {
          bat 'set "DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build" && call npm.cmd run build'
        }
      }
    }


    stage('Browser workflows') {
      when {
        expression { params.MODE == 'VALIDATE' }
      }

      steps {
        dir('source') {
          bat 'call npx.cmd playwright install chromium'

          withCredentials([
            file(
              credentialsId: 'life-planning-ci-env',
              variable: 'CI_ENV'
            )
          ]) {
            bat '@py -3 scripts/browser_checks.py --env-file "%CI_ENV%" --port 3317'
          }
        }
      }
    }


    stage('Record validation receipt') {
      when {
        expression { params.MODE == 'VALIDATE' }
      }

      steps {
        bat '@if not exist "%VALIDATION_DIR%" mkdir "%VALIDATION_DIR%"'
        bat '@> "%VALIDATION_DIR%\\%RELEASE%.ok" echo %RELEASE%'
      }
    }


    stage('Validation receipt gate') {
      when {
        expression {
          params.MODE == 'BUILD' ||
          params.MODE == 'DEPLOY'
        }
      }

      steps {
        bat '@if not exist "%VALIDATION_DIR%\\%RELEASE%.ok" exit /b 1'
        bat '@findstr /x /c:"%RELEASE%" "%VALIDATION_DIR%\\%RELEASE%.ok" >nul'
      }
    }


    stage('Build immutable remote images') {
      when {
        expression { params.MODE == 'BUILD' }
      }

      steps {
        dir('source') {
          withCredentials([
            file(
              credentialsId: 'life-planning-ssh',
              variable: 'SSH_JSON'
            )
          ]) {
            bat '@py -3 scripts/remote_release.py --credentials-file "%SSH_JSON%" --known-hosts "%LIFE_PLANNING_KNOWN_HOSTS%" --source . --release "%RELEASE%"'
          }
        }
      }
    }


    stage('Deploy existing immutable release') {
      when {
        expression { params.MODE == 'DEPLOY' }
      }

      steps {
        dir('source') {
          withCredentials([
            file(
              credentialsId: 'life-planning-ssh',
              variable: 'SSH_JSON'
            )
          ]) {
            bat '@py -3 scripts/remote_deploy_existing.py --credentials-file "%SSH_JSON%" --known-hosts "%LIFE_PLANNING_KNOWN_HOSTS%" --release "%RELEASE%"'
          }
        }
      }
    }
  }

  post {
    always {
      archiveArtifacts(
        artifacts: 'source/artifacts/**/*.json',
        allowEmptyArchive: true
      )
    }
  }
}
