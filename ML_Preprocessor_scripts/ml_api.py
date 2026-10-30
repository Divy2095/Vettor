from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import random
import os
from typing import List

app = FastAPI()

# ✅ Allow cross-origin requests from the Node.js backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ Correct path to your data folder
DATA_FOLDER = "data/raw"

# ✅ Load all Excel files into one dataset
all_data = []

for file in os.listdir(DATA_FOLDER):
    if file.endswith(".xlsx"):
        file_path = os.path.join(DATA_FOLDER, file)
        df = pd.read_excel(file_path)

        # Normalize column names (important)
        df.columns = [col.lower().strip() for col in df.columns]

        # Some files use "questions" instead of "question" — normalize it
        if "questions" in df.columns and "question" not in df.columns:
            df = df.rename(columns={"questions": "question"})

        # Make sure "question" column exists
        if "question" in df.columns:
            all_data.append(df)

# Combine all datasets
if all_data:
    data = pd.concat(all_data, ignore_index=True)
    data = data.fillna("Unknown")
else:
    data = pd.DataFrame()


# ── Pydantic model for skill-based request ──
class SkillsRequest(BaseModel):
    skills: List[str]
    max_per_skill: int = 5


def clean(value):
    """Convert NaN or missing values to a clean string."""
    if pd.isna(value):
        return "Unknown"
    return str(value)


def match_skill_to_rows(skill: str, df: pd.DataFrame) -> pd.DataFrame:
    """
    Match a skill against the dataset using fuzzy substring matching
    on the 'topic' and 'question' columns. Returns matching rows.
    """
    skill_lower = skill.lower().strip()

    # Build a boolean mask: match in topic OR question text
    topic_match = df["topic"].astype(str).str.lower().str.contains(skill_lower, na=False)
    question_match = df["question"].astype(str).str.lower().str.contains(skill_lower, na=False)

    return df[topic_match | question_match]


@app.get("/")
def home():
    return {"message": "ML API Running"}


@app.get("/get-question")
def get_question():
    if data.empty:
        return {"error": "No data loaded"}
    
    row = data.sample(1).iloc[0]

    return {
        "question": clean(row.get("question")),
        "subject": clean(row.get("topic")),        
        "difficulty": clean(row.get("difficulty"))
    }


@app.post("/get-questions-by-skills")
def get_questions_by_skills(request: SkillsRequest):
    """
    Accepts a list of skills extracted from a resume.
    Returns relevant interview questions filtered from the dataset,
    grouped by each skill.
    """
    if data.empty:
        return {"error": "No data loaded", "results": []}

    results = []
    seen_questions = set()  # avoid duplicate questions across skills

    for skill in request.skills:
        matched = match_skill_to_rows(skill, data)

        # Remove already-seen questions to avoid duplicates
        matched = matched[~matched["question"].isin(seen_questions)]

        # Sample up to max_per_skill questions
        if len(matched) > request.max_per_skill:
            matched = matched.sample(n=request.max_per_skill, random_state=random.randint(0, 9999))

        questions = []
        for _, row in matched.iterrows():
            q_text = clean(row.get("question"))
            seen_questions.add(q_text)
            questions.append({
                "question": q_text,
                "topic": clean(row.get("topic")),
                "difficulty": clean(row.get("difficulty")),
            })

        results.append({
            "skill": skill,
            "matchedCount": len(questions),
            "questions": questions,
        })

    total_questions = sum(r["matchedCount"] for r in results)

    return {
        "message": f"Found {total_questions} questions across {len(request.skills)} skills",
        "totalQuestions": total_questions,
        "results": results,
    }