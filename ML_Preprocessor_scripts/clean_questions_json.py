"""
Script to clean up questions.json by removing garbage keys and normalizing structure.

Garbage keys to remove:
- "if two computers are connected directly using a cross-over cable..." (malformed Excel column)
- "questions" (redundant null field)

Output: Cleaned questions.json with proper structure
"""

import json
from pathlib import Path

def clean_questions_json():
    """Remove garbage keys from questions.json"""
    
    data_dir = Path(__file__).parent / "data"
    json_path = data_dir / "questions.json"
    
    print(f"📖 Loading questions.json...")
    with open(json_path, 'r', encoding='utf-8') as f:
        questions = json.load(f)
    
    print(f"📊 Initial count: {len(questions)} questions")
    
    # Identify garbage keys from first question
    if questions:
        sample = questions[0]
        garbage_keys = set()
        
        # Known garbage keys to remove
        keys_to_check = [
            "if two computers are connected directly using a cross-over cable, can they communicate without ip addresses? why or why not?",
            "questions",
            "Questions"
        ]
        
        for garbage_key in keys_to_check:
            if garbage_key in sample:
                garbage_keys.add(garbage_key)
                print(f"🗑️  Found garbage key: '{garbage_key}'")
        
        # Clean all questions
        cleaned = []
        for i, q in enumerate(questions):
            cleaned_q = {}
            
            # Keep only valid keys
            valid_keys = ["sr no", "topic", "question", "difficulty", "tags"]
            
            for key in valid_keys:
                if key in q:
                    cleaned_q[key] = q[key]
            
            # Ensure required fields exist
            if "sr no" not in cleaned_q:
                cleaned_q["sr no"] = i + 1
            if "topic" not in cleaned_q:
                cleaned_q["topic"] = "Unknown"
            if "question" not in cleaned_q:
                cleaned_q["question"] = "N/A"
            if "difficulty" not in cleaned_q:
                cleaned_q["difficulty"] = None
            if "tags" not in cleaned_q:
                cleaned_q["tags"] = []
            
            cleaned.append(cleaned_q)
        
        # Save cleaned questions
        backup_path = data_dir / "questions_backup.json"
        print(f"\n💾 Saving backup to: {backup_path}")
        with open(backup_path, 'w', encoding='utf-8') as f:
            json.dump(questions, f, indent=2, ensure_ascii=False)
        
        print(f"✅ Saving cleaned questions to: {json_path}")
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(cleaned, f, indent=2, ensure_ascii=False)
        
        print(f"\n✨ Cleanup Complete!")
        print(f"   ✓ Removed garbage keys: {len(garbage_keys)}")
        print(f"   ✓ Cleaned questions: {len(cleaned)}")
        print(f"   ✓ Backup saved: questions_backup.json")
        
        # Show sample of cleaned data
        print(f"\n📋 Sample cleaned question:")
        print(json.dumps(cleaned[0], indent=2, ensure_ascii=False))
        
        return cleaned

if __name__ == "__main__":
    clean_questions_json()
