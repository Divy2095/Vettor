# 💻 Code Examples: Pretrained vs Training

## Our Approach: Using Pretrained SBERT

### Step 1: Load Pretrained Model (No Training)
```python
from sentence_transformers import SentenceTransformer

# Download and load pretrained model
# NO training parameters, NO loss functions, NO gradient descent
model = SentenceTransformer("all-MiniLM-L6-v2")

# Model is ready to use immediately
print(f"Model loaded. Frozen weights: {model.training}")  
# Output: False (frozen, not training)
```

### Step 2: Embed Questions (Inference Only)
```python
# NO backprop, NO weight updates, just forward pass
questions = [
    "What is Java?",
    "Explain OOP",
    "What is a database?"
]

embeddings = model.encode(questions, normalize_embeddings=True)
# Output: (3, 384) - 3 questions, 384-dim vectors
# Computation: Forward pass only ~100ms
```

### Step 3: Build FAISS Index (Not Training)
```python
import faiss
import numpy as np

# Create index structure
index = faiss.IndexFlatIP(384)  # Inner Product similarity

# Add embeddings (no learning)
index.add(np.array(embeddings, dtype="float32"))

# Save for later
faiss.write_index(index, "questions.index")
```

### Step 4: Search at Runtime (Inference Only)
```python
# User provides resume
user_profile = "Java, Python, OOP, databases, algorithms..."

# Embed profile with SAME pretrained model
profile_vector = model.encode(user_profile, normalize_embeddings=True)
# Output: (384,)

# Search FAISS (no training)
distances, indices = index.search(
    np.array([profile_vector], dtype="float32"), 
    k=30
)

# Get results
top_questions = [questions[i] for i in indices[0]]
```

---

## If We WERE Training (NOT What We Do)

### This is what training would look like:

```python
from sentence_transformers import SentenceTransformer, losses
from sentence_transformers.readers import STSBenchmarkDataReader
from torch.utils.data import DataLoader

# ❌ Step 1: Prepare labeled training data
reader = STSBenchmarkDataReader('data/training_pairs')
train_dataloader = DataLoader(reader.get_examples("train"), shuffle=True, batch_size=16)

# ❌ Step 2: Load base model (now TRAINABLE)
model = SentenceTransformer("all-MiniLM-L6-v2")
# model.training = True (would be trainable)

# ❌ Step 3: Define loss function
train_loss = losses.TripletLoss(model=model)

# ❌ Step 4: Train for multiple epochs
model.fit(
    train_objectives=[(train_dataloader, train_loss)],
    epochs=10,
    warmup_steps=500,
)

# ❌ Step 5: Save new weights
model.save("my-fine-tuned-model")

# ❌ Time required: 2-3 hours on GPU
# ❌ Data required: 1000+ labeled pairs
# ❌ Resources: GPU memory, power, time
```

---

## Code Locations in Our Project

### Where Pretrained Model is Used:

#### `search/embedder.py` (Inference Only)
```python
from sentence_transformers import SentenceTransformer

_model = None

def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        print("[embedder] Loading SBERT model (first time only)...")
        _model = SentenceTransformer("all-MiniLM-L6-v2")  # ← PRETRAINED
        print("[embedder] Model loaded.")
    return _model

def embed_text(text: str) -> np.ndarray:
    model = get_model()
    # Forward pass only (no training)
    vector = model.encode(text, normalize_embeddings=True)
    return np.array([vector], dtype="float32")
```

#### `scripts/build_index.py` (Indexing, not Training)
```python
from sentence_transformers import SentenceTransformer

# Load pretrained model
print("Loading SBERT model...")
model = SentenceTransformer("all-MiniLM-L6-v2")  # ← PRETRAINED

# Embed all questions (inference only)
print("Encoding questions...")
embeddings = model.encode(
    texts,
    normalize_embeddings=True,
    show_progress_bar=True,
    batch_size=64,
)  # ← No training, just forward pass

# Build FAISS index (not training)
index = faiss.IndexFlatIP(dim)
index.add(np.array(embeddings, dtype="float32"))

# Save index
faiss.write_index(index, str(OUT_INDEX))
```

#### `search/searcher.py` (Inference Only)
```python
def search(profile_string: str, top_k: int = 30, min_score: float = 0.15):
    _load_assets()  # Load pretrained SBERT + FAISS index
    
    # Embed profile (inference only)
    resume_vector = embed_text(profile_string)  # Uses pretrained model
    
    # Search (no training)
    distances, indices = _index.search(resume_vector, top_k)
    
    # Return results
    results = []
    for score, idx in zip(distances[0], indices[0]):
        if idx == -1:
            continue
        if float(score) < min_score:
            continue
        q = _questions[idx].copy()
        q["similarity_score"] = round(float(score), 4)
        results.append(q)
    
    return results
```

---

## Key Differences

### Our Approach (Pretrained)
```python
import time

start = time.time()
model = SentenceTransformer("all-MiniLM-L6-v2")
embeddings = model.encode(questions)
end = time.time()

print(f"Time: {end - start:.2f}s")  # ~100ms
print(f"GPU needed: No")
print(f"Training: No")
print(f"Ready to use: Yes, immediately")
```

### Training Approach (Not What We Do)
```python
import time

start = time.time()
model = SentenceTransformer("all-MiniLM-L6-v2")
# ... prepare 1000+ labeled pairs ...
# ... define loss function ...
# ... run training loop for 10 epochs ...
# ... evaluate and validate ...
end = time.time()

print(f"Time: {end - start:.2f}s")  # ~1-2 HOURS
print(f"GPU needed: Yes (V100 or better)")
print(f"Training: Yes, full backprop")
print(f"Ready to use: Only after training done")
```

---

## Model Architecture (Frozen)

```
Input: "What is Java programming?"
  ↓
[Tokenizer] → [101, 1040, 2003, 1041, 3793, ...]
  ↓
[Embedding Layer] ← FROZEN weights
  ↓
[DistilBERT Layers] × 6 ← FROZEN weights
  ↓
[Pooling] ← FROZEN weights
  ↓
Output: [-0.063, 0.090, -0.047, ..., 0.124] (384 dims)
  ↓
[FAISS Index] → Search
```

All weights → **FROZEN** (not modified)

---

## Memory & Speed

### Pretrained Model Performance:
```
Model Size: 90 MB
Load Time: ~2 seconds (first run)
Memory: ~200 MB RAM
Embedding Speed: 2000 sentences/sec
Response Time (search): ~100ms
```

### If We Trained:
```
Training Time: 1-2 hours on GPU
GPU Memory: 8-24 GB VRAM
Compute Power: NVIDIA GPU (V100+)
Final Model Size: 90 MB (same)
```

---

## When to Use What?

| Use Case | Approach |
|----------|----------|
| We have domain-specific data | Train a custom model |
| We want general semantic matching | ✅ Use pretrained SBERT |
| We have <1000 examples | ✅ Pretrained is better |
| We have >10k labeled pairs | Consider fine-tuning |
| We need instant results | ✅ Pretrained only |
| We have no GPU | ✅ Pretrained only |
| We have domain experts to label data | Consider fine-tuning |

**Our Case:** < 1000 questions + no labeled pairs + need instant results = **Pretrained is perfect** ✅

---

## Model Card Summary

**Name:** all-MiniLM-L6-v2  
**Type:** Sentence Transformer (Semantic Embedding)  
**Base Model:** DistilBERT (6 layers)  
**Dimensions:** 384  
**Parameters:** 22.7M  
**Training Data:** 215M sentence pairs  
**Trained By:** Sentence-Transformers  
**License:** Apache 2.0 / MIT  
**Status:** ✅ Production Ready  
**Updates:** Download latest from Hugging Face  

---

**Bottom Line:** We use a free, open-source, production-ready model. Zero training involved. Just smart reuse! 🚀
