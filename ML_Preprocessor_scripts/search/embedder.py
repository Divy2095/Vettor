from sentence_transformers import SentenceTransformer
import numpy as np

_model = None


def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        print("[embedder] Loading SBERT model (first time only)...")
        _model = SentenceTransformer("all-MiniLM-L6-v2")
        print("[embedder] Model loaded.")
    return _model


def embed_text(text: str) -> np.ndarray:
    model = get_model()
    vector = model.encode(text, normalize_embeddings=True)
    return np.array([vector], dtype="float32")  # shape: (1, 384)