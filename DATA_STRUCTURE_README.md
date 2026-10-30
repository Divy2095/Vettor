# 📋 Data Structure Reference Guide

## Overview

This guide documents the data structures used throughout the ML pipeline, including formats, schemas, and transformations.

---

## 1. questions.json Schema

**Location:** `ML_Preprocessor_scripts/data/questions.json`
**Type:** JSON Array
**Purpose:** Master dataset containing all interview questions
**Size:** ~338 questions

### Schema Definition

```typescript
type Question = {
  "sr no": number,           // Unique ID (1-338)
  "topic": string,           // Category: "DSA" | "Python" | "JavaScript" | "HTML" | "OS" | "Database"
  "question": string,        // The actual question text
  "difficulty": string|null, // Easy | Medium | Hard | null
  "tags": string[]           // Granular topic tags: ["arrays", "sorting", "2-pointers"]
}

type QuestionsData = Question[]
```

### Example Records

```json
{
  "sr no": 1,
  "topic": "DSA",
  "question": "Given an array of integers, find two numbers that add up to a target sum",
  "difficulty": "Easy",
  "tags": ["arrays", "hash-table", "2-pointers"]
}

{
  "sr no": 42,
  "topic": "Python",
  "question": "Explain the difference between @staticmethod and @classmethod decorators",
  "difficulty": "Medium",
  "tags": ["decorators", "oop", "functions", "metaprogramming"]
}

{
  "sr no": 200,
  "topic": "JavaScript",
  "question": "What is event delegation and why is it useful?",
  "difficulty": null,  // Not yet assigned
  "tags": ["dom", "events", "performance"]
}
```

### Field Details

#### `sr no` (Serial Number)
- **Type:** Integer (1-338)
- **Purpose:** Unique identifier for each question
- **Usage:** Index into questions array
- **Constraint:** Must be unique and sequential

#### `topic`
- **Type:** String
- **Values:** "DSA", "Python", "JavaScript", "HTML", "OS", "Database", "Networking"
- **Purpose:** Broad categorization
- **Statistics:**
  - DSA: ~60 questions
  - Python: ~50 questions
  - JavaScript: ~80 questions
  - HTML/CSS: ~80 questions
  - OS: ~50 questions
  - Database: ~48 questions
  - Networking: ~40 questions

#### `question`
- **Type:** String (plain text)
- **Length:** 50-500 characters
- **Format:** Clean English text, no markdown/HTML
- **Example:** "Implement a binary search tree with insert and delete operations"

#### `difficulty`
- **Type:** String | null
- **Values:** "Easy" | "Medium" | "Hard" | null
- **Purpose:** Question complexity level
- **Current Status:** ~100 questions have values, rest are null
- **Distribution (filled):**
  - Easy: ~40%
  - Medium: ~35%
  - Hard: ~25%

#### `tags`
- **Type:** String Array
- **Values:** Granular topic labels
- **Format:** Lowercase, hyphenated (e.g., "2-pointers", "hash-table")
- **Common Tags (DSA):**
  - Data structures: "arrays", "linked-list", "hash-table", "tree", "graph", "stack", "queue"
  - Algorithms: "sorting", "searching", "recursion", "dynamic-programming"
  - Techniques: "2-pointers", "sliding-window", "dfs", "bfs", "greedy", "divide-and-conquer"

- **Common Tags (Python):**
  - "decorators", "generators", "context-managers", "async", "oop", "functional"

- **Common Tags (JavaScript):**
  - "dom", "events", "closures", "prototypes", "async", "promises", "fetch"

- **Common Tags (HTML/CSS):**
  - "semantic-html", "accessibility", "responsive", "css-flexbox", "css-grid", "animations"

---

## 2. Resume Profile Structure

**Created by:** `pipeline/profile_builder.py`
**Used by:** `search/embedder.py` and `search/searcher.py`
**Format:** String + Set

### Structure

```python
type Profile = {
    "profile_string": str,    # Space-separated keywords for embedding
    "expanded_skills": set    # All identified and expanded skills
}
```

### Example

```python
profile_string = "Python Java Docker microservices AWS cloud architect 10 years experience REST API SQL"

expanded_skills = {
    "Python",           # Original
    "OOP",             # Expanded from Python
    "Functional",      # Expanded from Python
    "Java",            # Original
    "JVM",             # Expanded
    "Docker",          # Original
    "Containers",      # Expanded
    "Microservices",   # Original
    "AWS",             # Original
    "Cloud",           # Expanded from AWS
    # ... etc
}
```

### Building Process

```
Resume PDF
    ↓ PDF Parser
Raw Text
    ↓ Section Splitter
Sections = {
    "education": "B.Tech Computer Science, IIT Delhi, 2019",
    "experience": "Senior SDE at Google, 5 years, Python Java Docker",
    "skills": "Python, Java, Docker, AWS, SQL",
    "projects": "Built microservices platform using Docker and Kubernetes"
}
    ↓ Skill Extractor + NER
Extracted Skills = {"Python", "Java", "Docker", "AWS", "SQL", "Kubernetes"}
    ↓ Ontology Expansion
Expanded Skills = {
    "Python", "OOP", "Functional", "Async", "Web Frameworks",
    "Java", "JVM", "Multithreading", "Spring",
    "Docker", "Containers", "Kubernetes", "DevOps",
    "AWS", "Cloud", "EC2", "Lambda", "S3",
    "SQL", "Databases", "Queries", "Optimization"
}
    ↓ Profile Builder
profile_string = "Python OOP Functional Async Java JVM Multithreading Docker Containers Kubernetes AWS Cloud EC2 Lambda SQL Databases"
```

---

## 3. Search Query Format

**Used by:** `search/searcher.py`
**Type:** String or Profile
**Purpose:** Input for semantic search

### Query Types

#### Type 1: Plain Text
```python
query = "I know Python and Docker"
searcher.search(query)
```

#### Type 2: Profile String
```python
profile_string = "Python Java Docker microservices AWS cloud architect"
searcher.search(profile_string)
```

#### Type 3: With Skills (for tag boosting)
```python
searcher.search(
    profile_string="Python microservices",
    user_skills=["Python", "Docker", "AWS"],
    use_tag_boosting=True
)
```

### Query Processing

```
Input Query String
    ↓ SBERT Embedding
384-dimensional vector
    ↓ FAISS Index Search
Top-30 similar questions (by embedding similarity)
    ↓ [Optional] Tag Boosting
Rerank by tag overlap with user skills
    ↓
Final Ranked Results
```

---

## 4. Search Result Format

**Generated by:** `search/searcher.py`
**Consumed by:** Backend API, Frontend
**Type:** List[Dict]

### Result Schema

```typescript
type SearchResult = {
  "sr no": number,
  "topic": string,
  "question": string,
  "difficulty": string | null,
  "tags": string[],
  "score": number,           // Semantic similarity (0-1)
  "tag_score"?: number,      // Tag overlap (0-1) [if tag-boosted]
  "final_score"?: number,    // Combined score (0-1) [if tag-boosted]
  "explanation"?: {          // [if explanations enabled]
    "semantic_match": string,
    "tag_matches": string[],
    "relevance_reason": string
  }
}

type SearchResults = SearchResult[]
```

### Example Result

```json
{
  "sr no": 42,
  "topic": "DSA",
  "question": "Implement a two-pointer algorithm to find pairs with sum equal to target",
  "difficulty": "Medium",
  "tags": ["arrays", "sorting", "2-pointers", "hash-table"],
  "score": 0.89,
  "tag_score": 0.75,
  "final_score": 0.85,
  "explanation": {
    "semantic_match": "Question about 2-pointers which matches 'sorting and arrays' in your profile",
    "tag_matches": ["arrays", "2-pointers"],
    "relevance_reason": "User skills in arrays and 2-pointers match 2 of 4 tags"
  }
}
```

### Score Interpretation

| Score | Meaning |
|-------|---------|
| 0.90+ | Highly relevant, exact skill match |
| 0.75-0.89 | Very relevant, strong topical match |
| 0.60-0.74 | Relevant, good topical match |
| 0.40-0.59 | Somewhat relevant, partial match |
| <0.40 | Low relevance |

---

## 5. Tag Boosting Calculation

**Implemented in:** `search/tag_matcher.py`

### Algorithm

```
For each question Q in results:
    
    tag_overlap = count(user_skills ∩ question_tags) / len(user_skills)
    
    combined_score = (semantic_score × 0.70) + (tag_overlap × 0.30)
    
Sort results by combined_score descending
Return sorted results
```

### Example

```
User Skills: ["Python", "arrays", "sorting"]
Question 1:
  - Tags: ["arrays", "sorting", "2-pointers"]
  - Semantic Score: 0.85
  - Tag Overlap: 2/3 = 0.67
  - Combined: (0.85 × 0.70) + (0.67 × 0.30) = 0.595 + 0.201 = 0.796

Question 2:
  - Tags: ["sorting"]
  - Semantic Score: 0.80
  - Tag Overlap: 1/3 = 0.33
  - Combined: (0.80 × 0.70) + (0.33 × 0.30) = 0.560 + 0.099 = 0.659

Result: Question 1 ranked higher (0.796 > 0.659)
```

---

## 6. FAISS Index Format

**Location:** `ML_Preprocessor_scripts/data/questions.index`
**Type:** Binary FAISS IndexFlatIP
**Purpose:** Fast similarity search
**Dimensions:** 384 (from SBERT embeddings)
**Size:** ~338 questions, ~1.3 MB on disk

### Structure

```
FAISS IndexFlatIP
├── Number of vectors: 338
├── Vector dimension: 384
├── Distance metric: Inner Product (cosine similarity)
├── Data type: float32
└── Vectors: [338 × 384 matrix]
```

### Usage

```python
import faiss
import numpy as np

# Load index
index = faiss.read_index("data/questions.index")

# Search
query_vector = np.array([[...384 floats...]])
distances, indices = index.search(query_vector, k=30)
# Returns:
#   distances: shape (1, 30) - similarity scores
#   indices: shape (1, 30) - question IDs
```

### Rebuilding

```bash
python ML_Preprocessor_scripts/scripts/build_index.py
# Reads: data/questions.json
# Creates: data/questions.index (fresh FAISS index)
```

---

## 7. Embedding Vectors

**Created by:** `search/embedder.py` using Sentence-Transformers
**Model:** `all-MiniLM-L6-v2`
**Dimensions:** 384
**Type:** Float32 numpy array

### Properties

- **Semantic Meaning:** Vectors in 384-dim space where similar texts are close
- **Normalization:** L2-normalized (length = 1.0)
- **Distance Metric:** Cosine similarity (dot product after L2 norm)
- **Range:** [-1, 1] (after normalization)

### Example

```python
from search.embedder import embed_text

text1 = "Sort an array using quicksort"
text2 = "Implement sorting algorithm"
text3 = "How to make pizza"

v1 = embed_text(text1)  # shape: (384,)
v2 = embed_text(text2)  # shape: (384,)
v3 = embed_text(text3)  # shape: (384,)

# Cosine similarity
similarity_1_2 = np.dot(v1, v2)  # ~0.92 (very similar)
similarity_1_3 = np.dot(v1, v3)  # ~0.15 (very different)
```

---

## 8. API Request/Response Format

### POST /api/upload-resume

**Request:**
```
Content-Type: multipart/form-data
Body: resume.pdf (binary file)
```

**Response:**
```json
{
  "success": true,
  "message": "Resume processed successfully",
  "userId": "user123",
  "profileData": {
    "skills": ["Python", "Java", "Docker"],
    "topics": ["DSA", "Python", "Backend"]
  }
}
```

### GET /api/questions?userId=user123

**Request:**
```
Query Parameters:
  - userId: string (required)
  - limit: number (optional, default: 30)
  - difficulty: string (optional: "Easy" | "Medium" | "Hard")
```

**Response:**
```json
{
  "success": true,
  "count": 30,
  "questions": [
    {
      "sr no": 1,
      "topic": "DSA",
      "question": "Implement binary search",
      "difficulty": "Easy",
      "tags": ["arrays", "searching"]
    },
    ...
  ]
}
```

---

## 9. Data Cleanup History

### Pre-Cleanup Issues (Fixed)

**Garbage Keys Removed:**
1. `"if two computers are connected directly using a cross-over cable, can they communicate without ip addresses? why or why not?"`
   - **Reason:** Corrupted Excel column merged into key name
   - **Value:** Always null
   - **Records Affected:** All 338

2. `"questions"`
   - **Reason:** Redundant field (duplicate of "question")
   - **Value:** Always null
   - **Records Affected:** All 338

**Cleanup Date:** 2024
**Backup Location:** `data/questions_backup.json` (pre-cleanup version)
**Script Used:** `clean_questions_json.py`

### Data Quality Issues (Current)

1. **Null Difficulties:** ~240 questions still have `difficulty: null`
   - **Action Plan:** Gradual population via manual review or ML classification
   - **Priority:** Medium

2. **Empty Tags:** ~50 questions have `tags: []`
   - **Action Plan:** Auto-generate from question text using NLP
   - **Priority:** High

3. **Inconsistent Tag Formatting:** Some tags use spaces, others use hyphens
   - **Action Plan:** Normalize all tags to lowercase-hyphenated format
   - **Priority:** Medium

---

## 10. Data Statistics

```
Total Questions:              338
By Topic:
  - DSA:                      60 (17.8%)
  - Python:                   50 (14.8%)
  - JavaScript:               80 (23.7%)
  - HTML/CSS:                 80 (23.7%)
  - OS:                       50 (14.8%)
  - Database:                 48 (14.2%)
  - Networking:               40 (11.8%)

Difficulty Distribution:
  - Easy:                     ~40 (11.8%)
  - Medium:                   ~35 (10.4%)
  - Hard:                     ~25 (7.4%)
  - Null:                     ~238 (70.4%)

Tags:
  - Avg tags per question:    3.2
  - Total unique tags:        ~120
  - Questions with 0 tags:    ~50 (14.8%)
  - Questions with 5+ tags:   ~80 (23.7%)

Total Records (Cleaned):      338
Valid Records:                338 (100%)
Corrupted Records:            0
Backup Records:               338
```

---

## 11. Transformation Pipeline

```
RAW EXCEL SOURCES
│
├── DSA.xlsx (60 rows)
├── Python.xlsx (50 rows)
├── JavaScript.xlsx (80 rows)
├── HTML_CSS.xlsx (80 rows)
├── OS.xlsx (50 rows)
├── Database.xlsx (48 rows)
└── Networking.xlsx (40 rows)
│
↓ [scripts/build_index.py] Pandas read_excel/read_csv
│
INTERMEDIATE: Pandas DataFrame (338 rows × 5 columns)
│
↓ [Validation & Cleaning]
  - Remove garbage columns
  - Normalize data types
  - Parse tags from strings to arrays
│
↓ [Encoding]
│
questions.json (338 records, valid schema)
│
↓ [Embedding]
  Each question embedded with SBERT (all-MiniLM-L6-v2)
│
↓ [Indexing]
│
questions.index (FAISS IndexFlatIP, 338 × 384 vectors)
```

---

## Reference

- **Current Version:** 2.1 (Post-cleanup)
- **Last Updated:** 2024
- **Schema Valid:** ✅ Yes
- **Data Valid:** ✅ Mostly (except nulls & empty tags)
- **Index Valid:** ✅ Yes

**Next Steps:** Populate missing difficulties, fill empty tags, then ready for production.
