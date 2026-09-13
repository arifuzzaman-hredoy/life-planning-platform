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
      description: 'VALIDATE = full tests/E2E; BUILD = immutable remote images only; DEPLOY = reuse existing validated images'
    )

    string(
      name: 'RELEASE_SHA',
      defaultValue: '',
      description: 'Full 40-character Git SHA. Required for BUILD and DEPLOY. VALIDATE may leave blank to use origin/main.'
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

            if (
              requested &&
              !(requested ==~ /[0-9a-f]{40}/)
            ) {
              error('RELEASE_SHA must be a full 40-character lowercase Git SHA')
            }

            if (
              params.MODE != 'VALIDATE' &&
              !requested
            ) {
              error('BUILD and DEPLOY require an explicit RELEASE_SHA')
            }

            if (requested) {

              bat "@git cat-file -e ${requested}^{commit}"

              bat """
                @git merge-base --is-ancestor ${requested} origin/main || (
                  echo ERROR: RELEASE_SHA is not contained in origin/main.
                  exit /b 1
                )
              """

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

        dir('source') {

          script {

            env.RELEASE = bat(
              script: '@git rev-parse HEAD',
              returnStdout: true
            ).trim()

            def requested = params.RELEASE_SHA.trim()

            if (
              requested &&
              requested != env.RELEASE
            ) {
              error(
                "Requested release ${requested} does not match checkout ${env.RELEASE}"
              )
            }

            echo "MODE=${params.MODE}"
            echo "RELEASE=${env.RELEASE}"
          }
        }
      }
    }


    /*
     * VALIDATE
     *
     * Full application validation occurs exactly once per SHA.
     */

    stage('Install and generate') {

      when {
        expression {
          return params.MODE == 'VALIDATE'
        }
      }

      steps {
        dir('source') {

          bat 'call npm.cmd ci --no-audit --no-fund'

          bat '''
            set "DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build" && ^
            call npm.cmd run db:generate
          '''
        }
      }
    }


    stage('Code and unit checks') {

      when {
        expression {
          return params.MODE == 'VALIDATE'
        }
      }

      steps {
        dir('source') {

          bat 'call npm.cmd run format:check'

          bat '''
            call npm.cmd run lint && ^
            call npm.cmd run typecheck && ^
            call npm.cmd run test:unit
          '''

          bat '''
            py -3 -m unittest discover ^
            -s scripts ^
            -p "test_*.py"
          '''

          bat '''
            terraform -chdir=infra/terraform init -backend=false -input=false && ^
            terraform -chdir=infra/terraform validate
          '''

          bat '''
            call npm.cmd audit ^
            --omit=dev ^
            --audit-level=high
          '''
        }
      }
    }


    stage('Database integration') {

      when {
        expression {
          return params.MODE == 'VALIDATE'
        }
      }

      steps {
        dir('source') {

          withCredentials([
            file(
              credentialsId: 'life-planning-ci-env',
              variable: 'CI_ENV'
            )
          ]) {

            bat '''
              @node ^
              --env-file="%CI_ENV%" ^
              node_modules/prisma/build/index.js ^
              migrate deploy
            '''

            bat '''
              @set "RUN_DB_TESTS=true" && ^
              node ^
              --env-file="%CI_ENV%" ^
              node_modules/vitest/vitest.mjs ^
              run tests/integration
            '''
          }
        }
      }
    }


    stage('Production build') {

      when {
        expression {
          return params.MODE == 'VALIDATE'
        }
      }

      steps {
        dir('source') {

          bat '''
            set "DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build" && ^
            call npm.cmd run build
          '''
        }
      }
    }


    stage('Browser workflows') {

      when {
        expression {
          return params.MODE == 'VALIDATE'
        }
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

            bat '''
              @py -3 scripts/browser_checks.py ^
              --env-file "%CI_ENV%" ^
              --port 3317
            '''
          }
        }
      }
    }


    stage('Record validation receipt') {

      when {
        expression {
          return params.MODE == 'VALIDATE'
        }
      }

      steps {

        bat '''
          @if not exist "%VALIDATION_DIR%" mkdir "%VALIDATION_DIR%"
        '''

        bat '''
          @> "%VALIDATION_DIR%\\%RELEASE%.ok" echo %RELEASE%
        '''

        echo "Validation receipt recorded for ${env.RELEASE}"
      }
    }


    /*
     * BUILD / DEPLOY safety gate.
     *
     * An exact SHA cannot be built or deployed until Jenkins has previously
     * completed VALIDATE successfully for the same immutable revision.
     */

    stage('Validation receipt gate') {

      when {
        expression {
          return params.MODE == 'BUILD' ||
                 params.MODE == 'DEPLOY'
        }
      }

      steps {

        bat '''
          @if not exist "%VALIDATION_DIR%\\%RELEASE%.ok" (
            echo ERROR: Release %RELEASE% has no successful Jenkins validation receipt.
            exit /b 1
          )
        '''

        bat '''
          @findstr /x /c:"%RELEASE%" "%VALIDATION_DIR%\\%RELEASE%.ok" >nul || (
            echo ERROR: Validation receipt does not match release.
            exit /b 1
          )
        '''

        echo "Validation receipt accepted for ${env.RELEASE}"
      }
    }


    /*
     * BUILD
     *
     * Upload exact tracked source and build immutable application/migrator
     * images once. No npm install, unit tests, integration tests, Next build,
     * or Playwright are repeated here.
     */

    stage('Build immutable remote images') {

      when {
        expression {
          return params.MODE == 'BUILD'
        }
      }

      steps {

        dir('source') {

          withCredentials([
            file(
              credentialsId: 'life-planning-ssh',
              variable: 'SSH_JSON'
            )
          ]) {

            bat '''
              @py -3 scripts/remote_release.py ^
              --credentials-file "%SSH_JSON%" ^
              --known-hosts "%LIFE_PLANNING_KNOWN_HOSTS%" ^
              --source . ^
              --release "%RELEASE%"
            '''
          }
        }
      }
    }


    /*
     * DEPLOY
     *
     * Existing exact images are reused.
     * Docker builds and full application validation are deliberately skipped.
     */

    stage('Deploy existing immutable release') {

      when {
        expression {
          return params.MODE == 'DEPLOY'
        }
      }

      steps {

        dir('source') {

          withCredentials([
            file(
              credentialsId: 'life-planning-ssh',
              variable: 'SSH_JSON'
            )
          ]) {

            bat '''
              @py -3 scripts/remote_deploy_existing.py ^
              --credentials-file "%SSH_JSON%" ^
              --known-hosts "%LIFE_PLANNING_KNOWN_HOSTS%" ^
              --release "%RELEASE%"
            '''
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