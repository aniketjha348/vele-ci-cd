pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    environment {
        TAG = "${env.BUILD_NUMBER ?: 'local'}"
        BACKEND_IMAGE = 'mern-backend'
        FRONTEND_IMAGE = 'mern-frontend'
        BACKEND_PORT = '5000'
        FRONTEND_PORT = '3000'
    }

    stages {
        stage('Checkout') {
            steps {
                deleteDir()
                checkout scm
            }
        }

        stage('Inject Secrets') {
            steps {
                withCredentials([
                    file(credentialsId: 'server_env_file', variable: 'SERVER_ENV_PATH'),
                    file(credentialsId: 'client_env_file', variable: 'CLIENT_ENV_PATH')
                ]) {
                    sh '''
                    echo "Copying server and client env files..."
                    cp "$SERVER_ENV_PATH" ./server/.env
                    cp "$CLIENT_ENV_PATH" ./client/.env
                    
                    # Make files writable (ensure we can modify them)
                    chmod u+w ./server/.env ./client/.env 2>/dev/null || true
                    
                    # Auto-fix: If CLIENT_URLS is missing but CLIENT_URL exists, create CLIENT_URLS
                    if ! grep -q "^CLIENT_URLS=" ./server/.env; then
                        if grep -q "^CLIENT_URL=" ./server/.env; then
                            CLIENT_URL_VALUE=$(grep "^CLIENT_URL=" ./server/.env | cut -d'=' -f2-)
                            PUBLIC_IP="http://20.244.41.209:3000"
                            
                            # Use a safer approach: create temp file and replace
                            if [ "$CLIENT_URL_VALUE" = "http://localhost:3000" ]; then
                                echo "🔧 Auto-fixing: Adding CLIENT_URLS with public IP and localhost"
                                {
                                    cat ./server/.env
                                    echo "CLIENT_URLS=${PUBLIC_IP},${CLIENT_URL_VALUE}"
                                } > ./server/.env.tmp && mv ./server/.env.tmp ./server/.env
                            else
                                echo "🔧 Auto-fixing: Adding CLIENT_URLS with public IP and existing CLIENT_URL"
                                {
                                    cat ./server/.env
                                    echo "CLIENT_URLS=${PUBLIC_IP},${CLIENT_URL_VALUE}"
                                } > ./server/.env.tmp && mv ./server/.env.tmp ./server/.env
                            fi
                            echo "✅ Created CLIENT_URLS in server/.env"
                        else
                            echo "⚠️  WARNING: Neither CLIENT_URLS nor CLIENT_URL found in server/.env"
                        fi
                    fi
                    
                    echo "Verifying server .env file (showing CLIENT_URLS)..."
                    if grep -q "^CLIENT_URLS=" ./server/.env; then
                        echo "✅ CLIENT_URLS found:"
                        grep "^CLIENT_URLS=" ./server/.env
                    else
                        echo "⚠️  WARNING: CLIENT_URLS still not found after auto-fix"
                        echo "Available env vars (first 5 lines):"
                        head -5 ./server/.env
                    fi
                    '''
                }
            }
        }

        stage('Build Images') {
            steps {
                sh '''
                echo "Building Docker images..."
                # Force rebuild without cache to ensure new .env is used
                docker-compose -f docker-compose.yml build --no-cache backend frontend
                '''
            }
        }

        stage('Deploy') {
            steps {
                sh '''
                echo "Redeploying stack..."
                
                # Verify .env file exists and has CLIENT_URLS before deploy
                if [ -f ./server/.env ]; then
                    echo "✅ server/.env file exists"
                    echo "Checking for CLIENT_URLS or CLIENT_URL..."
                    if grep -q "CLIENT_URLS" ./server/.env; then
                        echo "✅ CLIENT_URLS found in server/.env:"
                        grep "CLIENT_URLS" ./server/.env
                    elif grep -q "^CLIENT_URL=" ./server/.env; then
                        echo "⚠️  Found CLIENT_URL (singular) instead of CLIENT_URLS:"
                        grep "^CLIENT_URL=" ./server/.env
                        echo "Consider using CLIENT_URLS for multiple origins"
                    else
                        echo "❌ WARNING: Neither CLIENT_URLS nor CLIENT_URL found in server/.env"
                        echo "First 10 lines of server/.env:"
                        head -10 ./server/.env
                    fi
                else
                    echo "❌ ERROR: server/.env file does not exist!"
                    exit 1
                fi
                
                docker-compose -f docker-compose.yml down --volumes --remove-orphans || true
                # Force recreate containers to pick up new environment variables
                docker-compose -f docker-compose.yml up -d --force-recreate --remove-orphans backend frontend
                '''
            }
        }

        stage('Health Check') {
            steps {
                sh '''
                echo "Waiting for services to become healthy..."
                sleep 10
                curl --fail --retry 5 --retry-connrefused --retry-delay 5 http://127.0.0.1:${BACKEND_PORT:-5000}/api/health
                '''
            }
        }
    }

    post {
        success {
            echo "✅ Deployment completed for build #${env.BUILD_NUMBER}"
        }
        failure {
            echo "❌ Deployment failed for build #${env.BUILD_NUMBER}"
        }
        always {
            sh 'docker-compose -f docker-compose.yml ps'
            sh 'rm -f ./server/.env ./client/.env'
        }
    }
}
