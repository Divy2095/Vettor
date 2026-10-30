# 🚀 AWS Deployment Guide - Complete Integration

## Overview

This guide covers deploying the integrated ResumeIQ application to AWS. The architecture includes:
- **Frontend:** Vercel or CloudFront + S3
- **Backend:** EC2 or Elastic Beanstalk (Node.js)
- **ML Pipeline:** Lambda or EC2 (Python)
- **Database:** MongoDB Atlas (Cloud)
- **Storage:** S3 (Resume storage)
- **CDN:** CloudFront (Static assets)

---

## Architecture Diagram

```
┌─────────────────────────────────────┐
│         Users                       │
└────────────────┬────────────────────┘
                 │
         ┌───────▼────────┐
         │   CloudFront   │
         │   (Cached)     │
         └───────┬────────┘
                 │
     ┌───────────┼──────────────┐
     │           │              │
┌────▼──┐   ┌────▼────┐   ┌────▼────┐
│  S3   │   │Vercel   │   │ ALB/NLB  │
│(Static)   │(React)  │   │Frontend  │
└────────┘  └─────────┘   └────┬─────┘
                               │
                    ┌──────────▼──────────┐
                    │  Elastic Beanstalk  │
                    │   (Node.js Backend) │
                    └──────────┬──────────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
         ┌──────▼─────┐  ┌────▼─────┐  ┌────▼──────┐
         │   Lambda   │  │ EC2 Spot │  │   RDS     │
         │(ML Pipeline)  │(Python) │  │ PostgreSQL│
         └────────────┘  └──────────┘  └───────────┘
                │              │
         ┌──────▼──────────────▼──────┐
         │    MongoDB Atlas (Cloud)    │
         │    (User Sessions, Data)    │
         └─────────────────────────────┘
                │
         ┌──────▼──────┐
         │  S3 Bucket  │
         │ (Resumes)   │
         └─────────────┘
```

---

## Part 1: Infrastructure Setup

### 1.1 Create VPC and Security Groups

```bash
# Create VPC
aws ec2 create-vpc --cidr-block 10.0.0.0/16

# Create Security Group for backend
aws ec2 create-security-group \
  --group-name backend-sg \
  --description "Backend security group" \
  --vpc-id <VPC_ID>

# Allow HTTP/HTTPS/SSH
aws ec2 authorize-security-group-ingress \
  --group-id <SG_ID> \
  --protocol tcp --port 80 --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --group-id <SG_ID> \
  --protocol tcp --port 443 --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --group-id <SG_ID> \
  --protocol tcp --port 22 --cidr <YOUR_IP>/32
```

### 1.2 Create S3 Bucket for Resumes

```bash
# Create S3 bucket
aws s3 mb s3://resumeiq-resumes-production --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket resumeiq-resumes-production \
  --versioning-configuration Status=Enabled

# Block public access
aws s3api put-public-access-block \
  --bucket resumeiq-resumes-production \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# Create lifecycle policy to delete old resumes
aws s3api put-bucket-lifecycle-configuration \
  --bucket resumeiq-resumes-production \
  --lifecycle-configuration file://lifecycle.json
```

**lifecycle.json:**
```json
{
  "Rules": [
    {
      "Id": "DeleteOldResumes",
      "Status": "Enabled",
      "Prefix": "resumes/",
      "ExpirationInDays": 30
    }
  ]
}
```

### 1.3 Setup MongoDB Atlas

```bash
# Create cluster at https://cloud.mongodb.com
# Configuration:
# - Cluster: M5 (optimized)
# - Cloud Provider: AWS
# - Region: Same as your backend
# - Backup: Daily snapshots
# - Replica Set: 3 nodes

# Get connection string
# mongodb+srv://<user>:<password>@cluster.mongodb.net/resumeiq
```

### 1.4 Create RDS Database (Optional - for logs/analytics)

```bash
aws rds create-db-instance \
  --db-instance-identifier resumeiq-postgres \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --allocated-storage 20 \
  --master-username admin \
  --master-user-password <SECURE_PASSWORD> \
  --vpc-security-group-ids <SG_ID> \
  --publicly-accessible false
```

---

## Part 2: Backend Deployment (Elastic Beanstalk)

### 2.1 Prepare Application

```bash
# Create .ebignore
cat > .ebignore << 'EOF'
node_modules/
.git
.gitignore
.env.local
.env.development
*.md
client/
ML_Preprocessor_scripts/node_modules/
EOF

# Create .platform/hooks/postdeploy
mkdir -p .platform/hooks/postdeploy

cat > .platform/hooks/postdeploy/01_setup_python.sh << 'EOF'
#!/bin/bash
set -xe

# Install Python dependencies
cd /var/app/current
pip3 install -r ML_Preprocessor_scripts/requirements.txt
python3 -m spacy download en_core_web_sm

echo "Python setup complete"
EOF

chmod +x .platform/hooks/postdeploy/01_setup_python.sh
```

### 2.2 Create Elastic Beanstalk App

```bash
# Initialize EB
eb init -p node.js-18 resumeiq --region us-east-1

# Create environment
eb create resumeiq-prod \
  --instance-type t3.medium \
  --scale 2 \
  --envvars NODE_ENV=production

# Configure environment
eb setenv \
  DATABASE_URL="mongodb+srv://<user>:<pass>@cluster.mongodb.net/resumeiq" \
  JWT_SECRET="<SECURE_JWT_KEY>" \
  FRONTEND_URL="https://resumeiq.com" \
  AWS_S3_BUCKET="resumeiq-resumes-production" \
  AWS_REGION="us-east-1"

# Deploy
eb deploy
```

### 2.3 Setup Auto-scaling

```bash
# Configure auto-scaling policy
cat > autoscale.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "autoscaling:*",
        "cloudwatch:GetMetricStatistics",
        "cloudwatch:ListMetrics"
      ],
      "Resource": "*"
    }
  ]
}
EOF

# Apply scaling policy
eb scale 4  # Max 4 instances
```

---

## Part 3: ML Pipeline Deployment

### 3.1 Lambda Function Setup (Recommended)

```python
# ml_function.py
import json
import subprocess
import boto3
import os
from pathlib import Path

s3_client = boto3.client('s3')

def lambda_handler(event, context):
    """
    Handle resume processing via Lambda
    Event format:
    {
        "resume_path": "s3://bucket/resumes/user_id/resume.pdf",
        "user_id": "...",
        "session_id": "..."
    }
    """
    
    try:
        # Download resume from S3
        resume_path = download_resume(event)
        
        # Run ML pipeline
        profile_result = run_pipeline(resume_path)
        
        # Upload results to S3
        results_url = upload_results(event, profile_result)
        
        # Update backend with completion
        notify_backend(event, results_url)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Processing complete',
                'resultsUrl': results_url
            })
        }
    
    except Exception as e:
        notify_backend_error(event, str(e))
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

def download_resume(event):
    resume_s3_path = event['resume_path']
    local_path = '/tmp/resume.pdf'
    
    bucket, key = resume_s3_path.replace('s3://', '').split('/', 1)
    s3_client.download_file(bucket, key, local_path)
    
    return local_path

def run_pipeline(resume_path):
    # Import and run Python pipeline
    import sys
    sys.path.insert(0, '/opt/python/lib/python3.9/site-packages')
    
    from profile_builder import build_profile
    from searcher import SemanticSearcher
    
    profile_string, skills = build_profile(resume_path)
    
    searcher = SemanticSearcher(
        '/opt/questions.json',
        '/opt/questions.index'
    )
    
    questions = searcher.search(
        profile_string,
        user_skills=skills,
        use_tag_boosting=True,
        top_k=30
    )
    
    return {
        'profileString': profile_string,
        'skills': skills,
        'questions': questions
    }

def upload_results(event, results):
    bucket = os.environ['S3_RESULTS_BUCKET']
    key = f"results/{event['user_id']}/{event['session_id']}.json"
    
    s3_client.put_object(
        Bucket=bucket,
        Key=key,
        Body=json.dumps(results),
        ContentType='application/json'
    )
    
    return f"s3://{bucket}/{key}"

def notify_backend(event, results_url):
    import requests
    requests.post(
        f"{os.environ['BACKEND_URL']}/api/resume/callback",
        json={
            'sessionId': event['session_id'],
            'status': 'completed',
            'resultsUrl': results_url
        },
        headers={'Authorization': f"Bearer {os.environ['BACKEND_SECRET']}"}
    )

def notify_backend_error(event, error):
    import requests
    requests.post(
        f"{os.environ['BACKEND_URL']}/api/resume/callback",
        json={
            'sessionId': event['session_id'],
            'status': 'failed',
            'error': error
        },
        headers={'Authorization': f"Bearer {os.environ['BACKEND_SECRET']}"}
    )
```

### 3.2 Deploy Lambda

```bash
# Install dependencies
pip install -r requirements.txt -t package/

# Copy function code
cp ml_function.py package/

# Create deployment package
cd package
zip -r ../lambda_function.zip .
cd ..

# Create Lambda function
aws lambda create-function \
  --function-name resumeiq-ml-pipeline \
  --runtime python3.9 \
  --role arn:aws:iam::ACCOUNT_ID:role/lambda-execution-role \
  --handler ml_function.lambda_handler \
  --zip-file fileb://lambda_function.zip \
  --timeout 300 \
  --memory-size 3008 \
  --environment Variables='{ \
    BACKEND_URL=https://api.resumeiq.com, \
    S3_RESULTS_BUCKET=resumeiq-results \
  }'

# Create S3 trigger
aws lambda create-event-source-mapping \
  --event-source-arn arn:aws:s3:::resumeiq-resumes-production \
  --function-name resumeiq-ml-pipeline
```

### 3.3 Alternative: EC2 Instance for Python

```bash
#!/bin/bash
# setup_python_ec2.sh

# Update system
sudo yum update -y
sudo yum install -y python3 python3-pip git

# Clone repository
cd /opt
sudo git clone <YOUR_REPO> resumeiq
cd resumeiq

# Install Python dependencies
pip3 install -r ML_Preprocessor_scripts/requirements.txt
python3 -m spacy download en_core_web_sm

# Setup systemd service
sudo tee /etc/systemd/system/ml-pipeline.service > /dev/null << EOF
[Unit]
Description=ResumeIQ ML Pipeline Service
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/opt/resumeiq
ExecStart=/usr/bin/python3 ml_service.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable ml-pipeline
sudo systemctl start ml-pipeline
```

---

## Part 4: Frontend Deployment

### 4.1 Deploy to Vercel

```bash
cd client

# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Configure environment variables
vercel env add VITE_API_URL https://api.resumeiq.com
vercel env add VITE_APP_URL https://resumeiq.com
```

### 4.2 Alternative: CloudFront + S3

```bash
# Build React app
npm run build

# Upload to S3
aws s3 sync dist/ s3://resumeiq-frontend-production --delete

# Create CloudFront distribution
aws cloudfront create-distribution --distribution-config file://distribution.json
```

**distribution.json:**
```json
{
  "CallerReference": "resumeiq-2024",
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 1,
    "Items": [{
      "Id": "S3",
      "DomainName": "resumeiq-frontend-production.s3.amazonaws.com",
      "S3OriginConfig": {}
    }]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3",
    "ViewerProtocolPolicy": "redirect-to-https",
    "ForwardedValues": {
      "QueryString": false,
      "Cookies": {"Forward": "none"}
    }
  },
  "Enabled": true,
  "ViewerCertificate": {
    "AcmCertificateArn": "arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/ID",
    "SslSupportMethod": "sni-only"
  }
}
```

---

## Part 5: Monitoring & Logging

### 5.1 CloudWatch Setup

```bash
# Create log group
aws logs create-log-group --log-group-name /aws/resumeiq/backend

# Create metric alarms
aws cloudwatch put-metric-alarm \
  --alarm-name resumeiq-high-cpu \
  --alarm-description "Alert when CPU > 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/EC2 \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold

# Setup SNS notifications
aws sns create-topic --name resumeiq-alerts
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT_ID:resumeiq-alerts \
  --protocol email \
  --notification-endpoint admin@resumeiq.com
```

### 5.2 Application Insights

```javascript
// In backend app.js
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());
```

---

## Part 6: CI/CD Pipeline

### 6.1 GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy to AWS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Deploy Backend
        run: |
          cd server
          eb deploy resumeiq-prod
      
      - name: Deploy Frontend
        run: |
          cd client
          npm run build
          aws s3 sync dist/ s3://resumeiq-frontend-production --delete
          aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"
```

---

## Part 7: Production Environment Variables

```bash
# .env.production
NODE_ENV=production
PORT=3000

# Database
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/resumeiq

# JWT
JWT_SECRET=<SECURE_RANDOM_KEY>
JWT_EXPIRY=7d

# Email (SendGrid)
SENDGRID_API_KEY=<KEY>
SENDGRID_FROM_EMAIL=noreply@resumeiq.com

# AWS
AWS_REGION=us-east-1
AWS_S3_BUCKET=resumeiq-resumes-production
AWS_ACCESS_KEY_ID=<KEY>
AWS_SECRET_ACCESS_KEY=<SECRET>

# Frontend
FRONTEND_URL=https://resumeiq.com

# ML Pipeline
ML_SCRIPTS_DIR=/opt/ml_pipeline
PYTHON_EXECUTABLE=/usr/bin/python3

# Monitoring
SENTRY_DSN=<DSN>
DATADOG_API_KEY=<KEY>
```

---

## Part 8: Security Best Practices

### 8.1 Secrets Management

```bash
# Use AWS Secrets Manager
aws secretsmanager create-secret \
  --name resumeiq/prod \
  --description "Production secrets" \
  --secret-string file://secrets.json

# In application
import { SecretsManager } from 'aws-sdk';

const secretsManager = new SecretsManager();
const secret = await secretsManager.getSecretValue({
  SecretId: 'resumeiq/prod'
}).promise();

const credentials = JSON.parse(secret.SecretString);
```

### 8.2 SSL/TLS Certificates

```bash
# Request ACM certificate
aws acm request-certificate \
  --domain-name resumeiq.com \
  --validation-method DNS \
  --region us-east-1

# Attach to ALB
aws elbv2 modify-listener \
  --listener-arn <LISTENER_ARN> \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=<CERT_ARN>
```

### 8.3 DDoS Protection

```bash
# Enable AWS Shield
aws shield create-subscription

# Setup WAF
aws wafv2 create-ip-set \
  --name resumeiq-ip-set \
  --scope REGIONAL \
  --ip-address-version IPV4 \
  --addresses ["1.2.3.4/32"]
```

---

## Part 9: Cost Optimization

### 9.1 Reserved Instances

```bash
# Purchase 1-year reserved instance
aws ec2 purchase-reserved-instances \
  --instance-count 1 \
  --offering-id <OFFERING_ID> \
  --instance-type t3.medium
```

### 9.2 S3 Storage Optimization

```bash
# Setup Intelligent Tiering
aws s3api put-bucket-intelligent-tiering-configuration \
  --bucket resumeiq-resumes-production \
  --id auto-archive \
  --intelligent-tiering-configuration file://config.json
```

---

## Part 10: Scaling Considerations

### 10.1 Database Sharding

```javascript
// MongoDB sharding setup
db.adminCommand({ shardCollection: "resumeiq.userSessions", 
  key: { userId: 1 } })
```

### 10.2 Caching Layer (ElastiCache)

```bash
# Create Redis cluster
aws elasticache create-cache-cluster \
  --cache-cluster-id resumeiq-cache \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --num-cache-nodes 1
```

---

## Deployment Checklist

- [ ] VPC and security groups configured
- [ ] S3 buckets created and secured
- [ ] MongoDB Atlas cluster running
- [ ] Elastic Beanstalk environment created
- [ ] Lambda/Python ML service deployed
- [ ] Frontend deployed to Vercel/CloudFront
- [ ] SSL certificates configured
- [ ] DNS records updated
- [ ] CloudWatch monitoring enabled
- [ ] Backups configured
- [ ] CI/CD pipeline running
- [ ] Load testing completed
- [ ] Security audit passed
- [ ] Documentation updated
- [ ] Team trained on deployment

---

**For detailed AWS pricing, see:** https://calculator.aws/
**For architectural review:** Contact AWS Solutions Architect
