import faiss
import json
import numpy as np
from pathlib import Path
from search.embedder import embed_text
from search.tag_matcher import boost_results, explain_all_results

_index = None
_questions = None

# Paths relative to ML_Preprocessor_scripts/
DATA_DIR = Path(__file__).parent.parent / "data"
INDEX_PATH = DATA_DIR / "questions.index"
QUESTIONS_PATH = DATA_DIR / "questions.json"


def _load_assets():
    global _index, _questions

    if _index is None:
        if not INDEX_PATH.exists():
            raise FileNotFoundError(
                f"FAISS index not found at {INDEX_PATH}\n"
                "Run: python -m scripts.build_index"
            )
        print("[searcher] Loading FAISS index...")
        _index = faiss.read_index(str(INDEX_PATH))
        print(f"[searcher] Index loaded — {_index.ntotal} questions indexed.")

    if _questions is None:
        with open(QUESTIONS_PATH) as f:
            _questions = json.load(f)


def search(profile_string: str, top_k: int = 30, min_score: float = 0.25, user_skills: list = None, use_tag_boosting: bool = False) -> list[dict]:
    """
    Search for relevant questions based on resume profile.
    
    Args:
        profile_string: Concatenated string of user's skills/experience
        top_k: Number of top results to return
        min_score: Minimum semantic similarity threshold
        user_skills: List of user skills (for tag-based boosting)
        use_tag_boosting: Whether to apply tag-based relevance boosting
    
    Returns:
        List of relevant questions, optionally boosted by tag matches
    """
    _load_assets()

    resume_vector = embed_text(profile_string)
    distances, indices = _index.search(resume_vector, top_k)

    results = []
    for score, idx in zip(distances[0], indices[0]):
        if idx == -1:
            continue
        if float(score) < min_score:
            continue
        q = _questions[idx].copy()
        q["similarity_score"] = round(float(score), 4)
        results.append(q)
    
    # Apply tag-based boosting if skills are provided
    if use_tag_boosting and user_skills:
        results = boost_results(results, user_skills, tag_weight=0.3)

    return results


def search_with_explanations(profile_string: str, user_skills: list, top_k: int = 30, min_score: float = 0.25) -> list[dict]:
    """
    Search with detailed relevance explanations.
    
    Args:
        profile_string: User's concatenated skills/experience
        user_skills: List of extracted skills from resume
        top_k: Number of results
        min_score: Minimum similarity threshold
    
    Returns:
        Search results with detailed relevance explanations
    """
    results = search(
        profile_string=profile_string,
        top_k=top_k,
        min_score=min_score,
        user_skills=user_skills,
        use_tag_boosting=True
    )
    
    # Add detailed explanations
    results_with_explanations = explain_all_results(results, user_skills)
    
    return results_with_explanations