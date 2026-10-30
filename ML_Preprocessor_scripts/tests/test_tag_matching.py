"""
Test script to demonstrate tag-based question matching.
Run this to see how tags improve relevance of search results.

Usage:
    python -m tests.test_tag_matching
"""

import json
from pathlib import Path
from pipeline.profile_builder import build_profile
from search.searcher import search, search_with_explanations
from search.tag_matcher import explain_all_results


def test_tag_matching():
    """Test tag-based matching with sample resume"""
    
    print("\n" + "="*80)
    print("TAG-BASED MATCHING TEST")
    print("="*80)
    
    # Find user resume
    resume_dir = Path(__file__).parent.parent / "user_resumes"
    resume_files = list(resume_dir.glob("*.pdf"))
    
    if not resume_files:
        print("❌ No resume found in user_resumes/")
        print("   Add a PDF resume to proceed.")
        return
    
    resume_path = resume_files[0]
    print(f"\n📄 Using resume: {resume_path.name}")
    
    # Build profile
    print("\n🔍 Building user profile from resume...")
    profile_string, extracted_skills = build_profile(str(resume_path))
    
    print(f"✅ Extracted {len(extracted_skills)} skills/keywords")
    print(f"   Skills: {', '.join(list(extracted_skills)[:10])}{'...' if len(extracted_skills) > 10 else ''}")
    
    # Test 1: Regular semantic search (baseline)
    print("\n" + "-"*80)
    print("TEST 1: Semantic Search (Baseline)")
    print("-"*80)
    
    results_baseline = search(
        profile_string=profile_string,
        top_k=10,
        min_score=0.25,
        use_tag_boosting=False
    )
    
    print(f"\nFound {len(results_baseline)} results (by semantic similarity)")
    for i, result in enumerate(results_baseline[:5], 1):
        topic = result.get("Topic", result.get("topic", "Unknown"))
        difficulty = result.get("Difficulty", result.get("difficulty", "N/A"))
        score = result.get("similarity_score", 0.0)
        tags = result.get("tags", [])
        
        print(f"\n  {i}. [{score:.3f}] {topic} ({difficulty})")
        if tags:
            print(f"     Tags: {', '.join(tags)}")
    
    # Test 2: Tag-boosted search
    print("\n" + "-"*80)
    print("TEST 2: Tag-Boosted Search")
    print("-"*80)
    
    results_tagged = search(
        profile_string=profile_string,
        top_k=10,
        min_score=0.25,
        user_skills=list(extracted_skills),
        use_tag_boosting=True
    )
    
    print(f"\nFound {len(results_tagged)} results (with tag boosting)")
    for i, result in enumerate(results_tagged[:5], 1):
        topic = result.get("Topic", result.get("topic", "Unknown"))
        difficulty = result.get("Difficulty", result.get("difficulty", "N/A"))
        
        # Show scores
        original = result.get("original_score", result.get("similarity_score", 0.0))
        combined = result.get("combined_score", result.get("similarity_score", 0.0))
        tag_overlap = result.get("tag_overlap", 0.0)
        tags = result.get("tags", [])
        
        print(f"\n  {i}. Topic: {topic} ({difficulty})")
        print(f"     Semantic: {original:.3f} | Tag overlap: {tag_overlap:.3f} | Combined: {combined:.3f}")
        if tags:
            print(f"     Tags: {', '.join(tags)}")
    
    # Test 3: Detailed explanations
    print("\n" + "-"*80)
    print("TEST 3: Relevance Explanations")
    print("-"*80)
    
    results_explained = search_with_explanations(
        profile_string=profile_string,
        user_skills=list(extracted_skills),
        top_k=5
    )
    
    print(f"\nTop 5 recommended questions with explanations:\n")
    for i, result in enumerate(results_explained, 1):
        topic = result.get("Topic", result.get("topic", "Unknown"))
        question = result.get("Question", result.get("question", "N/A"))[:60]
        
        explanation = result.get("relevance_explanation", {})
        reason = explanation.get("reason", "No explanation")
        matching_tags = explanation.get("matching_tags", [])
        
        print(f"  {i}. {topic}")
        print(f"     Q: {question}...")
        print(f"     💡 {reason}")
        if matching_tags:
            print(f"     ✓ Matched tags: {', '.join(matching_tags)}")
        print()
    
    # Summary comparison
    print("="*80)
    print("SUMMARY")
    print("="*80)
    print(f"\n✅ Tag-based matching is enabled!")
    print(f"   - Semantic similarity: 70% weight")
    print(f"   - Tag overlap: 30% weight")
    print(f"   - Combined scoring provides better relevance")
    print(f"\n📊 Next steps:")
    print(f"   1. Provide Excel files with 'Tags' column")
    print(f"   2. Run: python -m scripts.build_index")
    print(f"   3. Results will automatically use tag boosting")
    print()


if __name__ == "__main__":
    test_tag_matching()
