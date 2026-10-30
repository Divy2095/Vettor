#!/usr/bin/env python3
"""
Quick demo of the tag-based question matching system.
This script shows how tags improve relevance of search results.

Usage:
    python demo_tag_matching.py
"""

import sys
from pathlib import Path

# Add project to path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root / "ML_Preprocessor_scripts"))

from search.tag_matcher import TagMatcher


def demo_tag_overlap():
    """Demonstrate tag overlap calculation"""
    print("\n" + "="*80)
    print("DEMO 1: Tag Overlap Calculation")
    print("="*80)
    
    matcher = TagMatcher()
    
    # Example 1
    user_skills = ["arrays", "sorting", "binary-search"]
    question_tags = ["arrays", "sorting", "quicksort", "merge-sort"]
    
    overlap = matcher.calculate_tag_overlap(user_skills, question_tags)
    matching = matcher.get_matching_tags(user_skills, question_tags)
    
    print(f"\nUser Skills: {user_skills}")
    print(f"Question Tags: {question_tags}")
    print(f"Matching Tags: {matching}")
    print(f"Overlap Score: {overlap:.3f} ({len(matching)}/{len(question_tags)} tags matched)")
    
    # Example 2
    print("\n" + "-"*80)
    user_skills = ["dynamic-programming", "recursion", "memoization"]
    question_tags = ["sorting", "arrays", "quicksort"]
    
    overlap = matcher.calculate_tag_overlap(user_skills, question_tags)
    matching = matcher.get_matching_tags(user_skills, question_tags)
    
    print(f"\nUser Skills: {user_skills}")
    print(f"Question Tags: {question_tags}")
    print(f"Matching Tags: {matching}")
    print(f"Overlap Score: {overlap:.3f} ({len(matching)}/{len(question_tags)} tags matched)")


def demo_score_combination():
    """Demonstrate score combination (semantic + tags)"""
    print("\n" + "="*80)
    print("DEMO 2: Relevance Score Combination")
    print("="*80)
    
    scenarios = [
        {
            "question": "What is binary search?",
            "semantic_score": 0.85,
            "tag_overlap": 0.90,
            "user_skills": ["binary-search", "searching", "arrays"],
            "tags": ["binary-search", "searching", "arrays", "algorithms"]
        },
        {
            "question": "Explain merge sort",
            "semantic_score": 0.72,
            "tag_overlap": 0.50,
            "user_skills": ["sorting", "binary-search"],
            "tags": ["sorting", "merge-sort", "divide-and-conquer", "arrays"]
        },
        {
            "question": "Design a cache",
            "semantic_score": 0.45,
            "tag_overlap": 0.0,
            "user_skills": ["sorting", "binary-search"],
            "tags": ["caching", "system-design", "lru", "hash-map"]
        }
    ]
    
    print("\nCombined Score = (Semantic × 0.7) + (Tag Overlap × 0.3)")
    print()
    
    for i, scenario in enumerate(scenarios, 1):
        semantic = scenario["semantic_score"]
        tag_overlap = scenario["tag_overlap"]
        combined = (semantic * 0.7) + (tag_overlap * 0.3)
        
        print(f"\nQuestion {i}: {scenario['question']}")
        print(f"  User skills: {scenario['user_skills']}")
        print(f"  Question tags: {scenario['tags']}")
        print(f"  Semantic score: {semantic:.3f}")
        print(f"  Tag overlap: {tag_overlap:.3f}")
        print(f"  Combined score: {combined:.3f} ← Final ranking based on this")


def demo_real_data():
    """Show real data example"""
    print("\n" + "="*80)
    print("DEMO 3: Real Data Example (from questions.json)")
    print("="*80)
    
    matcher = TagMatcher()
    
    if not matcher.questions:
        print("\n⚠️  No questions.json found!")
        print("   Run: python -m scripts.build_index")
        print("   Then run this demo again")
        return
    
    print(f"\nLoaded {len(matcher.questions)} questions")
    
    # Show some example questions
    for i, q in enumerate(matcher.questions[:3], 1):
        tags = q.get("tags", [])
        topic = q.get("Topic", q.get("topic", "Unknown"))
        difficulty = q.get("Difficulty", q.get("difficulty", "N/A"))
        question = q.get("Question", q.get("question", ""))[:50]
        
        print(f"\n{i}. {topic} ({difficulty})")
        print(f"   Q: {question}...")
        if tags:
            print(f"   Tags: {', '.join(tags)}")
        else:
            print(f"   Tags: [none]")


def demo_weighting_impact():
    """Show impact of different tag weights"""
    print("\n" + "="*80)
    print("DEMO 4: Impact of Tag Weighting")
    print("="*80)
    
    print("\nScenario: Semantic=0.5, Tag Overlap=0.8")
    print()
    
    weights = [0.1, 0.3, 0.5, 0.7, 0.9]
    
    for tag_weight in weights:
        semantic_weight = 1.0 - tag_weight
        score = (0.5 * semantic_weight) + (0.8 * tag_weight)
        
        bar = "█" * int(score * 20) + "░" * (20 - int(score * 20))
        print(f"Tag weight {tag_weight:.1f}: [{bar}] Score: {score:.3f}")
    
    print("\nObservation:")
    print("  - Higher tag weight (0.7-0.9): Prioritizes skill matches")
    print("  - Medium tag weight (0.3-0.5): Balanced approach (recommended)")
    print("  - Lower tag weight (0.1-0.2): Prioritizes semantic similarity")


def main():
    print("\n" + "="*80)
    print("TAG-BASED QUESTION MATCHING - DEMO SCRIPT")
    print("="*80)
    
    try:
        demo_tag_overlap()
        demo_score_combination()
        demo_weighting_impact()
        demo_real_data()
        
        print("\n" + "="*80)
        print("SUMMARY")
        print("="*80)
        print("""
✅ Tag-based matching is working!

Key concepts:
  1. Tag overlap = user skills matching question tags
  2. Combined score = 70% semantic + 30% tags
  3. Better relevance when tags are granular
  
Next steps:
  1. Add Tags column to your Excel/CSV files
  2. Run: python -m scripts.build_index
  3. Run: python -m tests.test_tag_matching
  
For details: See TAG_IMPLEMENTATION_QUICK_START.md or TAG_MATCHING_GUIDE.md
        """)
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        print(f"\nMake sure you've run: python -m scripts.build_index")
        sys.exit(1)


if __name__ == "__main__":
    main()
