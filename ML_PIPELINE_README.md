# 🤖 ML Pipeline Architecture & Components

## Overview

The ML pipeline is the intelligence engine of ResumeIQ. It extracts skills from resumes and matches them against a curated dataset of interview questions using semantic similarity + tag-based relevance boosting.

**Pipeline Stages:**
```
Resume (PDF)
    ↓ [PDF Parser]
Raw Text
    ↓ [Section Splitter]
Resume Sections (Education, Experience, Skills)
    ↓ [Section Extractor + NER]
Extracted Skills
    ↓ [Skill Expansion (Ontology)]
Expanded Skills
    ↓ [Profile Builder]
Semantic Profile String
    ↓ [SBERT Embedder]
384-dim Vector
    ↓ [FAISS Indexing]
Top-30 Similar Questions
    ↓ [Tag Matcher]
Tag-Boosted Ranked Questions
    ↓ API Response
Interview Questions (Personalized)
```

---

## 📁 Directory Structure

```
ML_Preprocessor_scripts/
├── README.md                          # This file
├── clean_questions_json.py            # Data cleanup utility
├── extract_text.py                    # Standalone PDF extraction
├── extract_skillset.ipynb             # Jupyter notebook for exploration
│
├── pipeline/                          # Resume processing pipeline
│   ├── __init__.py
│   ├── pdf_parser.py                  # Extract text from PDF
│   ├── section_splitter.py            # Identify resume sections
│   ├── section_extractor.py           # Extract content from sections
│   ├── extract_resume_skills.py       # NER-based skill extraction
│   ├── profile_builder.py             # Create semantic profile
│   └── ontology.py                    # Skill expansion dictionary
│
├── search/                            # Search & ranking engine
│   ├── __init__.py
│   ├── embedder.py                    # SBERT embedding wrapper
│   ├── searcher.py                    # FAISS search + tag boosting
│   ├── tag_matcher.py                 # Tag-based relevance algorithm
│   └── postprocessor.py               # Result formatting
│
├── scripts/                           # Data processing scripts
│   ├── __init__.py
│   └── build_index.py                 # Build FAISS index from Excel/CSV
│
├── tests/                             # Testing & validation
│   ├── __init__.py
│   ├── tests_extraction.py            # End-to-end pipeline test
│   └── test_tag_matching.py           # Tag matching demo
│
└── data/                              # Data storage
    ├── questions.json                 # All interview questions (338)
    ├── questions_backup.json          # Pre-cleanup backup
    ├── questions.index                # FAISS binary index
    └── raw/                           # Source Excel files
        ├── DSA.xlsx                   # ~60 DSA questions
        ├── HTML_CSS.xlsx              # ~80 HTML/CSS questions
        ├── JavaScript.xlsx            # ~80 JS questions
        ├── Operating_Systems.xlsx     # ~50 OS questions
        ├── Networking.xlsx            # ~40 Network questions
        └── Database.xlsx              # ~48 Database questions
```

---

## 🔧 Core Components

### 1. **PDF Parser** (`pipeline/pdf_parser.py`)
**Responsibility:** Extract text from resume PDF files

```python
from pipeline.pdf_parser import extract_text_from_pdf

pdf_path = "resume.pdf"
text = extract_text_from_pdf(pdf_path)
# Returns: Full resume text with line breaks preserved
```

**Technology:** PyMuPDF (fitz) for fast PDF extraction
**Input:** `.pdf` file path
**Output:** String containing all PDF text
**Performance:** ~100ms for 1-page resume, ~500ms for multi-page

---

### 2. **Section Splitter** (`pipeline/section_splitter.py`)
**Responsibility:** Identify and split resume into sections (Education, Experience, Skills, etc.)

```python
from pipeline.section_splitter import split_resume_sections

text = "..."
sections = split_resume_sections(text)
# Returns:
# {
#   "Education": "B.Tech Computer Science...",
#   "Experience": "Senior SDE at Google...",
#   "Skills": "Python, Java, C++...",
#   ...
# }
```

**Technology:** Regex patterns + spaCy NLP for context-aware splitting
**Input:** Full resume text
**Output:** Dict[section_name] → section_text
**Common Sections:** Education, Experience, Skills, Projects, Certifications, Publications, Languages

---

### 3. **Section Extractor** (`pipeline/section_extractor.py`)
**Responsibility:** Extract structured information from each section

```python
from pipeline.section_extractor import extract_section_content

education_text = "B.Tech Computer Science, IIT Delhi, 2021"
extracted = extract_section_content(education_text, section_type="education")
# Returns: Structured data (degree, institution, year)
```

**Technology:** Regex + spaCy NER (Named Entity Recognition)
**Input:** Section text
**Output:** List of structured items or concatenated text
**Supports:** Extracting companies, years, degrees, certifications

---

### 4. **Skill Extractor** (`pipeline/extract_resume_skills.py`)
**Responsibility:** Extract technical and soft skills using NER

```python
from pipeline.extract_resume_skills import extract_skills

resume_text = "Experienced in Python, Java, Docker, and team leadership"
skills = extract_skills(resume_text)
# Returns: ["Python", "Java", "Docker", "team leadership", ...]
```

**Technology:** spaCy NER with custom skill patterns
**Input:** Resume text
**Output:** Set of identified skills
**Skill Categories:** Languages, Frameworks, Tools, Databases, Concepts, Soft Skills

---

### 5. **Ontology** (`pipeline/ontology.py`)
**Responsibility:** Expand extracted skills to related competencies

```python
from pipeline.ontology import SKILL_ONTOLOGY

# Expand Python → related skills
skills = SKILL_ONTOLOGY.get("Python", [])
# Returns: ["OOP", "Functional", "Async", "Web Frameworks", ...]
```

**Purpose:** Map narrow skills to broader competency areas
**Example Mapping:**
- Java → [OOP, JVM, Multithreading, Collections, Spring, Maven]
- React → [JavaScript, Frontend, Components, Hooks, State Management]
- Docker → [DevOps, Containers, Microservices, Orchestration]

**Structure:** Dict[skill_name] → List[related_skills]

---

### 6. **Profile Builder** (`pipeline/profile_builder.py`)
**Responsibility:** Create a semantic profile string for embedding

```python
from pipeline.profile_builder import build_profile

resume_text = "..."
profile_string, expanded_skills = build_profile(resume_text)
# Returns:
# profile_string: "Python Java Docker microservices cloud AWS agile..."
# expanded_skills: {"Python", "Java", "Docker", "AWS", ...}
```

**Workflow:**
1. Extract skills from resume sections
2. Expand via ontology
3. Combine with project terms, experience terms
4. Create coherent string for SBERT embedding

**Input:** Full resume text
**Output:** (profile_string: str, expanded_skills: set)
**Profile Example:** "10 years Python development AWS microservices Docker Kubernetes cloud architect..."

---

### 7. **Embedder** (`search/embedder.py`)
**Responsibility:** Convert text to 384-dimensional vectors using SBERT

```python
from search.embedder import embed_text

profile_string = "Python Java Docker microservices..."
vector = embed_text(profile_string)
# Returns: np.ndarray of shape (384,)
```

**Technology:** Sentence-Transformers `all-MiniLM-L6-v2`
- **Model Size:** 22M parameters
- **Embedding Dimension:** 384
- **Training Data:** Trained on SNLI + MultiNLI (semantic similarity)
- **Performance:** ~50ms per embedding
- **Quality:** Good balance between speed and quality

**Process:**
- Tokenize input text
- Pass through transformer encoder
- Average pooling over token embeddings
- L2 normalization
- Return 384-dim vector

---

### 8. **Searcher** (`search/searcher.py`)
**Responsibility:** Search FAISS index and rank results with tag boosting

```python
from search.searcher import SemanticSearcher

searcher = SemanticSearcher("data/questions.json", "data/questions.index")

# Basic semantic search
results = searcher.search("Python microservices Docker", top_k=30)

# With tag boosting
results = searcher.search(
    "Python microservices",
    user_skills=["Python", "Docker", "AWS"],
    use_tag_boosting=True,
    top_k=30
)

# With explanations
results = searcher.search_with_explanations(
    profile_string="Python microservices Docker",
    user_skills=["Python", "Docker", "AWS"]
)
```

**Workflow:**
1. Load FAISS index (IndexFlatIP)
2. Embed user profile with SBERT
3. Search top-30 similar questions (inner product)
4. Optional: Boost results based on tag overlap
5. Return ranked questions with scores

**Input:**
- `profile_string` or `question_string`: Text to search
- `user_skills`: List of user's skills (for tag boosting)
- `top_k`: Number of results (default: 30)
- `use_tag_boosting`: Enable tag-based reranking (default: True)

**Output:** List of result dicts:
```python
{
    "sr no": 42,
    "topic": "DSA",
    "question": "Implement LRU Cache...",
    "difficulty": "Hard",
    "tags": ["hash-map", "linked-list", "lru", "cache"],
    "score": 0.87,           # Semantic similarity (0-1)
    "tag_score": 0.65,       # Tag overlap score (0-1)
    "final_score": 0.81      # Combined score (if tag-boosted)
}
```

**Performance:**
- FAISS search: ~100ms for 338 questions
- Tag boosting: ~5ms
- Total: ~105ms

---

### 9. **Tag Matcher** (`search/tag_matcher.py`)
**Responsibility:** Calculate tag-based relevance and boost scores

```python
from search.tag_matcher import TagMatcher

matcher = TagMatcher()

# Calculate tag overlap
user_skills = ["Python", "sorting", "arrays"]
question_tags = ["arrays", "linked-list", "sorting"]
overlap = matcher.calculate_tag_overlap(user_skills, question_tags)
# Returns: 0.67 (2 matches out of 3 user skills)

# Boost results by tags
results = matcher.boost_results_by_tags(
    results=raw_results,
    user_skills=["Python", "arrays", "sorting"],
    tag_weight=0.30  # 70% semantic, 30% tags
)

# Get detailed explanation
explanation = matcher.explain_relevance(result, user_skills)
# Returns: {"semantic_score": 0.85, "tag_overlap": 0.67, ...}
```

**Algorithm:**
- **Tag Overlap:** (matching_tags / total_user_skills)
- **Combined Score:** (semantic_score × 0.70) + (tag_overlap × 0.30)
- **Rationale:** Balance semantic similarity with explicit skill matches

**Performance:** O(n) where n = number of results (typically 30)

---

### 10. **Postprocessor** (`search/postprocessor.py`)
**Responsibility:** Format and sort results for API response

```python
from search.postprocessor import format_results, sort_by_difficulty

results = [...]
formatted = format_results(results, include_explanation=True)
sorted_easy = sort_by_difficulty(results, difficulty_order=["Easy", "Medium", "Hard"])
```

---

## 📊 Data Format

### questions.json Structure
```json
[
  {
    "sr no": 1,
    "topic": "DSA",
    "question": "Implement LRU Cache with O(1) operations",
    "difficulty": "Hard",
    "tags": ["hash-map", "linked-list", "lru", "cache"]
  },
  {
    "sr no": 2,
    "topic": "Python",
    "question": "Explain decorators in Python",
    "difficulty": "Medium",
    "tags": ["decorators", "functions", "metaprogramming"]
  }
]
```

**Fields:**
- `sr no`: Unique question ID (1-338)
- `topic`: Broad category (DSA, Python, HTML, etc.)
- `question`: The actual question text
- `difficulty`: Easy/Medium/Hard (nullable for some questions)
- `tags`: Array of granular topic tags

**Stats:**
- **Total Questions:** 338
- **Topics:** 6 (DSA, Python, JavaScript, HTML/CSS, OS, Networking)
- **Tagged Questions:** ~338 (coverage improved)
- **Difficulty Coverage:** ~100 questions with values (being expanded)

---

## 🔄 Integration with Backend

### Resume Upload & Processing Flow

```
User uploads resume.pdf
    ↓
/api/upload-resume [POST]
    ↓ (Express.js)
middleware/uploadResume.js handles file
    ↓
utils/skillExtractor.js spawns Python subprocess
    ↓
pipeline.profile_builder.build_profile()
    ↓ Returns: (profile_string, skills)
Server stores in DB
    ↓
/api/questions [GET]
    ↓
search/searcher.py.search()
    ↓ FAISS + tag boosting
Returns top-30 personalized questions
    ↓
Frontend displays questions
```

### Node.js Backend Integration

**File:** `server/utils/skillExtractor.js`
```javascript
const { spawn } = require('child_process');

function extractSkills(resumePath) {
  return new Promise((resolve, reject) => {
    const python = spawn('python3', [
      'ML_Preprocessor_scripts/pipeline/profile_builder.py',
      resumePath
    ]);
    
    python.stdout.on('data', (data) => {
      resolve(JSON.parse(data.toString()));
    });
  });
}
```

---

## 🚀 Usage Examples

### 1. **End-to-End: Resume → Questions**
```python
from pipeline.pdf_parser import extract_text_from_pdf
from pipeline.profile_builder import build_profile
from search.searcher import SemanticSearcher

# Step 1: Parse resume
resume_text = extract_text_from_pdf("my_resume.pdf")

# Step 2: Build profile
profile_string, user_skills = build_profile(resume_text)

# Step 3: Search questions
searcher = SemanticSearcher("data/questions.json", "data/questions.index")
questions = searcher.search_with_explanations(profile_string, user_skills)

# Step 4: Display results
for q in questions[:10]:
    print(f"Q: {q['question']}")
    print(f"Difficulty: {q['difficulty']}")
    print(f"Score: {q['score']:.2f}")
    print()
```

### 2. **Build/Rebuild Index**
```bash
python ML_Preprocessor_scripts/scripts/build_index.py
# Reads from: data/raw/*.xlsx and data/raw/*.csv
# Creates: data/questions.json + data/questions.index
```

### 3. **Clean Corrupted Data**
```bash
python ML_Preprocessor_scripts/clean_questions_json.py
# Removes garbage keys
# Creates backup: questions_backup.json
```

### 4. **Run Tests**
```bash
cd ML_Preprocessor_scripts
python tests/tests_extraction.py
python tests/test_tag_matching.py
```

---

## 🔍 Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| FAISS index not found | Missing `questions.index` | Run `build_index.py` |
| ImportError: spacy | spaCy not installed | `pip install spacy && python -m spacy download en_core_web_sm` |
| PDF parsing fails | Scanned image PDFs | Use OCR: `pdf2image` + `pytesseract` |
| Low relevance scores | Bad profile string | Check `profile_builder.py` output |
| Garbage columns in JSON | Corrupted Excel headers | Run `clean_questions_json.py` |
| Tag mismatch | Inconsistent tag format | Verify `build_index.py` parsing logic |

---

## 📈 Performance Metrics

| Operation | Time | Technology |
|-----------|------|------------|
| PDF extraction (1 page) | ~100ms | PyMuPDF |
| Section splitting | ~50ms | Regex + spaCy |
| Skill extraction | ~200ms | spaCy NER |
| Profile building | ~100ms | Ontology lookup |
| SBERT embedding | ~50ms | Sentence-Transformers |
| FAISS search (338 questions) | ~100ms | FAISS IndexFlatIP |
| Tag boosting | ~5ms | Custom algorithm |
| **Total end-to-end** | **~600ms** | All components |

---

## 🔐 Data Privacy

- Resumes stored temporarily in `user_resumes/` folder
- Deleted after question generation
- Skills extracted but not stored in database
- Questions are public dataset (no PII)

---

## 🚦 Status

**Version:** 2.1 (Post-cleanup)
**Last Updated:** 2024
**Cleanup:** ✅ Garbage keys removed, 338 questions cleaned
**Tag System:** ✅ Implemented with 70/30 semantic+tag weighting
**Production Ready:** ⏳ Awaiting difficulty value population + final testing

---

**For questions or modifications, refer to [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md)**
