#!/usr/bin/env python
"""Build FAISS index from questions.json"""
import json
import numpy as np
import faiss
from pathlib import Path
from sentence_transformers import SentenceTransformer

BASE_DIR = Path(__file__).parent
QUESTIONS_JSON = BASE_DIR / "data" / "questions.json"
OUTPUT_INDEX = BASE_DIR / "data" / "questions.index"

print(f"Loading questions from {QUESTIONS_JSON}...")
with open(QUESTIONS_JSON) as f:
    questions = json.load(f)

print(f"Total questions: {len(questions)}")

# Build text for embedding: combine topic + question for richer signal
texts = []
for q in questions:
    topic = q.get("topic", "").strip()
    question = q.get("question", "").strip()
    text = f"{topic} {question}".strip()
    texts.append(text)

print("Loading SBERT model...")
model = SentenceTransformer("all-MiniLM-L6-v2")

print("Encoding questions...")
embeddings = model.encode(
    texts,
    normalize_embeddings=True,
    show_progress_bar=True,
    batch_size=32,
)

print(f"Embeddings shape: {embeddings.shape}")

# Build FAISS index
dim = embeddings.shape[1]  # 384
index = faiss.IndexFlatIP(dim)
index.add(np.array(embeddings, dtype="float32"))

print(f"FAISS index built with {index.ntotal} vectors")

# Save index
faiss.write_index(index, str(OUTPUT_INDEX))
print(f"✓ Saved index to {OUTPUT_INDEX}")
print("\nTest data is ready. Run: python ML_Preprocessor_scripts/tests/tests_extraction.py")
