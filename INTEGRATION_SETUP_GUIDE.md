# ResumeIQ ML Pipeline Integration - Setup Guide

## Overview

This guide walks you through setting up and testing the complete ML pipeline integration with the ResumeIQ website.

## Architecture

```
┌─────────────────┐
│   React Client  │
│  (Upload Form)  │
└────────┬────────┘
         │ POST /api/resume/upload
         ▼
┌─────────────────────────────────┐
│  Express Backend (Node.js)      │
│  - resumeController.js          │
│  - resumeRoutes.js              │
└────────┬────────────────────────┘
         │ Child Process
         ▼
┌──────────────────────────────────────┐
│  Python ML Pipeline                  │
│  - PDF extraction                    │
│  - Skill extraction & expansion      │
│  - FAISS semantic search             │
│  - Tag-based ranking                 │
└────────┬─────────────────────────────┘
         │ Stores results
         ▼
┌─────────────────────────────────┐
│  MongoDB (UserSession)          │
│  - Extracted skills             │
│  - Generated questions          │
│  - Status tracking              │
└─────────────────────────────────┘
```

## Prerequisites

### Backend Requirements
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **MongoDB**: Local or Atlas connection string
- **Environment Variables**: `.env` file with:
  ```
  PORT=3000
  MONGODB_URI=your_mongodb_connection
  JWT_SECRET=your_secret_key
  JWT_EXPIRE=7d
  MAIL_HOST=smtp.gmail.com
  MAIL_USER=your_email
  MAIL_PASS=your_password
  ```

### Frontend Requirements
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### ML Pipeline Requirements
- **Python**: 3.9 or higher
- **pip**: Latest version
- **Python Packages**:
  ```
  pypdf==3.17.1
  spacy==3.7.2
  sentence-transformers==2.2.2
  faiss-cpu==1.7.4
  numpy==1.24.3
  ```

## Installation Steps

### 1. Backend Setup

```bash
cd server
npm install

# Create .env file
cp .env.example .env

# Update .env with your configuration
# Edit .env with database credentials, JWT secret, etc.

# Start the backend
npm run dev
# Output should show: "Server running on http://localhost:3000"
```

### 2. Frontend Setup

```bash
cd client
npm install

# Start the frontend (Vite)
npm run dev
# Output should show: "Local: http://localhost:5173"
```

### 3. ML Pipeline Setup

```bash
cd ML_Preprocessor_scripts

# Create Python virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Download spaCy model
python -m spacy download en_core_web_sm

# Verify installation
python -c "import spacy, sentence_transformers, faiss; print('All ML packages installed')"

# Build FAISS index (if not already built)
python scripts/build_index.py

# Verify setup
python pipeline/profile_builder.py --test
```

### 4. Database Setup

```bash
# If using MongoDB Atlas, ensure:
# 1. Create a cluster
# 2. Get connection string
# 3. Add connection string to .env

# If using local MongoDB:
# Install MongoDB: https://docs.mongodb.com/manual/installation/
# Start MongoDB daemon:
mongod
```

## File Structure

```
server/
├── src/
│   ├── utils/
│   │   └── mlPipelineService.js          # Bridges Node.js ↔ Python
│   ├── models/
│   │   └── UserSession.js                # MongoDB schema for results
│   ├── controllers/
│   │   └── resumeController.js           # Business logic
│   ├── routes/
│   │   ├── resumeRoutes.js               # API endpoints
│   │   └── index.js                      # Route mounting
│   └── app.js                            # Express config

client/
├── src/
│   ├── components/
│   │   ├── ResumeUploadCard.jsx          # Upload UI
│   │   └── QuestionsDisplay.jsx          # Questions UI
│   └── App.jsx                           # Routes

ML_Preprocessor_scripts/
├── pipeline/
│   ├── extract_resume_skills.py
│   ├── profile_builder.py
│   ├── section_extractor.py
│   └── ontology.py
├── search/
│   ├── searcher.py
│   └── embedder.py
└── scripts/
    └── build_index.py
```

## API Endpoints

### 1. Upload Resume
```bash
POST /api/resume/upload
Content-Type: multipart/form-data
Authorization: Bearer {token}

Body:
- resume: PDF file (max 5MB)

Response (202 Accepted):
{
  "message": "Resume processing started",
  "sessionId": "507f1f77bcf86cd799439011",
  "estimatedTime": "30-60 seconds"
}
```

### 2. Check Processing Status
```bash
GET /api/resume/status/{sessionId}
Authorization: Bearer {token}

Response (200):
{
  "status": "completed|processing|pending|failed",
  "totalQuestions": 30,
  "processingTime": 45000,
  "errorMessage": null
}
```

### 3. Get Questions
```bash
GET /api/resume/questions/{sessionId}?page=1&limit=10&difficulty=Hard&topic=DSA
Authorization: Bearer {token}

Response (200):
{
  "sessionId": "507f1f77bcf86cd799439011",
  "totalQuestions": 30,
  "page": 1,
  "totalPages": 3,
  "questions": [
    {
      "sr_no": 1,
      "question": "...",
      "difficulty": "Hard",
      "topic": "DSA",
      "tags": ["Array", "DP"],
      "semantic_score": 0.85,
      "tag_score": 0.92,
      "final_score": 0.88
    }
  ],
  "profile": {
    "extracted_skills": ["Python", "JavaScript"],
    "expanded_skills": ["Node.js", "React"]
  }
}
```

### 4. Export Questions
```bash
GET /api/resume/questions/{sessionId}/export
Authorization: Bearer {token}

Response (200):
{
  "profile": {...},
  "questions": [...]
}
```

### 5. Session History
```bash
GET /api/resume/history
Authorization: Bearer {token}

Response (200):
{
  "sessions": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "createdAt": "2024-05-01T10:30:00Z",
      "status": "completed",
      "totalQuestions": 30,
      "processingTime": 45000
    }
  ],
  "total": 5
}
```

## Testing

### Local Testing

#### 1. Start All Services

```bash
# Terminal 1: Backend
cd server
npm run dev

# Terminal 2: Frontend
cd client
npm run dev

# Terminal 3: ML Pipeline Health Check (optional)
cd ML_Preprocessor_scripts
python -c "from pipeline.profile_builder import ProfileBuilder; print('ML Pipeline Ready')"
```

#### 2. Manual Testing via UI

1. Navigate to `http://localhost:5173`
2. Login or sign up
3. Click "Upload Resume" → `/dashboard/upload`
4. Select a PDF file (max 5MB)
5. Wait for processing (2-5 minutes)
6. View generated questions at `/dashboard/questions/{sessionId}`
7. Filter and download questions as needed

#### 3. API Testing with cURL

```bash
# Set variables
TOKEN="your_jwt_token"
SESSION_ID="507f1f77bcf86cd799439011"

# Check status
curl -X GET http://localhost:3000/api/resume/status/$SESSION_ID \
  -H "Authorization: Bearer $TOKEN"

# Get questions
curl -X GET "http://localhost:3000/api/resume/questions/$SESSION_ID?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"

# Export questions
curl -X GET "http://localhost:3000/api/resume/questions/$SESSION_ID/export" \
  -H "Authorization: Bearer $TOKEN" \
  -o questions.json
```

#### 4. Run Integration Test Suite

```bash
cd server

# Install test dependencies
npm install --save-dev node-fetch form-data

# Run tests
node test-integration.js
```

**Expected Output:**
```
[2024-05-01T10:30:00.000Z] [INFO] Starting ResumeIQ Integration Tests
[2024-05-01T10:30:00.100Z] [INFO] API URL: http://localhost:3000/api

[2024-05-01T10:30:00.200Z] [INFO] TEST 1: User Registration
[2024-05-01T10:30:00.500Z] [SUCCESS] PASS: User registered: 507f1f77bcf86cd799439011

[2024-05-01T10:30:00.800Z] [INFO] TEST 2: User Login
[2024-05-01T10:30:01.200Z] [SUCCESS] PASS: User logged in, token: eyJhbGc...

...

[2024-05-01T10:35:00.000Z] [INFO] ===== TEST SUMMARY =====
[2024-05-01T10:35:00.100Z] [SUCCESS] Passed: 11/11
[2024-05-01T10:35:00.200Z] [INFO] ======================
```

### Performance Benchmarks

Expected response times with optimized setup:

| Operation | Time | Notes |
|-----------|------|-------|
| Resume Upload | 100-200ms | Just file transfer |
| Resume Processing | 30-60s | Background processing |
| Status Check | 50-100ms | Database query |
| Questions Retrieval | 100-300ms | Page query |
| Questions Export | 150-400ms | JSON generation |
| Session History | 50-150ms | Recent queries |

## Troubleshooting

### Issue: "Cannot connect to MongoDB"
**Solution:**
1. Check MongoDB connection string in `.env`
2. Ensure MongoDB Atlas IP whitelist includes your IP
3. Verify database exists in MongoDB

### Issue: "ML Pipeline timeout (30 seconds)"
**Solution:**
1. Verify Python environment is set up correctly
2. Check if FAISS index exists: `ls data/faiss_index_*`
3. Increase timeout in `mlPipelineService.js` if needed

### Issue: "Resume file upload fails"
**Solution:**
1. Ensure file size < 5MB
2. Verify file is valid PDF
3. Check server logs for multer errors

### Issue: "Questions not showing semantic scores"
**Solution:**
1. Verify `all-MiniLM-L6-v2` model is downloaded
2. Check FAISS index is built with correct embeddings
3. Run: `python scripts/build_index.py`

### Issue: "Questions with very low scores"
**Solution:**
1. This is normal if resume skills don't match questions
2. The filter prioritizes semantic relevance
3. Try uploading different resume to test

## Production Deployment

See [AWS_DEPLOYMENT_GUIDE.md](./AWS_DEPLOYMENT_GUIDE.md) for:
- AWS Elastic Beanstalk backend deployment
- Lambda + API Gateway for Python ML pipeline
- S3 for resume storage
- CloudFront for frontend CDN
- MongoDB Atlas for database
- CloudWatch monitoring and alerts
- GitHub Actions CI/CD pipeline

## Environment Configuration

### Development (.env)
```
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/resumeiq
JWT_SECRET=dev-secret-key-change-in-production
JWT_EXPIRE=7d
MAIL_HOST=smtp.gmail.com
MAIL_USER=your-email@gmail.com
MAIL_PASS=your-app-password
```

### Production (.env.production)
```
NODE_ENV=production
PORT=8080
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/resumeiq
JWT_SECRET=generate-secure-random-key
JWT_EXPIRE=7d
MAIL_HOST=smtp.gmail.com
MAIL_USER=your-email@gmail.com
MAIL_PASS=your-app-password
AWS_S3_BUCKET=resumeiq-prod-resumes
AWS_REGION=us-east-1
```

## Next Steps

1. ✅ Complete: ML Pipeline Integration
2. ✅ Complete: Frontend Routes
3. ✅ Complete: Integration Test Suite
4. ⏳ TODO: Run integration tests locally
5. ⏳ TODO: Docker containerization
6. ⏳ TODO: AWS deployment
7. ⏳ TODO: Production monitoring setup

## Support & Documentation

- **Backend API Docs**: See `server/README.md`
- **Frontend Docs**: See `client/README.md`
- **ML Pipeline Docs**: See `ML_Preprocessor_scripts/README.md`
- **AWS Deployment**: See `AWS_DEPLOYMENT_GUIDE.md`
- **Integration Tests**: See `server/test-integration.js`

## Key Files Modified/Created

| File | Type | Purpose |
|------|------|---------|
| `server/src/utils/mlPipelineService.js` | Created | Python pipeline bridge |
| `server/src/models/UserSession.js` | Created | Result storage schema |
| `server/src/controllers/resumeController.js` | Created | Business logic |
| `server/src/routes/resumeRoutes.js` | Created | API routes |
| `server/src/routes/index.js` | Modified | Route registration |
| `server/src/app.js` | Modified | File upload config |
| `client/src/components/ResumeUploadCard.jsx` | Created | Upload UI |
| `client/src/components/QuestionsDisplay.jsx` | Created | Questions UI |
| `client/src/App.jsx` | Modified | Route registration |
| `server/test-integration.js` | Created | Integration tests |

## Performance Optimization Tips

1. **Caching**: Enable Redis caching for frequently accessed questions
2. **Background Jobs**: Use Bull/BullMQ for background processing
3. **Database**: Add indexes on `userId`, `status`, `topic`, `difficulty`
4. **S3**: Use S3 Intelligent Tiering for resume storage
5. **Lambda**: Optimize Python function memory allocation (1024-3008 MB)
6. **Frontend**: Implement pagination to limit questions loaded at once

---

**Last Updated**: May 1, 2024  
**Version**: 1.0.0
