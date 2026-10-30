# 🛠️ Development Guide & How to Extend the Pipeline

## Overview

This guide explains how to modify, extend, and maintain the ML pipeline. It's for developers who need to:
- Add new features to the pipeline
- Fix bugs or improve performance
- Integrate with new systems
- Deploy to production

---

## 1. Understanding the Architecture

### High-Level Flow

```
User Resume (PDF)
    ↓
upload-resume API
    ↓
skillExtractor.js (Node.js)
    ↓ spawns child process
Python subprocess: pipeline/profile_builder.py
    ↓ Runs complete pipeline
Returns: (profile_string, skills_json)
    ↓
Server stores in database
    ↓
Frontend calls GET /api/questions
    ↓
Backend calls Python search engine
    ↓
Python: search/searcher.py with FAISS + tag boosting
    ↓ Returns top-30 ranked questions
JSON response to frontend
    ↓
Frontend displays interview questions
```

### Key Decision Points

1. **Python vs Node.js?**
   - Use **Python** for: NLP, ML, embeddings, FAISS, data processing
   - Use **Node.js** for: API routing, database queries, authentication, file handling

2. **When to use tags vs semantic search?**
   - **Semantic search:** Good for discovering related topics
   - **Tag boosting:** Better for exact skill matches
   - **Combined:** Best results (70% semantic + 30% tags)

3. **FAISS vs Database?**
   - **FAISS:** Fast similarity search (100ms), in-memory
   - **Database:** Persistent storage, filtering, complex queries
   - **Use both:** Load questions from JSON, search with FAISS, return detailed results

---

## 2. File-by-File Modification Guide

### Adding a New Resume Section

**File:** `pipeline/section_splitter.py`

**Current Sections:** Education, Experience, Skills, Projects, etc.

**To Add "Publications" Section:**

```python
# Step 1: Add regex pattern
SECTION_PATTERNS = {
    # ... existing patterns ...
    r'publications?': 'Publications',
    r'conference papers?': 'Publications',
}

# Step 2: Update section extraction
def split_resume_sections(text):
    sections = {}
    # ... existing code ...
    sections['Publications'] = extract_publications(text)
    return sections
```

### Adding New Skill Ontologies

**File:** `pipeline/ontology.py`

**Current Skills:** Python, Java, JavaScript, etc.

**To Add Kubernetes:**

```python
SKILL_ONTOLOGY = {
    # ... existing ...
    "Kubernetes": [
        "Container Orchestration",
        "Microservices",
        "DevOps",
        "Docker",
        "Deployment",
        "Scaling",
        "Service Mesh",
        "StatefulSets",
        "Operators"
    ]
}
```

### Adding New Question Topics

**Files:** `data/raw/*.xlsx`, `scripts/build_index.py`

**To Add "React" Topic:**

1. Create `data/raw/React.xlsx` with columns: sr no, question, topic, difficulty, tags
2. Run builder:
   ```bash
   python scripts/build_index.py
   ```
   The builder will auto-detect and add React questions to questions.json

### Modifying Tag Matching Algorithm

**File:** `search/tag_matcher.py`

**Current Formula:**
```
combined_score = (semantic_score × 0.70) + (tag_overlap × 0.30)
```

**To Change Weights (60% semantic, 40% tags):**

```python
def boost_results_by_tags(self, results, user_skills, tag_weight=0.40):
    semantic_weight = 1.0 - tag_weight  # 0.60
    
    for result in results:
        tag_score = self.calculate_tag_overlap(user_skills, result['tags'])
        semantic_score = result['score']
        
        # Updated formula
        result['final_score'] = (semantic_score × semantic_weight) + (tag_score × tag_weight)
    
    return sorted(results, key=lambda x: x['final_score'], reverse=True)
```

### Changing Embedding Model

**File:** `search/embedder.py`

**Current Model:** `all-MiniLM-L6-v2` (384 dimensions)

**To Use Larger Model (all-MiniLM-L12-v2, 384 dim):**

```python
from sentence_transformers import SentenceTransformer

class Embedder:
    def __init__(self):
        # Change model name here
        self.model = SentenceTransformer('all-MiniLM-L12-v2')
        self.model.eval()
```

**Important:** If changing to different dimension model:
1. Update FAISS index dimension in `build_index.py`
2. Rebuild index: `python scripts/build_index.py`
3. Clear old embeddings cache

### Adding Difficulty Classification

**File:** `scripts/classify_difficulty.py` (New)

**To Auto-assign Difficulty:**

```python
import json
from sklearn.ensemble import RandomForestClassifier
import numpy as np

def classify_difficulty():
    # Load questions with difficulty values (training data)
    with open('data/questions.json') as f:
        questions = json.load(f)
    
    # Separate train/test
    labeled = [q for q in questions if q['difficulty']]
    unlabeled = [q for q in questions if not q['difficulty']]
    
    # Create features (simple: question length, tag count)
    X_train = np.array([
        [len(q['question']), len(q['tags'])]
        for q in labeled
    ])
    
    y_train = np.array([
        {'Easy': 0, 'Medium': 1, 'Hard': 2}[q['difficulty']]
        for q in labeled
    ])
    
    # Train classifier
    clf = RandomForestClassifier(n_estimators=100)
    clf.fit(X_train, y_train)
    
    # Predict for unlabeled
    X_unlabeled = np.array([
        [len(q['question']), len(q['tags'])]
        for q in unlabeled
    ])
    predictions = clf.predict(X_unlabeled)
    
    # Update questions
    difficulty_map = {0: 'Easy', 1: 'Medium', 2: 'Hard'}
    for q, pred in zip(unlabeled, predictions):
        q['difficulty'] = difficulty_map[pred]
    
    # Save
    with open('data/questions.json', 'w') as f:
        json.dump(questions, f, indent=2)
```

---

## 3. Performance Optimization

### Caching Embeddings

**Problem:** Recalculating question embeddings wastes time

**Solution:** Pre-cache all embeddings in questions.json

```python
# In build_index.py, add:

def add_embeddings_to_questions():
    from search.embedder import Embedder
    
    with open('data/questions.json') as f:
        questions = json.load(f)
    
    embedder = Embedder()
    
    for q in questions:
        # Convert back to embedding and store
        vector = embedder.embed_text(q['question'])
        q['embedding'] = vector.tolist()  # numpy to list
    
    with open('data/questions.json', 'w') as f:
        json.dump(questions, f)
```

### Batch Processing Resumes

**Problem:** Processing one resume at a time is slow

**Solution:** Create batch processing endpoint

```python
# In backend API

@app.post('/api/batch-process-resumes')
async def batch_process(files: list):
    results = []
    for file in files:
        profile, skills = await process_resume(file)
        results.append({'profile': profile, 'skills': skills})
    return results
```

### Query Result Caching

**Problem:** Popular queries return same results repeatedly

**Solution:** Cache search results

```python
from functools import lru_cache

@lru_cache(maxsize=1000)
def cached_search(profile_string: str, top_k: int = 30):
    return searcher.search(profile_string, top_k=top_k)
```

---

## 4. Adding New Search Features

### Filtering by Difficulty

**Requirement:** Allow users to filter results by difficulty level

**Implementation:**

```python
# In search/searcher.py

def search(self, profile_string, top_k=30, difficulty_filter=None):
    # Existing search code...
    results = self._faiss_search(profile_string, top_k=50)
    
    # Filter by difficulty if specified
    if difficulty_filter:
        results = [r for r in results if r['difficulty'] == difficulty_filter]
    
    # Return top_k after filtering
    return results[:top_k]
```

### Filtering by Topic

```python
def search(self, profile_string, top_k=30, topic_filter=None):
    results = self._faiss_search(profile_string, top_k=50)
    
    if topic_filter:
        results = [r for r in results if r['topic'] in topic_filter]
    
    return results[:top_k]
```

### Combining Multiple Filters

```python
def search(self, profile_string, top_k=30, filters=None):
    results = self._faiss_search(profile_string, top_k=100)
    
    if filters:
        if 'difficulty' in filters:
            results = [r for r in results if r['difficulty'] == filters['difficulty']]
        if 'topic' in filters:
            results = [r for r in results if r['topic'] in filters['topic']]
        if 'min_tags' in filters:
            results = [r for r in results if len(r['tags']) >= filters['min_tags']]
    
    return results[:top_k]
```

---

## 5. Testing New Features

### Unit Testing

**File:** `tests/test_new_feature.py`

```python
import unittest
from search.searcher import SemanticSearcher

class TestNewFeature(unittest.TestCase):
    
    def setUp(self):
        self.searcher = SemanticSearcher(
            "data/questions.json",
            "data/questions.index"
        )
    
    def test_difficulty_filter(self):
        results = self.searcher.search(
            "array sorting",
            difficulty_filter="Easy"
        )
        
        # Assert all results are Easy
        for result in results:
            self.assertEqual(result['difficulty'], 'Easy')
    
    def test_returns_top_k(self):
        results = self.searcher.search("python", top_k=10)
        self.assertEqual(len(results), 10)

if __name__ == '__main__':
    unittest.main()
```

**Run tests:**
```bash
cd ML_Preprocessor_scripts
python -m pytest tests/test_new_feature.py -v
```

### Integration Testing

```python
def test_end_to_end_with_filters():
    # Load resume
    resume_text = extract_text_from_pdf("test_resume.pdf")
    
    # Build profile
    profile_string, skills = build_profile(resume_text)
    
    # Search with filters
    results = searcher.search(
        profile_string,
        user_skills=list(skills),
        top_k=30,
        difficulty_filter="Medium"
    )
    
    # Assertions
    assert len(results) > 0
    assert all(r['difficulty'] == 'Medium' for r in results)
    assert all(r['score'] > 0.5 for r in results)
```

---

## 6. Debugging Guide

### Enable Debug Logging

```python
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def build_profile(resume_text):
    logger.debug(f"Starting profile build with {len(resume_text)} chars")
    
    sections = split_resume_sections(resume_text)
    logger.debug(f"Found sections: {list(sections.keys())}")
    
    skills = extract_skills(resume_text)
    logger.debug(f"Extracted {len(skills)} skills: {skills}")
    
    expanded = expand_skills(skills)
    logger.debug(f"Expanded to {len(expanded)} skills")
    
    return profile_string, expanded
```

### Inspect Embeddings

```python
from search.embedder import Embedder
import numpy as np

embedder = Embedder()

q1 = "Sort an array"
q2 = "Sort using quicksort"

v1 = embedder.embed_text(q1)
v2 = embedder.embed_text(q2)

# Check similarity
similarity = np.dot(v1, v2)
print(f"Similarity: {similarity:.4f}")  # Should be ~0.9

# Check dimensions
print(f"V1 shape: {v1.shape}")  # Should be (384,)
print(f"V1 norm: {np.linalg.norm(v1):.4f}")  # Should be ~1.0 (L2 normalized)
```

### Test FAISS Index

```python
import faiss
import numpy as np

# Load index
index = faiss.read_index("data/questions.index")
print(f"Index size: {index.ntotal}")
print(f"Index dimension: {index.d}")

# Test search
query = np.random.random((1, 384)).astype('float32')
query = query / np.linalg.norm(query)  # Normalize

distances, indices = index.search(query, k=5)
print(f"Top distances: {distances[0]}")
print(f"Top indices: {indices[0]}")
```

---

## 7. Deployment Checklist

### Pre-Deployment

- [ ] All tests pass
- [ ] No debug print statements
- [ ] Documentation updated
- [ ] Changelog updated
- [ ] Performance benchmarks acceptable
- [ ] No security vulnerabilities

### Deployment Steps

1. **Build Index:**
   ```bash
   python scripts/build_index.py
   ```

2. **Test Pipeline:**
   ```bash
   python tests/tests_extraction.py
   python tests/test_tag_matching.py
   ```

3. **Backup Data:**
   ```bash
   cp data/questions.json data/questions.json.backup
   cp data/questions.index data/questions.index.backup
   ```

4. **Deploy Backend:**
   ```bash
   cd server
   npm install
   npm start
   ```

5. **Deploy Frontend:**
   ```bash
   cd client
   npm install
   npm run build
   vercel --prod
   ```

---

## 8. Common Issues & Solutions

### Issue: "FAISS dimension mismatch"

**Solution:**
```python
# Check dimensions
import faiss
index = faiss.read_index("data/questions.index")
print(index.d)  # Should be 384

# If wrong, rebuild:
python scripts/build_index.py
```

### Issue: "No module named 'faiss'"

**Solution:**
```bash
pip install faiss-cpu
# or for GPU:
pip install faiss-gpu
```

### Issue: "spaCy model not found"

**Solution:**
```bash
python -m spacy download en_core_web_sm
```

### Issue: "PDF parsing takes 30+ seconds"

**Solution:** Check if PDF is scanned (image-based)
```python
from search.pdf_parser import extract_text_from_pdf

text = extract_text_from_pdf("resume.pdf")
if not text or len(text) < 100:
    print("Likely scanned PDF - implement OCR")
```

---

## 9. Version Bump Process

### When to bump version?

- **PATCH (1.5.1 → 1.5.2):** Bug fixes only
- **MINOR (1.5 → 2.0):** New features, backward compatible
- **MAJOR (1.0 → 2.0):** Breaking changes

### Process

1. Update version in `__init__.py`
2. Update `CHANGELOG.md`
3. Run full test suite
4. Create git tag: `git tag v2.1`
5. Push: `git push origin v2.1`

---

## 10. Contributing Guide

### Creating a Feature Branch

```bash
git checkout -b feature/my-new-feature
git push origin feature/my-new-feature
```

### Making Changes

1. Code your feature
2. Add tests
3. Update documentation
4. Update changelog

### Submitting PR

1. Push changes
2. Create pull request with description
3. Link related issues
4. Request review
5. Address feedback

### Merging

Once approved:
```bash
git checkout main
git pull origin main
git merge feature/my-new-feature
git push origin main
```

---

## Reference Documentation

- [ML_PIPELINE_README.md](./ML_PIPELINE_README.md) - Architecture details
- [DATA_STRUCTURE_README.md](./DATA_STRUCTURE_README.md) - Data formats
- [CHANGES_AND_HISTORY.md](./CHANGES_AND_HISTORY.md) - Version history

---

**Last Updated:** 2024  
**Document Version:** 1.0  
**Maintainer:** AI Interview Question Finder Team
