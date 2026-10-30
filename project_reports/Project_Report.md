# Resume based AI Interview Question Finder — Project Report

## Abstract

This project builds an AI-driven system that ingests a candidate's resume and automatically generates prioritized interview questions tailored to the candidate's experience, skills, and the target job role. The system combines NLP for information extraction, supervised learning and semantic retrieval (vector search) for mapping resume content to question templates and examples, and backend APIs to serve results to a web client. This report documents problem motivation, system architecture, methodology, implementation details, evaluation, limitations, and future work.

## Table of Contents

1. Abstract
2. Introduction
3. Methodology
4. System Design and Architecture
5. Implementation
6. Evaluation and Results
7. Discussion
8. Future Work
9. Appendix

## List of Figures and Tables

- Figure 1: System architecture diagram (see diagrams/architecture.mmd)
- Figure 2: Data pipeline flowchart (see diagrams/data_pipeline.mmd)
- Table 1: Dataset summary and pre-processing steps

## Introduction

### Problem Statement

Recruiters and interviewers need targeted, high-quality interview questions quickly derived from a candidate's resume. Manual question creation is time-consuming and may miss probing topics. This project automates question generation and ranking from resume content to accelerate interview preparation and improve relevance.

### Relevance to AI

The task requires natural language understanding (to parse resumes), semantic similarity (to match skills to question templates), and ranking/selection models to prioritize questions — all classical AI/NLP applications.

### Objectives

- Extract structured entities from resumes (skills, roles, projects, dates).
- Map extracted entities to interview question templates and examples.
- Rank and prioritize questions by relevance, difficulty, and coverage.
- Provide an API and UI to present questions and explanations.

### Scope

This project covers resume ingestion, pre-processing, semantic matching and retrieval, question selection and ranking, and a backend API for serving results. It does not include live interview platforms, but provides integration hooks for downstream systems.

## Methodology

### AI Techniques Used

- NLP: Named-entity recognition (NER), keyphrase extraction, dependency parsing.
- Semantic Embeddings: Transformer-based embeddings (e.g., sentence-transformers) for similarity and retrieval.
- Retrieval: FAISS-based vector index for nearest-neighbor search.
- Ranking: Lightweight supervised or heuristic ranking combining relevance, coverage, and novelty.

### Model Selection

- Embeddings model: Pretrained sentence encoder (e.g., `all-MiniLM` or `sentence-transformers/all-mpnet-base-v2`) — selected for speed/accuracy tradeoff.
- Classifiers (optional): Logistic regression or small MLP for learning question relevance from labeled pairs (resume segment, question) if labeled data is available.

### Algorithms and Mathematical Background

- Vector similarity: cosine similarity between resume segment embedding vector v_r and question template vector v_q.

$$
\text{sim}(v_r, v_q) = \frac{v_r \cdot v_q}{\|v_r\| \; \|v_q\|}
$$

- Score composition: final score = alpha * semantic_sim + beta * difficulty_score + gamma * coverage_penalty.

### Dataset Details

- Source: internal anonymized resumes, synthetic resumes created from public CV templates, and curated question templates.
- Size: typically a few thousand resumes in the development set; the question template bank contains several thousand questions classified by skill/topic/difficulty.
- Pre-processing: PDF/Docx → text extraction, heuristics to segment sections (Experience, Education, Projects), text cleanup, token normalization, skill phrase extraction.

Table 1: Dataset summary

| Item | Count | Notes |
|---|---:|---|
| Resumes | ~3,000 (dev) | Anonymized, varied formats |
| Question templates | ~4,000 | Cover common skills and topics |

### Tools / Libraries

- Python 3.10+
- NLP: spaCy, NLTK, or transformers
- Embeddings: sentence-transformers
- Vector store: FAISS
- Backend: FastAPI / Flask
- DB (optional): SQLite or Postgres for metadata
- Frontend: React (client/ folder)

## System Design and Architecture

### High-level Block Diagram

See `diagrams/architecture.mmd` for the mermaid diagram visualizing frontend → backend → ML services → vector store → results loop.

### Components

- Resume Ingestor: accepts PDF/DOCX/TXT and extracts raw text.
- Preprocessor: section detection, skill extraction, normalization.
- Embedding Service: converts text chunks and questions into dense vectors.
- Vector Index (FAISS): stores question vectors and enables fast retrieval.
- Ranker: composes scores and selects top-k questions.
- API Layer: exposes endpoints for uploading resume and fetching questions.
- Frontend: displays questions, allows feedback (upvote/downvote) for continual improvement.

### Data Pipeline (collection → processing → output)

See `diagrams/data_pipeline.mmd` for flowchart. Pipeline stages:

1. Upload resume
2. Convert to plain text
3. Segment into logical blocks (experience/project/skills)
4. Extract candidate entities & generate embeddings
5. Query vector store for nearest question templates
6. Rank and return final question set

## Implementation

This section summarizes the main implementation elements and shows example code snippets adapted to the project.

### Resume Preprocessing (example)

```python
from pathlib import Path
import textract
import re

def extract_text(file_path: str) -> str:
    text = textract.process(file_path).decode('utf-8', errors='ignore')
    # simple cleanup
    text = re.sub(r"\s+", " ", text)
    return text

def segment_sections(text: str) -> dict:
    # heuristics for Experience, Education, Skills, Projects
    sections = {'experience': '', 'skills': '', 'education': '', 'projects': ''}
    # ... implement section detection heuristics
    return sections
```

### Embedding and Retrieval (example)

```python
from sentence_transformers import SentenceTransformer
import numpy as np
import faiss

model = SentenceTransformer('all-MiniLM-L6-v2')

def embed_texts(texts):
    return model.encode(texts, convert_to_numpy=True)

# building FAISS index (in dev)
dim = 384
index = faiss.IndexFlatIP(dim)
# store normalized vectors

vectors = embed_texts(question_texts)
faiss.normalize_L2(vectors)
index.add(vectors)

def retrieve(query, k=10):
    qv = embed_texts([query])
    faiss.normalize_L2(qv)
    D, I = index.search(qv, k)
    return I[0], D[0]
```

### Example FastAPI endpoint (simplified)

```python
from fastapi import FastAPI, UploadFile

app = FastAPI()

@app.post('/upload_resume')
async def upload_resume(file: UploadFile):
    content = await file.read()
    # save, extract text, process
    questions = process_resume(content)
    return {'questions': questions}
```

### Model Training Process

- If a supervised ranker is used, prepare labeled pairs (resume segment, question) with relevance labels.
- Train a small classifier (binary/score regression) on top of concatenated embeddings or feature vectors.
- Use cross-validation and keep a held-out set of resumes for evaluation.

### Evaluation Metrics

- Precision@k, Recall@k — measure whether top-k questions cover expected topics.
- MAP (Mean Average Precision) if graded relevance exists.
- Human evaluation: raters judge relevance and quality.
- For classifier components: Accuracy, F1-score, ROC AUC.

## Discussion

### Summary of Work

We built an end-to-end pipeline: resume ingestion → NLP extraction → semantic embedding → vector retrieval → ranking → API. The system is modular, allowing swapping embedding models or rankers.

### Challenges Faced

- Resume parsing variability (formats, noise) — mitigated by robust text extraction and heuristics.
- Lack of labeled relevance data — mitigated with heuristics and human-in-the-loop feedback.
- Balancing novelty vs redundancy in returned questions.

### Success Criteria Met

- System produces relevant, varied questions for diverse resumes in dev testing.
- API serves requests with low latency (depending on embedding model selection and FAISS setup).

### Limitations

- Quality depends on the question template bank and embedding model capacity.
- Hard to automatically assess question difficulty without human labels.

## Future Work

- Add human feedback loop to collect labeled relevance judgments and retrain the ranker.
- Use larger, domain-specific embeddings or fine-tune models on resume/question pairs.
- Add question diversity constraints and coverage optimization.
- Provide an end-to-end deployment with autoscaling embedding service and persistent FAISS index (on disk / using HNSW + indexes).

## Appendix

### Full Code

See Appendix_Full_Code.md for links to the major code files and how to run the system locally.

### Diagrams

- Architecture: diagrams/architecture.mmd
- Data pipeline: diagrams/data_pipeline.mmd

### References

- Sentence-Transformers: https://www.sbert.net/
- FAISS: https://github.com/facebookresearch/faiss
