# ML Pipeline Deep Dive - Technical Documentation

## Table of Contents
1. [Architecture](#architecture)
2. [Component Details](#component-details)
3. [Data Flow](#data-flow)
4. [API Design](#api-design)
5. [Performance Optimization](#performance-optimization)
6. [Extension Points](#extension-points)

---

## Architecture

### System Design

The ML pipeline uses a **modular architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────┐
│                   Flask API Server                      │
│         (HTTP REST Interface to ML Pipeline)            │
└────────────────┬──────────────────────────┬─────────────┘
                 │                          │
      ┌──────────▼──────────┐   ┌──────────▼──────────┐
      │  Resume Processing  │   │  Question Ranking   │
      │     Pipeline        │   │     Engine          │
      └──────────┬──────────┘   └──────────┬──────────┘
                 │                          │
      ┌──────────▼──────────────────────────▼──────────┐
      │           Vector Search Index (FAISS)         │
      └──────────┬──────────────────────────┬──────────┘
                 │                          │
      ┌──────────▼──────────┐   ┌──────────▼──────────┐
      │  Skill Ontology DB  │   │  Questions DB       │
      │  (Python dict)      │   │  (JSON file)        │
      └─────────────────────┘   └─────────────────────┘
```

### Key Principles

1. **Modularity**: Each component has a single responsibility
2. **Efficiency**: Lazy loading of large models (SBERT, FAISS)
3. **Scalability**: Stateless Flask service (can be load-balanced)
4. **Transparency**: Detailed logging at each step
5. **Extensibility**: Clear extension points for customization

---

## Component Details

### 1. PDF Parser (`pipeline/pdf_parser.py`)

**Purpose**: Extract text from PDF resumes

**Key Functions**:
- `extract_clean_text(pdf_path: str) -> str`
  - Uses PyMuPDF (fitz) for fast PDF reading
  - Preserves text order (top-to-bottom, left-to-right)
  - Filters out repeated lines (artifacts)
  - Returns cleaned text

**Implementation Details**:
```python
def extract_clean_text(pdf_path: str) -> str:
    text_blocks = []
    
    with fitz.open(pdf_path) as doc:
        for page in doc:
            # Get text blocks sorted by position
            blocks = page.get_text("blocks")
            blocks.sort(key=lambda b: (b[1], b[0]))  # y, then x coordinate
            
            for block in blocks:
                block_text = block[4].strip()
                # Filter out very short blocks (likely noise)
                if len(block_text) < 3:
                    continue
                text_blocks.append(block_text)
    
    raw = "\n".join(text_blocks)
    return _remove_repeated_lines(raw)
```

**Performance**:
- Single page: ~100ms
- Multi-page (3-4 pages): ~300-500ms

**Limitations**:
- Handles only standard PDF layout
- May struggle with heavily formatted PDFs
- Scanned/image-based PDFs require OCR (not implemented)

---

### 2. Section Splitter (`pipeline/section_splitter.py`)

**Purpose**: Identify and extract resume sections

**Key Functions**:
- `split_sections(text: str) -> Dict[str, str]`
  - Identifies sections like Education, Experience, Skills, etc.
  - Returns dictionary with section names as keys
  
**Pattern Matching**:
```python
SECTION_PATTERNS = {
    "education": r"(education|academic|degree|qualification)",
    "experience": r"(experience|employment|work history|professional)",
    "skills": r"(skills|technical skills|competencies|expertise)",
    "projects": r"(project|portfolio|work samples)",
    # ... more patterns
}
```

**Algorithm**:
1. Split text by lines
2. For each line, check if it matches a section pattern
3. Extract lines until next section header
4. Return dictionary of sections

**Robustness**:
- Uses spaCy NLP for context-aware splitting
- Handles variations like "SKILLS", "Skills:", "TECHNICAL SKILLS"
- Returns empty string for missing sections

---

### 3. Section Extractor (`pipeline/section_extractor.py`)

**Purpose**: Extract structured information from sections

**Key Functions**:
```python
extract_from_education(text: str) -> List[str]
extract_from_experience(text: str) -> List[str]
extract_from_projects(text: str) -> List[str]
extract_from_skills(text: str) -> List[str]
```

**Extraction Strategy**:

For **Education**:
- Extract: Degree, Institution, Year, GPA (if present)
- Example: "B.Tech Computer Science, IIT Delhi, 2021" → extract relevant terms

For **Experience**:
- Extract: Company name, position, duration, technologies
- Example: "Senior Software Engineer at Google (2019-2021)" → "Google", "Senior Software Engineer"

For **Projects**:
- Extract: Project names, technologies used, achievements
- Example: "Built ML pipeline in Python and TensorFlow" → "ML pipeline", "Python", "TensorFlow"

For **Skills**:
- Match against SKILLS_DB
- Filter for actual technical skills
- Example: "Expert in Python, Java, and problem-solving" → ["Python", "Java"]

---

### 4. Skill Extractor (`pipeline/extract_resume_skills.py`)

**Purpose**: Identify technical skills using NER and database matching

**Key Components**:

1. **SKILLS_DB**: Curated database of ~500 technical skills
   ```python
   SKILLS_DB = {
       "python": "Python",
       "py": "Python",
       "pytorch": "PyTorch",
       "tensorflow": "TensorFlow",
       # ... more mappings
   }
   ```

2. **Named Entity Recognition**:
   - Uses spaCy for entity extraction
   - Identifies technical terms in text

3. **Fuzzy Matching**:
   - Case-insensitive matching
   - Handles abbreviations (e.g., "py" → "Python")

**Algorithm**:
```python
def extract_skills(text: str, skills_db: dict) -> List[str]:
    extracted = []
    text_lower = text.lower()
    
    # Match against skills database
    for abbrev, skill in skills_db.items():
        if abbrev in text_lower:
            extracted.append(skill)
    
    # Remove duplicates and return
    return list(set(extracted))
```

---

### 5. Skill Expansion (`pipeline/ontology.py`)

**Purpose**: Expand skills to related concepts using ontology

**Key Data Structure**:
```python
SKILL_ONTOLOGY = {
    "python": [
        "OOP",
        "data structures",
        "scripting",
        "list comprehension",
        "decorators",
        # ... more concepts
    ],
    "react": [
        "javascript",
        "hooks",
        "state management",
        "component lifecycle",
        "virtual DOM",
    ],
    # ... more skills
}
```

**Algorithm**:
```python
def expand_skills(skills: List[str]) -> List[str]:
    expanded = set(skills)  # Start with original skills
    
    for skill in skills:
        key = skill.lower().strip()
        if key in SKILL_ONTOLOGY:
            # Add all related concepts
            expanded.update(SKILL_ONTOLOGY[key])
    
    return list(expanded)
```

**Impact**: 
- Input: ["Python", "Docker"] → 2 skills
- Output: ["Python", "OOP", "Data structures", ..., "Docker", "containerization", "DevOps", ...] → 10+ skills
- Enables finding questions about implicit knowledge

---

### 6. Profile Builder (`pipeline/profile_builder.py`)

**Purpose**: Synthesize all extracted information into semantic profile

**Key Function**:
```python
def build_profile(resume_text: str) -> dict:
    # 1. Split and extract
    sections = split_sections(resume_text)
    raw_skills = extract_skills(...)
    project_terms = extract_from_projects(...)
    # ... more extractions
    
    # 2. Expand skills via ontology
    expanded_skills = expand_skills(raw_skills)
    
    # 3. Build profile string (weighted)
    profile_string = (
        f"Technical skills and expertise: {', '.join(expanded_skills)}. "  # Most important
        f"Project experience: {', '.join(project_terms)}. "
        f"Work experience: {', '.join(experience_terms)}. "
        f"Educational background: {', '.join(education_terms)}. "
        f"Profile summary: {', '.join(summary_terms)}. "
        f"Achievements: {', '.join(achievement_terms)}."
    )
    
    return {
        "profile_string": profile_string,
        "raw_skills": raw_skills,
        "expanded_skills": expanded_skills,
        # ... other fields
    }
```

**Why Skills First**:
- Skills are most relevant for interview preparation
- Getting weighted more (appear first in embedding)
- SBERT gives higher weight to early text

---

### 7. SBERT Embedder (`search/embedder.py`)

**Purpose**: Convert text to semantic vectors

**Implementation**:
```python
from sentence_transformers import SentenceTransformer

def embed_text(text: str) -> np.ndarray:
    model = get_model()  # Lazy load "all-MiniLM-L6-v2"
    vector = model.encode(text, normalize_embeddings=True)
    return np.array([vector], dtype="float32")  # shape: (1, 384)
```

**Key Details**:
- **Model**: `sentence-transformers/all-MiniLM-L6-v2`
  - Fast: ~14ms per embedding
  - Accurate: Trained on diverse NLP tasks
  - Compact: 384 dimensions (vs 768+ for larger models)
  - Size: ~450MB (downloaded once)

- **Normalization**: L2 normalized vectors
  - Enables cosine similarity = dot product
  - Faster FAISS search

- **Vocabulary**:
  - Understands technical terms
  - Handles skill synonyms well
  - Example: "React" and "ReactJS" have similar vectors

---

### 8. FAISS Searcher (`search/searcher.py`)

**Purpose**: Find most similar questions using vector search

**Key Functions**:
```python
def search(
    profile_string: str,
    top_k: int = 30,
    min_score: float = 0.25,
    user_skills: list = None,
    use_tag_boosting: bool = False
) -> List[dict]:
    # 1. Embed profile
    resume_vector = embed_text(profile_string)
    
    # 2. Search FAISS index
    distances, indices = _index.search(resume_vector, top_k)
    
    # 3. Convert to results
    results = []
    for score, idx in zip(distances[0], indices[0]):
        if idx == -1 or score < min_score:
            continue
        q = _questions[idx].copy()
        q["similarity_score"] = score
        results.append(q)
    
    # 4. Apply tag boosting if requested
    if use_tag_boosting and user_skills:
        results = boost_results(results, user_skills, tag_weight=0.3)
    
    return results
```

**FAISS Index**:
- **Type**: Flat (exhaustive search)
- **Size**: Can index ~340 questions
- **Search Time**: ~200-300ms for 30 results
- **Distance Metric**: Cosine similarity (on normalized vectors)

**Scaling**:
- For 100K+ questions: Use FAISS IndexHNSW or IndexIVF
- For multi-index: Use FAISS IndexFlatIP with sharding

---

### 9. Tag Matcher (`search/tag_matcher.py`)

**Purpose**: Boost relevance using explicit skill-to-question tags

**Algorithm**:
```python
def boost_results_by_tags(results, user_skills, tag_weight=0.3):
    enhanced = []
    
    for result in results:
        semantic_score = result.get("similarity_score", 0.0)
        question_tags = result.get("tags", [])
        
        # Calculate overlap
        user_skills_lower = {s.lower() for s in user_skills}
        tags_lower = {t.lower() for t in question_tags}
        overlap = len(user_skills_lower & tags_lower) / len(tags_lower)
        
        # Combine scores
        combined = (
            semantic_score * (1 - tag_weight) +
            overlap * tag_weight
        )
        
        result["combined_score"] = combined
        enhanced.append(result)
    
    # Sort by combined score
    return sorted(enhanced, key=lambda x: x["combined_score"], reverse=True)
```

**Weight Tuning**:
- `tag_weight=0.3`: Conservative (70% semantic, 30% tags)
- `tag_weight=0.5`: Balanced (50% each)
- `tag_weight=0.7`: Aggressive (30% semantic, 70% tags)

**Recommendation**: Start with 0.3, adjust based on results

---

### 10. Postprocessor (`search/postprocessor.py`)

**Purpose**: Final result formatting and organization

**Functions**:
```python
def deduplicate(questions: List[dict], max_per_topic: int = 5) -> List[dict]:
    """Remove duplicate questions, limit per topic"""
    seen = {}
    for q in questions:
        topic = q.get("topic", "General")
        if seen.get(topic, 0) < max_per_topic:
            result.append(q)
            seen[topic] = seen.get(topic, 0) + 1
    return result

def group_by_topic(questions: List[dict]) -> Dict[str, List]:
    """Organize questions by topic"""
    grouped = {}
    for q in questions:
        topic = q.get("topic", "General")
        if topic not in grouped:
            grouped[topic] = []
        grouped[topic].append(q)
    return grouped

def sort_by_difficulty(questions: List[dict]) -> List[dict]:
    """Sort by difficulty: Easy → Medium → Hard"""
    order = {"easy": 0, "medium": 1, "hard": 2}
    return sorted(questions, key=lambda q: order.get(q.get("difficulty", "medium").lower(), 1))
```

---

## Data Flow

### Complete End-to-End Processing

```
1. USER INPUT
   └─ Resume PDF (2-4MB file)

2. UPLOAD HANDLER (server/Flask)
   ├─ Save to disk
   ├─ Validate file
   └─ Extract buffer

3. PDF PARSING (Flask /api/extract)
   ├─ Read PDF with PyMuPDF
   ├─ Extract text blocks
   ├─ Remove artifacts
   └─ Returns: raw_text (3-5KB)

4. SECTION SPLITTING
   ├─ Parse raw text
   ├─ Identify sections
   ├─ Extract section text
   └─ Returns: sections dict

5. CONTENT EXTRACTION
   ├─ Extract from Education
   ├─ Extract from Experience
   ├─ Extract from Projects
   ├─ Extract from Skills
   ├─ Extract from Summary
   └─ Returns: extracted terms

6. SKILL EXTRACTION
   ├─ Match against SKILLS_DB
   ├─ NER for additional skills
   ├─ Deduplicate
   └─ Returns: raw_skills list (20-50 skills)

7. SKILL EXPANSION
   ├─ Look up in SKILL_ONTOLOGY
   ├─ Add related concepts
   ├─ Merge all skills
   └─ Returns: expanded_skills (40-100 concepts)

8. PROFILE BUILDING
   ├─ Concatenate all info
   ├─ Order by importance
   ├─ Weight skills first
   └─ Returns: profile_string (500-1000 words)

9. EMBEDDING (Flask /api/search)
   ├─ Load SBERT model (first time: 3-5s)
   ├─ Embed profile string
   ├─ L2 normalize
   └─ Returns: vector (384 dims)

10. VECTOR SEARCH
    ├─ Load FAISS index
    ├─ Cosine similarity
    ├─ Return top-30
    └─ Returns: questions with scores

11. TAG MATCHING
    ├─ Calculate tag overlap
    ├─ Boost scores
    ├─ Re-rank
    └─ Returns: boosted questions

12. RESPONSE
    ├─ Format as JSON
    ├─ Include metadata
    └─ Return to server

13. STORAGE
    ├─ Save to MongoDB
    ├─ Update session status
    ├─ Mark complete
    └─ Returns: sessionId

14. DISPLAY
    ├─ Client polls status
    ├─ Fetch questions
    ├─ Group by topic
    ├─ Sort by difficulty
    └─ Display in UI
```

---

## API Design

### Request/Response Format

All endpoints follow this pattern:

**Request**:
```json
{
  "field1": "value1",
  "field2": ["value2a", "value2b"]
}
```

**Response (Success)**:
```json
{
  "success": true,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "data": {
    "result": "...",
    "metadata": {...}
  }
}
```

**Response (Error)**:
```json
{
  "success": false,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "error": "Error message describing what went wrong"
}
```

### HTTP Status Codes

- **200**: Request successful
- **202**: Request accepted (async processing)
- **400**: Bad request (invalid input)
- **401**: Unauthorized
- **404**: Resource not found
- **500**: Server error
- **503**: ML API unavailable
- **504**: Request timeout

---

## Performance Optimization

### Caching Strategy

1. **Model Caching** (SBERT):
   ```python
   _model = None  # Global cache
   
   def get_model():
       global _model
       if _model is None:
           _model = SentenceTransformer("all-MiniLM-L6-v2")
       return _model
   ```
   - Load once, reuse for all requests
   - Memory: ~450MB
   - First embedding: 3-5 seconds
   - Subsequent: ~14ms

2. **FAISS Index Caching**:
   ```python
   _index = None
   
   def _load_assets():
       global _index
       if _index is None:
           _index = faiss.read_index(INDEX_PATH)
   ```

3. **Questions JSON Caching**:
   - Load entire questions DB into memory
   - ~340 questions × ~1KB each = ~340KB
   - Fast random access via index

### Bottleneck Analysis

1. **SBERT Model Load**: 3-5 seconds (one-time)
2. **SBERT Embedding**: 14ms per text (main bottleneck)
3. **FAISS Search**: 200-300ms for 30 results
4. **Tag Matching**: 50ms for tag overlap calculation
5. **Total**: ~2-5 seconds (minus model load)

### Optimization Tips

1. **Parallel Embedding** (for batch processing):
   ```python
   from sentence_transformers import util
   
   profiles = [profile1, profile2, profile3]
   embeddings = model.encode(profiles)  # Batch encode
   ```

2. **FAISS Index Tuning**:
   - Use IndexHNSW for faster search: ~50ms
   - Trade-off: Higher memory usage

3. **Query Expansion**:
   - Precompute embeddings for common skills
   - Cache popular query vectors

4. **Distributed Search**:
   - Shard questions by topic
   - Search shards in parallel

---

## Extension Points

### 1. Add New Skills to Ontology

Edit `pipeline/ontology.py`:
```python
SKILL_ONTOLOGY = {
    # ... existing skills
    "your_skill": [
        "concept1",
        "concept2",
        "related_skill",
    ],
}
```

Example:
```python
"rust": [
    "systems programming",
    "memory safety",
    "performance",
    "low-level programming",
    "concurrent programming",
]
```

### 2. Add New Questions

Edit `data/questions.json`:
```json
[
  {
    "sr_no": 341,
    "topic": "Rust",
    "question": "Explain Rust's ownership system",
    "difficulty": "Medium",
    "tags": ["Rust", "memory safety"]
  }
]
```

Then rebuild FAISS index:
```bash
python scripts/build_index.py
```

### 3. Customize Section Extraction

Edit `pipeline/section_splitter.py`:
```python
SECTION_PATTERNS = {
    # Add new section types
    "certifications": r"(certification|certified|credential)",
    "publications": r"(published|publication|paper|article)",
}
```

### 4. Adjust Tag Weight

In Flask API call to `/api/search`:
```json
{
  "tag_weight": 0.5
}
```

Higher weight (0.5-0.7): More weight on skill tags
Lower weight (0.1-0.3): More weight on semantic similarity

### 5. Change Embedding Model

Edit `search/embedder.py`:
```python
def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        # Try other models:
        # - "all-mpnet-base-v2" (more accurate, slower, 768-dim)
        # - "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2" (multilingual)
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model
```

**Model Comparison**:
| Model | Speed | Accuracy | Size | Dims |
|-------|-------|----------|------|------|
| MiniLM | Fast | Good | 80MB | 384 |
| MPNet | Slow | Excellent | 420MB | 768 |
| Multilingual | Fast | Good | 470MB | 384 |

### 6. Adjust Search Parameters

In resumeController.js:
```javascript
const questions = await MLPipelineService.searchQuestions(
    profileString,
    expandedSkills,
    50,      // Change top_k from 30 to 50
    0.15     // Change min_score from 0.25 to 0.15
);
```

---

## Monitoring & Debugging

### Logging Levels

Flask API uses standard Python logging:
```python
logger.debug("Detailed info")    # Not shown by default
logger.info("Normal operation")  # Default shown
logger.warning("Be careful")     # Error but recoverable
logger.error("Something failed") # Error occurred
```

View logs:
```bash
tail -f /tmp/ml_api.log
```

### Performance Profiling

```python
import time

start = time.time()
# ... operation ...
duration = time.time() - start
logger.info(f"Operation took {duration*1000:.0f}ms")
```

### Common Issues

1. **Memory Usage**:
   - SBERT model: ~450MB
   - FAISS index: ~20-50MB
   - Questions JSON: ~340KB
   - Total: ~500MB

2. **Slow First Request**:
   - SBERT model loads on first embedding
   - Normal: 3-5 seconds
   - Subsequent requests: <1 second

3. **FAISS Index Corruption**:
   - Symptoms: Search returns wrong results or crashes
   - Solution: Rebuild index
   ```bash
   python scripts/build_index.py
   ```

---

## Future Improvements

1. **Fine-tuning**: Retrain SBERT on interview questions corpus
2. **Active Learning**: Improve ontology based on user feedback
3. **Question Difficulty**: Adapt difficulty based on user performance
4. **Explainability**: Show why each question was recommended
5. **A/B Testing**: Test different ranking algorithms
6. **Multi-language**: Support resumes in multiple languages
7. **Caching**: Redis cache for frequently searched profiles

---

**Last Updated**: January 2024
**Version**: 1.0.0
**Maintainer**: Resume AI Team
