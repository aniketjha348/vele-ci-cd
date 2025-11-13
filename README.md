# Vele - Anonymous Random Chat & Video Platform

**Meet, Match, and Talk – The Future of Random Connections**

Vele is a full-stack anonymous random chat and video platform built with Next.js, Node.js, Express, and MongoDB. This project includes a complete CI/CD pipeline using Jenkins and Docker for automated deployment.

## 🚀 Project Overview

Vele enables users to:
- **Random Matching**: Connect with strangers for anonymous conversations
- **Video Chat**: Real-time video communication using WebRTC
- **Text Chat**: Secure messaging with content moderation
- **Gamification**: Achievements, rewards, and spin wheel features
- **Subscriptions**: Premium features with payment integration (Razorpay/Stripe)
- **Admin Panel**: User management and moderation tools

## 🏗️ Tech Stack

### Frontend
- **Framework**: Next.js 14 (React 18)
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Real-time**: Socket.io Client
- **Video**: Simple Peer (WebRTC)
- **Animations**: Framer Motion
lol lol fhfhf uugufy dy 
### Backend
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose

- **Real-time**: Socket.io
- **Authentication**: JWT
- **Payments**: Razorpay, Stripe
- **Security**: Helmet, CORS, Rate Limiting

### DevOps
- **CI/CD**: Jenkins
- **Containerization**: Docker & Docker Compose
- **Orchestration**: Docker Compose

## 📁 Project Structure

```
vele/
├── client/                 # Next.js frontend application
│   ├── src/
│   │   ├── app/           # Next.js app router pages
│   │   ├── components/    # React components
│   │   ├── lib/           # API utilities
│   │   └── store/         # Zustand state management
│   ├── Dockerfile         # Frontend container config
│   └── package.json
├── server/                 # Express backend API
│   ├── src/
│   │   ├── routes/        # API routes
│   │   ├── socket/        # Socket.io handlers
│   │   ├── models/        # MongoDB models
│   │   ├── middleware/    # Express middleware
│   │   └── utils/         # Utility functions
│   ├── Dockerfile         # Backend container config
│   └── package.json
├── docker-compose.yml      # Multi-container orchestration
├── Jenkinsfile            # CI/CD pipeline definition
└── README.md
```

## 🐳 Docker Setup

### Prerequisites
- Docker Desktop installed
- Docker Compose installed

### Services

The application runs in 3 containers:

1. **Frontend** (`vele-client`)
   - Port: `3000`
   - Serves static Next.js build

2. **Backend** (`vele-server`)
   - Port: `5000`
   - Express API server

3. **MongoDB** (`mongodb`)
   - Default MongoDB port
   - Database service

### Running with Docker Compose

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Rebuild and restart
docker-compose up -d --build
```

### Environment Variables

Create `.env` files in both `client/` and `server/` directories:

**`server/.env`**
```env
PORT=5000
NODE_ENV=production
MONGODB_URI=mongodb://mongodb:27017/vele
JWT_SECRET=your-secret-key-change-this-in-production
CLIENT_URLS=http://localhost:3000
```

**Note**: In Docker, use `mongodb://mongodb:27017/vele` (service name). For local development, use `mongodb://localhost:27017/vele`.

**`client/.env`**
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

## 🔄 Jenkins CI/CD Pipeline

### Pipeline Overview

The Jenkins Declarative pipeline (`Jenkinsfile`) orchestrates the following steps:
1. **Checkout** – Cleans the workspace and pulls the latest commit from GitHub.
2. **Inject Secrets** – Downloads the server/client `.env` files from Jenkins credentials and writes them into the workspace.
3. **Build Images** – Runs `docker-compose build` to produce fresh backend and frontend images (tagged with the Jenkins build number).
4. **Deploy** – Recreates the stack via `docker-compose down ... up -d` and only brings up the backend and frontend services.
5. **Health Check** – Waits for the API to boot and calls `GET /api/health` to ensure the deployment succeeded.

### Jenkinsfile Highlights

```groovy
pipeline {
  environment {
    TAG = "${env.BUILD_NUMBER ?: 'local'}"
    BACKEND_IMAGE = 'mern-backend'
    FRONTEND_IMAGE = 'mern-frontend'
  }
  stages {
    stage('Inject Secrets') {
      withCredentials([file(credentialsId: 'server_env_file', ...), file(credentialsId: 'client_env_file', ...)]) {
        sh 'cp "$SERVER_ENV_PATH" server/.env && cp "$CLIENT_ENV_PATH" client/.env'
      }
    }
    stage('Build Images') {
      sh 'docker-compose -f docker-compose.yml build backend frontend'
    }
    stage('Deploy') {
      sh '''
        docker-compose -f docker-compose.yml down --volumes --remove-orphans || true
        docker-compose -f docker-compose.yml up -d --remove-orphans backend frontend
      '''
    }
    stage('Health Check') {
      sh 'curl --fail --retry 5 --retry-delay 5 http://127.0.0.1:${BACKEND_PORT}/api/health'
    }
  }
}
```

### Setting Up Jenkins

1. **Install Jenkins**
   ```bash
   # On Windows (using Chocolatey)
   choco install jenkins
   
   # Or download from https://www.jenkins.io/download/
   ```

2. **Install Required Plugins**
   - Docker Pipeline
   - Docker
   - Git

3. **Configure Jenkins**
   - Go to `Manage Jenkins` → `Configure System`
   - Ensure Docker (and Docker Compose) are available on the agent
   - Add **Secret file** credentials:
     - `server_env_file` → upload the backend `.env` (must include `CLIENT_URLS`, `MONGODB_URI`, `JWT_SECRET`, etc.)
     - `client_env_file` → upload the frontend `.env` with production URLs
   - Configure Git credentials if needed

4. **Create Pipeline Job**
   - New Item → Pipeline
   - Pipeline definition: `Pipeline script from SCM`
   - SCM: Git
   - Repository URL: `https://github.com/aniketjha348/vele-ci-cd.git`
   - Script Path: `Jenkinsfile`

5. **Run Pipeline**
   - Click "Build Now"
   - Monitor build progress in console output

> **Note:** `docker-compose.yml` exposes an optional `mongodb` service behind the `local-db` profile. Jenkins deploys only the backend and frontend containers; to run MongoDB locally use `docker-compose --profile local-db up`.

### Local Jenkins Setup

For local development with Jenkins:

```bash
# Start Jenkins (if using Docker)
docker run -d -p 8080:8080 -p 50000:50000 \
  -v jenkins_home:/var/jenkins_home \
  jenkins/jenkins:lts

# Access Jenkins
# http://localhost:8080
# Initial password: Check logs with `docker logs <container-id>`
```

## 🛠️ Local Development

### Without Docker

**Prerequisites:**
- Node.js 18+ and npm
- MongoDB (local or cloud)

**Setup:**

```bash
# Install dependencies
npm run client:install
npm run server:install

# Start MongoDB (if local)
mongod

# Start backend (in server directory)
cd server
npm run dev

# Start frontend (in client directory)
cd client
npm start
```

### With Docker

```bash
# Build images
docker-compose build backend frontend

# Start services (include --profile local-db if you want the MongoDB container)
docker-compose up -d backend frontend

# Access application
# Frontend: http://localhost:3000
# Backend API: http://localhost:5000
```

## 📝 Available Scripts

### Root Level
```bash
npm run client:install    # Install client dependencies
npm run server:install    # Install server dependencies
npm run client:build      # Build client for production
npm run server:start      # Start production server
npm start                 # Build client and start server
```

### Client (`client/`)
```bash
npm start                 # Start Next.js dev server (port 3000)
npm run build             # Build for production
npm run serve             # Serve production build (from out/)
npm run serve:build       # Serve production build (from build/)
npm test                  # Run tests
npm run lint              # Lint and fix code
```

### Server (`server/`)
```bash
npm start                 # Start production server
npm run dev               # Start development server with nodemon
npm run build             # Compile TypeScript
npm test                  # Run tests
npm run lint              # Lint and fix code
```

## 🔐 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Rate limiting on API endpoints
- Content moderation (bad words filter, NSFW detection)
- CORS protection
- Helmet.js security headers
- Input validation with express-validator

## 📦 Build Outputs

- **Client**: `client/out/` (Next.js static export) and `client/build/` (copied)
- **Server**: `server/dist/` (compiled TypeScript)

All build outputs are ignored in `.gitignore`.

## 🚢 Deployment

### Production Deployment

1. **Prepare Environment**
   - Set up MongoDB (Atlas or self-hosted)
   - Configure environment variables
   - Set strong JWT_SECRET

2. **Build and Deploy**
   ```bash
   # Using Jenkins (automated)
   - Push code to GitHub
   - Jenkins pipeline automatically builds and deploys
   
   # Manual deployment
   docker-compose up -d --build
   ```

3. **Verify Deployment**
   - Check container status: `docker-compose ps`
   - View logs: `docker-compose logs -f`
   - Test endpoints: `curl http://localhost:5000/api/health`

## 🐛 Troubleshooting

### Common Issues

**Port already in use:**
```bash
# Change ports in docker-compose.yml or stop conflicting services
docker-compose down
```

**MongoDB connection failed:**
- Check MongoDB URI in `server/.env`
- Ensure MongoDB container is running: `docker-compose ps`

**Build failures:**
- Clear Docker cache: `docker system prune -a`
- Rebuild: `docker-compose build --no-cache`

**Jenkins pipeline fails:**
- Check Docker is accessible: `docker ps`
- Verify Git repository URL in Jenkinsfile
- Check Jenkins console output for errors

## 📄 License

Private project - All rights reserved

## 👥 Contributors

- Aniket Jha

## 🔗 Links

- **GitHub Repository**: https://github.com/aniketjha348/vele-ci-cd.git
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **API Health Check**: http://localhost:5000/api/health

---

**Built with ❤️ using Next.js, Express, MongoDB, Docker, and Jenkins**

