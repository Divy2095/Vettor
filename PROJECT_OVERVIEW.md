# ResumeIQ - ML-Powered Interview Question Generator

Complete integration of ML pipeline with modern web stack (React + Node.js + MongoDB).

## 🎯 Overview

ResumeIQ analyzes your resume and generates highly relevant interview questions based on:
- **Skills Extraction**: Automatically identifies technologies and skills from your resume
- **Semantic Matching**: Uses SBERT embeddings to find contextually relevant questions
- **Tag-Based Ranking**: Prioritizes questions based on your specific skill tags
- **Difficulty Levels**: Generates questions across Easy, Medium, and Hard levels

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        ResumeIQ Stack                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Frontend (React + Vite)     Backend (Express.js)           │
│  ├─ Resume Upload            ├─ Resume Processing API      │
│  ├─ Questions Display        ├─ ML Pipeline Bridge          │
│  └─ Filtering & Export       └─ Question Retrieval API      │
│                                                               │
│         ↕ HTTP/REST                    ↕ Child Process      │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │          ML Pipeline (Python + SBERT + FAISS)           ││
│  │  ├─ PDF Text Extraction                                 ││
│  │  ├─ Skill Recognition & Expansion                       ││
│  │  ├─ Semantic Search (FAISS)                             ││
│  │  └─ Tag-Based Ranking                                   ││
│  └─────────────────────────────────────────────────────────┘│
│           ↕ Database                                         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │             MongoDB (Session & Questions)                ││
│  └─────────────────────────────────────────────────────────┘│
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Option 1: Docker (Recommended)
```bash
# Clone repository
git clone https://github.com/yourusername/resumeiq.git
cd resumeiq

# Configure environment
cp server/.env.example server/.env
nano server/.env  # Update with your settings

# Build and run
docker-compose up -d

# Access application
# Frontend: http://localhost
# Backend: http://localhost:3000
# API Docs: See API_DOCUMENTATION.md
```

### Option 2: Local Development
```bash
# Backend
cd server
npm install
npm run dev

# Frontend (new terminal)
cd client
npm install
npm run dev

# ML Pipeline (new terminal)
cd ML_Preprocessor_scripts
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm
python scripts/build_index.py

# Access application
# Frontend: http://localhost:5173
# Backend: http://localhost:3000
```

## 📁 Project Structure

```
resumeiq/
├── client/                     # React Frontend (Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── ResumeUploadCard.jsx       # Upload UI
│   │   │   ├── QuestionsDisplay.jsx       # Questions UI
│   │   │   └── AdminRoute.jsx             # Auth protection
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── LandingPage.jsx
│   │   │   ├── AuthPage.jsx
│   │   │   └── AdminPanel.jsx
│   │   ├── contexts/
│   │   │   └── ThemeContext.jsx
│   │   ├── lib/
│   │   │   ├── auth.js
│   │   │   └── utils.js
│   │   └── App.jsx
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
│
├── server/                     # Express.js Backend
│   ├── src/
│   │   ├── utils/
│   │   │   └── mlPipelineService.js      # Python ML bridge
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   ├── Question.js
│   │   │   └── UserSession.js            # Session storage
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── questionController.js
│   │   │   └── resumeController.js       # Resume processing
│   │   ├── routes/
│   │   │   ├── authRoutes.js
│   │   │   ├── questionRoutes.js
│   │   │   ├── resumeRoutes.js           # Resume endpoints
│   │   │   └── index.js
│   │   ├── middleware/
│   │   │   ├── authenticate.js
│   │   │   ├── authorize.js
│   │   │   ├── uploadResume.js
│   │   │   └── errorHandler.js
│   │   └── app.js
│   ├── Dockerfile
│   ├── test-integration.js
│   ├── .env.example
│   └── package.json
│
├── ML_Preprocessor_scripts/    # Python ML Pipeline
│   ├── pipeline/
│   │   ├── extract_resume_skills.py     # Skill extraction
│   │   ├── profile_builder.py           # Profile generation
│   │   ├── section_extractor.py
│   │   ├── pdf_parser.py
│   │   └── ontology.py
│   ├── search/
│   │   ├── searcher.py                  # FAISS search
│   │   ├── embedder.py
│   │   └── postprocessor.py
│   ├── scripts/
│   │   └── build_index.py               # Index building
│   ├── tests/
│   │   └── tests_extraction.py
│   ├── Dockerfile
│   ├── requirements.txt
│   └── data/
│       ├── questions.json               # Pre-built Q bank
│       ├── faiss_index_semantic
│       └── skills_ontology.json
│
├── docker-compose.yml          # Docker orchestration
├── .dockerignore
├── INTEGRATION_SETUP_GUIDE.md   # Setup instructions
├── DOCKER_SETUP_GUIDE.md        # Docker instructions
├── AWS_DEPLOYMENT_GUIDE.md      # AWS deployment
└── README.md                    # This file
```

## 🔌 API Endpoints

All endpoints require authentication (Bearer token in Authorization header).

### Resume Management
```
POST   /api/resume/upload              # Upload resume (returns 202)
GET    /api/resume/status/:sessionId   # Check processing status
GET    /api/resume/questions/:sessionId # Get generated questions
GET    /api/resume/history             # Get session history
DELETE /api/resume/session/:sessionId   # Delete session
GET    /api/resume/questions/:sessionId/export # Download as JSON
```

**Query Parameters for Questions:**
- `page=1` - Page number (default: 1)
- `limit=10` - Questions per page (default: 10)
- `difficulty=Easy|Medium|Hard` - Filter by difficulty
- `topic=DSA|Python|JavaScript|...` - Filter by topic

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for detailed endpoint documentation.

## 🧪 Testing

### Integration Tests
```bash
# Start all services
docker-compose up -d

# Run integration tests
cd server
npm install --save-dev node-fetch form-data
node test-integration.js

# Expected: 11/11 tests passing
```

### Local Manual Testing
```bash
# Test API endpoint
curl -X POST http://localhost:3000/api/resume/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "resume=@resume.pdf"

# Check status
curl http://localhost:3000/api/resume/status/SESSION_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🌐 Deployment

### AWS Deployment (Production Ready)
See [AWS_DEPLOYMENT_GUIDE.md](./AWS_DEPLOYMENT_GUIDE.md) for complete instructions:
- Elastic Beanstalk for backend
- Lambda for ML pipeline
- S3 for resume storage
- MongoDB Atlas for database
- CloudFront CDN for frontend
- GitHub Actions CI/CD

### Quick AWS Deploy
```bash
# Prerequisites: AWS CLI configured, Elastic Beanstalk CLI

# Initialize application
eb init -p "Node.js 18 running on 64bit Amazon Linux 2" resumeiq

# Create environment
eb create resumeiq-prod

# Deploy
eb deploy
```

## ⚙️ Configuration

### Environment Variables

**Backend (.env)**
```bash
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/resumeiq
JWT_SECRET=your-super-secret-key
JWT_EXPIRE=7d
MAIL_HOST=smtp.gmail.com
MAIL_USER=your-email@gmail.com
MAIL_PASS=your-app-password
AWS_S3_BUCKET=resumeiq-resumes  # Optional
AWS_REGION=us-east-1             # Optional
```

**Frontend (.env)**
```bash
VITE_API_URL=http://localhost:3000/api
VITE_ENV=development
```

**ML Pipeline (.env)**
```bash
PYTHONUNBUFFERED=1
PDF_MAX_SIZE=5242880
PROCESSING_TIMEOUT=30
FAISS_INDEX_PATH=./data/faiss_index_semantic
QUESTIONS_BANK_PATH=./data/questions.json
```

## 📊 Performance Metrics

**Expected Response Times:**
| Operation | Time | Notes |
|-----------|------|-------|
| Resume Upload | 100-200ms | File transfer only |
| Resume Processing | 30-60s | Background async |
| Status Check | 50-100ms | DB query |
| Questions Retrieval | 100-300ms | Paged query |
| Export to JSON | 150-400ms | JSON generation |

**System Requirements:**
- **Minimum**: 2 CPU, 2GB RAM, 10GB disk
- **Recommended**: 4 CPU, 4GB RAM, 20GB disk
- **Production**: 8+ CPU, 8GB RAM, 100GB disk (auto-scaling)

## 🔒 Security

- JWT-based authentication
- Password hashing with bcrypt
- Input validation & sanitization
- CORS protection
- Rate limiting on sensitive endpoints
- SQL injection prevention (MongoDB)
- XSS protection
- CSRF tokens for state-changing operations
- Environment variable configuration
- No hardcoded secrets

See [SECURITY.md](./SECURITY.md) for detailed security guidelines.

## 🐛 Troubleshooting

### Backend Issues
```bash
# View logs
docker-compose logs -f backend

# Check database connection
docker-compose exec backend node -e "
  const mongoose = require('mongoose');
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected'))
    .catch(e => console.error(e));
"
```

### Frontend Issues
```bash
# Clear cache
rm -rf node_modules package-lock.json
npm install

# Check API connectivity
curl http://localhost:3000/api/health
```

### ML Pipeline Issues
```bash
# Check Python environment
docker-compose exec ml_pipeline python --version

# Verify model download
docker-compose exec ml_pipeline python -c "
  import spacy
  spacy.load('en_core_web_sm')
  print('Models OK')
"

# Rebuild FAISS index
docker-compose exec ml_pipeline python scripts/build_index.py
```

See [INTEGRATION_SETUP_GUIDE.md](./INTEGRATION_SETUP_GUIDE.md) for comprehensive troubleshooting.

## 📚 Documentation

- [Setup Guide](./INTEGRATION_SETUP_GUIDE.md) - Local development setup
- [Docker Guide](./DOCKER_SETUP_GUIDE.md) - Docker deployment
- [AWS Guide](./AWS_DEPLOYMENT_GUIDE.md) - Production AWS deployment
- [API Documentation](./API_DOCUMENTATION.md) - Detailed API reference
- [ML Pipeline](./ML_Preprocessor_scripts/README.md) - ML components
- [Backend](./server/README.md) - Backend services
- [Frontend](./client/README.md) - Frontend components

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## 📝 License

This project is licensed under the MIT License - see [LICENSE](./LICENSE) file for details.

## 👥 Authors

- **[Your Name]** - Full stack development
- **[Team Members]** - ML engineering, DevOps

## 🙏 Acknowledgments

- SBERT for semantic search: https://www.sbert.net/
- FAISS for efficient similarity search: https://github.com/facebookresearch/faiss
- spaCy for NLP: https://spacy.io/
- React for frontend: https://react.dev/
- Express.js for backend: https://expressjs.com/

## 📞 Support

- **Issues**: Open GitHub issue
- **Discussions**: GitHub Discussions
- **Email**: support@resumeiq.com
- **Discord**: [Join our Discord](https://discord.gg/resumeiq)

## 🗺️ Roadmap

- [ ] Advanced filtering (company, industry)
- [ ] Mock interview feature
- [ ] Interview performance tracking
- [ ] Community question contributions
- [ ] Mobile app (React Native)
- [ ] AI-powered mock interviews
- [ ] Resume scoring & optimization
- [ ] LinkedIn integration
- [ ] Real-time collaboration
- [ ] Premium analytics dashboard

## 📈 Statistics

- **Questions**: 1000+ curated questions
- **Skills**: 500+ identified technologies
- **Models**: SBERT embeddings + spaCy NLP
- **Coverage**: 15+ programming languages and frameworks
- **Difficulty Levels**: Easy, Medium, Hard

---

**Version**: 1.0.0  
**Last Updated**: May 1, 2024  
**Status**: Production Ready ✅

[⬆ Back to Top](#resumeiq---ml-powered-interview-question-generator)
