#!/usr/bin/env python
"""
Analyze which questions map to which skills from the resume
Shows detailed skill-to-question mappings
"""
import sys
from pathlib import Path
import json
import numpy as np

sys.path.append(str(Path(__file__).parent))

from pipeline.pdf_parser import extract_clean_text
from pipeline.profile_builder import build_profile
from pipeline.resume_loader import get_resume_file
from search.searcher import search
from search.embedder import embed_text

# ── Load resume and build profile ─────────────────────────────
# Try to load resume from user_resumes folder
try:
    RESUME_PATH = get_resume_file()
except FileNotFoundError as e:
    print(f"\n❌ Error: {e}")
    print("\nFallback: Using test resume from tests folder")
    RESUME_PATH = str(Path(__file__).parent / "tests" / "kp_resume.pdf")

resume_text = extract_clean_text(str(RESUME_PATH))
profile = build_profile(resume_text)

print("=" * 80)
print("RESUME SKILL MAPPING ANALYSIS")
print("=" * 80)

# ── Show extracted skills ────────────────────────────────────
print("\n📚 SKILLS EXTRACTED FROM RESUME:")
print("-" * 80)
print(f"\nRaw Skills ({len(profile['raw_skills'])} found):")
for skill in sorted(profile['raw_skills']):
    print(f"  • {skill}")

print(f"\nExpanded Skills ({len(profile['expanded_skills'])} found):")
for skill in sorted(profile['expanded_skills']):
    print(f"  • {skill}")

print(f"\nProject Terms ({len(profile['project_terms'])} found):")
for term in sorted(profile['project_terms']):
    print(f"  • {term}")

print(f"\nExperience Terms ({len(profile['experience_terms'])} found):")
for term in sorted(profile['experience_terms'][:10]):  # Show first 10
    print(f"  • {term}")
if len(profile['experience_terms']) > 10:
    print(f"  ... and {len(profile['experience_terms']) - 10} more")

# ── Get relevant questions ───────────────────────────────────
print("\n\n" + "=" * 80)
print("SEMANTIC SKILL-TO-QUESTION MAPPING")
print("=" * 80)

raw_results = search(profile["profile_string"], top_k=30, min_score=0.0)
print(f"\nFound {len(raw_results)} questions (top 30)\n")

# ── For each question, find which skills match best ──────────
print("Calculating skill-to-question similarity...")
model = embed_text.__globals__['get_model']()

# Get embeddings for individual skills and question
skill_embeddings = {}
for skill in profile['expanded_skills'][:40]:  # Analyze top 40 skills
    emb = model.encode(skill, normalize_embeddings=True)
    skill_embeddings[skill] = emb

print(f"\nAnalyzing top 10 questions:\n")
for q_idx, question in enumerate(raw_results[:10], 1):
    q_text = question.get('question', '')
    topic = question.get('topic', 'Unknown')
    score = question.get('similarity_score', 0)
    
    print(f"\n{q_idx}. [{topic}] {q_text[:70]}...")
    print(f"   Overall similarity score: {score:.4f}")
    
    # Embed question
    q_embedding = model.encode(q_text, normalize_embeddings=True)
    
    # Compare with top skills
    skill_scores = []
    for skill, skill_emb in skill_embeddings.items():
        # Cosine similarity
        sim = float(np.dot(skill_emb, q_embedding))
        skill_scores.append((skill, sim))
    
    # Sort by similarity and show top 5
    skill_scores.sort(key=lambda x: x[1], reverse=True)
    print("   Top matching skills:")
    for skill, score in skill_scores[:5]:
        bar = "█" * int(score * 20)
        print(f"     ├─ {skill:30s} │{bar:<20s}│ {score:.4f}")

print("\n" + "=" * 80)
print("💡 TIP: Higher scores = stronger semantic match to your profile")
print("=" * 80)
