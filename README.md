## 🚀 MERN App Deployment using CI/CD Pipeline (Git, GitHub, Jenkins, Docker)

![Jenkins](https://img.shields.io/badge/CI/CD-Jenkins-blue?logo=jenkins\&logoColor=white)
![Docker](https://img.shields.io/badge/Containerized-Docker-blue?logo=docker\&logoColor=white)
![MERN](https://img.shields.io/badge/Stack-MERN-green?logo=mongodb\&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)

---

### 🧩 **Project Overview**

This project demonstrates a **fully automated CI/CD pipeline** for deploying a **MERN (MongoDB, Express.js, React.js, Node.js)** web application using:

* **Git & GitHub** for version control and source code management
* **Jenkins** as a CI/CD automation server
* **Docker** for containerized deployment on the same server where Jenkins is hosted
* **Webhook** integration between GitHub and Jenkins for automatic pipeline triggers

The setup ensures that every commit or push to the main branch automatically builds, tests, and deploys the MERN app in a Dockerized environment.

---

### 🧱 **Tech Stack**

| Layer                  | Technology                                  |
| ---------------------- | ------------------------------------------- |
| Frontend               | React.js                                    |
| Backend                | Node.js + Express.js                        |
| Database               | MongoDB                                     |
| Version Control        | Git & GitHub                                |
| CI/CD Tool             | Jenkins                                     |
| Containerization       | Docker                                      |
| Deployment Environment | Self-hosted Jenkins Server (Linux / Ubuntu) |

---

### ⚙️ **Architecture Overview**

```
Developer → Git Commit → GitHub Repo → Jenkins Webhook Trigger
        ↓
   Jenkins Pipeline (CI/CD)
        ↓
  Docker Build + Container Deployment
        ↓
  MERN App running on same Jenkins server
```

---

### 🧠 **Key Features**

✅ Continuous Integration and Continuous Deployment (CI/CD)
✅ Dockerized Backend and Frontend
✅ Automated Build and Deploy Pipeline
✅ GitHub Webhook Integration
✅ Real-time Build Logs via Jenkins Console
✅ Zero Manual Deployment Steps

---

### 🛠️ **Setup Instructions**

#### **1. Clone the Repository**

```bash
git clone https://github.com/aniketjha348/vele-ci-cd.git
cd vele-ci-cd
```

---

#### **2. Setup Jenkins Server**

1. Install Jenkins on your server (Ubuntu recommended)

   ```bash
   sudo apt update
   sudo apt install openjdk-17-jdk -y
   wget -q -O - https://pkg.jenkins.io/debian/jenkins.io.key | sudo apt-key add -
   sudo sh -c 'echo deb http://pkg.jenkins.io/debian-stable binary/ > /etc/apt/sources.list.d/jenkins.list'
   sudo apt update
   sudo apt install jenkins -y
   ```

2. Start Jenkins:

   ```bash
   sudo systemctl enable jenkins
   sudo systemctl start jenkins
   ```

3. Access Jenkins:
   `http://<your-server-ip>:8080`

4. Install required Jenkins plugins:

   * Git Plugin
   * Pipeline Plugin
   * Docker Plugin
   * Credentials Binding Plugin

---

#### **3. Configure Jenkins Credentials**

Go to **Manage Jenkins → Credentials → Global → Add Credentials**

* Add GitHub credentials
* Add DockerHub credentials (if pushing images)
* Add environment file secrets if needed

---

#### **4. Jenkins Pipeline Configuration**

Create a **Pipeline Project** in Jenkins and connect it to your GitHub repo.
Example **Jenkinsfile**:

```groovy
pipeline {
    agent any

    environment {
        SERVER_ENV = credentials('server_env_file')
        CLIENT_ENV = credentials('client_env_file')
    }

    stages {
        stage('Clone Repository') {
            steps {
                echo 'Cloning repository...'
                git branch: 'main', url: 'https://github.com/aniketjha348/vele-ci-cd.git'
            }
        }

        stage('Build Docker Images') {
            steps {
                echo 'Building Docker images...'
                sh 'docker compose build'
            }
        }

        stage('Deploy Containers') {
            steps {
                echo 'Deploying application...'
                sh 'docker compose up -d'
            }
        }
    }

    post {
        success {
            echo '✅ Deployment successful!'
        }
        failure {
            echo '❌ Deployment failed!'
        }
    }
}
```

---

#### **5. Docker Configuration**

**docker-compose.yml**

```yaml
version: '3.8'

services:
  backend:
    build: ./server
    container_name: vele-server
    ports:
      - 5000:5000
    env_file:
      - ./server/.env
    depends_on:
      - mongodb

  frontend:
    build: ./client
    container_name: vele-client
    ports:
      - 3000:3000
    env_file:
      - ./client/.env
    depends_on:
      - backend

  mongodb:
    image: mongo
    container_name: vele-db
    ports:
      - 27017:27017
    volumes:
      - mongo_data:/data/db

volumes:
  mongo_data:
```

---

#### **6. GitHub Webhook Setup**

1. Go to your GitHub repository → **Settings → Webhooks → Add webhook**
2. Payload URL → `http://<jenkins-server-ip>:8080/github-webhook/`
3. Content type → `application/json`
4. Trigger → “Just the push event”

Now every time you `git push`, Jenkins automatically builds and deploys your app 🚀

---

### 🧪 **Verification**

Once deployment completes:

* Frontend: [http://your-server-ip:3000](http://your-server-ip:3000)
* Backend API: [http://your-server-ip:5000](http://your-server-ip:5000)




### 📚 **Folder Structure**

```
vele-ci-cd/
├── client/          # React frontend
├── server/          # Node.js backend
├── docker-compose.yml
├── Jenkinsfile
└── README.md
```

---

### 🚧 **Future Enhancements**

* Integrate Nginx reverse proxy for production hosting
* Add SSL (HTTPS) using Let's Encrypt
* Push Docker images to Docker Hub or AWS automatically
* Configure Blue-Green Deployment or Canary releases
* Add automated tests before deployment

---

### 🧑‍💻 **Author**

**Aniket Jha**
📧 [Your Email or LinkedIn]
💼 DevOps Engineer | MERN Developer

---

### 🪪 **License**

This project is licensed under the [MIT License](LICENSE).


