import sys
from pathlib import Path

# Make sure ML_Preprocessor_scripts/ is on the path
sys.path.append(str(Path(__file__).parent.parent))

from pipeline.pdf_parser import extract_clean_text
from pipeline.profile_builder import build_profile
from pipeline.resume_loader import get_resume_file
from search.searcher import search
from search.postprocessor import deduplicate, group_by_topic, sort_by_difficulty

# ── Config ───────────────────────────────────────────────────────
# Try to load resume from user_resumes folder
try:
    RESUME_PATH = get_resume_file()
except FileNotFoundError as e:
    print(f"\n❌ Error: {e}")
    print("\nFallback: Using test resume from tests folder")
    RESUME_PATH = str(Path(__file__).parent / "kp_resume.pdf")

# ── Step 1: Extract and build profile ────────────────────────────
print("=" * 60)
print("STEP 1 — Extracting text and building profile")
print("=" * 60)

resume_text = extract_clean_text(str(RESUME_PATH))
profile = build_profile(resume_text)

print(f"\nSections found:     {profile['sections_found']}")
print(f"Raw skills:         {profile['raw_skills']}")
print(f"Expanded skills:    {profile['expanded_skills']}")
print(f"Project terms:      {profile['project_terms']}")
print(f"Experience terms:   {profile['experience_terms']}")
print(f"Education terms:    {profile['education_terms']}")

print(f"\nProfile string preview:")
print(profile["profile_string"][:400] + "...")

# ── Step 2: Search questions ──────────────────────────────────────
print("\n" + "=" * 60)
print("STEP 2 — Searching questions via FAISS")
print("=" * 60)

raw_results = search(profile["profile_string"], top_k=30, min_score=0.15)
print(f"\nTotal matches above threshold: {len(raw_results)}")

deduped  = deduplicate(raw_results, max_per_topic=4)
grouped  = group_by_topic(deduped)

# ── Step 3: Display results ───────────────────────────────────────
print("\n" + "=" * 60)
print("STEP 3 — Results grouped by topic")
print("=" * 60)

for topic, questions in grouped.items():
    sorted_qs = sort_by_difficulty(questions)
    print(f"\n── {topic} ({len(sorted_qs)} questions) ──")
    for q in sorted_qs:
        difficulty = q.get("difficulty", "?")
        score      = q.get("similarity_score", 0)
        question   = q.get("question", "")
        print(f"  [{difficulty}] (score: {score}) {question}")