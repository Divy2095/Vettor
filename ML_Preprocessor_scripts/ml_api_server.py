#!/usr/bin/env python3
"""
Flask API Server for Resume-based AI Interview Question Finder
Exposes ML pipeline as REST endpoints for the Node.js backend
"""

import os
import sys
import json
import base64
import logging
import re
import tempfile
from pathlib import Path
from datetime import datetime
from io import BytesIO

from flask import Flask, request, jsonify
from flask_cors import CORS
import traceback
import random

# Add ML_Preprocessor_scripts to Python path
SCRIPT_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRIPT_DIR))

# spaCy is optional at startup; the pipeline now degrades gracefully if the
# model is missing, so we avoid downloading it during worker boot.
def ensure_spacy_model():
    try:
        import spacy
        spacy.load('en_core_web_sm')
        logger.info('✓ spaCy model en_core_web_sm loaded')
    except (OSError, ImportError):
        logger.warning(
            'spaCy model en_core_web_sm is not available at startup; '
            'continuing without eager download to avoid boot-time OOM.'
        )

# Import ML pipeline components
from pipeline.pdf_parser import extract_clean_text
from pipeline.profile_builder import build_profile
from pipeline.ontology import expand_skills

# Load simple question dataset (fallback for skill-based queries)
QUESTIONS_DATA = None
DATA_DIR = SCRIPT_DIR / "data"
QUESTIONS_JSON = DATA_DIR / "questions.json"

def load_questions_dataset():
    global QUESTIONS_DATA
    if QUESTIONS_DATA is not None:
        return QUESTIONS_DATA

    try:
        if QUESTIONS_JSON.exists():
            with open(QUESTIONS_JSON, "r", encoding="utf-8") as fh:
                QUESTIONS_DATA = json.load(fh)
        else:
            QUESTIONS_DATA = []
    except Exception:
        QUESTIONS_DATA = []

    return QUESTIONS_DATA


def match_skill_rows(skill: str, dataset: list):
    """Return rows where topic or question contains the skill (case-insensitive)."""
    skill_lower = (skill or "").strip().lower()
    if not skill_lower:
        return []

    matched = []
    for row in dataset:
        topic = str(row.get("topic", "") or "").lower()
        question = str(row.get("question", "") or "").lower()
        if skill_lower in topic or skill_lower in question:
            matched.append(row)

    return matched


def build_questions_from_skills(skills: list, max_per_skill: int = 5, total_limit: int = 30):
    """Build ranked questions from dataset using skill overlap.

    Designed for low-memory deployments where embedding models are too heavy.
    """
    dataset = load_questions_dataset()
    if not dataset:
        return []

    normalized_skills = [s.strip().lower() for s in (skills or []) if str(s).strip()]
    if not normalized_skills:
        return []

    skill_tokens = set()
    for skill in normalized_skills:
        skill_tokens.update(re.findall(r"[a-z0-9+#.]+", skill))

    scored = []
    seen_questions = set()

    for row in dataset:
        question = str(row.get("question") or "").strip()
        if not question or question in seen_questions:
            continue

        topic = str(row.get("topic") or "").strip().lower()
        tags_value = row.get("tags") or []
        if isinstance(tags_value, str):
            tags = [t.strip().lower() for t in tags_value.split(",") if t.strip()]
        elif isinstance(tags_value, list):
            tags = [str(t).strip().lower() for t in tags_value if str(t).strip()]
        else:
            tags = []

        haystack = f"{topic} {' '.join(tags)} {question.lower()}"
        direct_hits = sum(1 for skill in normalized_skills if skill in haystack)

        if direct_hits == 0:
            continue

        text_tokens = set(re.findall(r"[a-z0-9+#.]+", haystack))
        token_overlap = len(skill_tokens & text_tokens)

        score = direct_hits * 1.0 + token_overlap * 0.05
        if topic and topic in normalized_skills:
            score += 0.5

        scored.append((score, {
            "question": question,
            "topic": row.get("topic") or "",
            "difficulty": row.get("difficulty") or "",
            "tags": row.get("tags") or [],
            "similarity_score": round(min(0.99, 0.35 + score * 0.06), 4),
        }))

    scored.sort(key=lambda item: item[0], reverse=True)

    results = []
    topic_count = {}

    for _score, row in scored:
        if len(results) >= total_limit:
            break

        topic_key = str(row.get("topic") or "unknown").strip().lower()
        if topic_count.get(topic_key, 0) >= max_per_skill:
            continue

        topic_count[topic_key] = topic_count.get(topic_key, 0) + 1
        results.append(row)

    return results


def semantic_search_questions(profile_string, user_skills, top_k, min_score, with_explanations):
    """Run semantic search lazily, only when explicitly enabled."""
    from search.searcher import search, search_with_explanations

    if with_explanations and user_skills:
        return search_with_explanations(
            profile_string=profile_string,
            user_skills=user_skills,
            top_k=top_k,
            min_score=min_score,
        )

    return search(
        profile_string=profile_string,
        top_k=top_k,
        min_score=min_score,
        user_skills=user_skills,
        use_tag_boosting=True,
    )


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s: %(message)s'
)
logger = logging.getLogger(__name__)

# Create Flask app
app = Flask(__name__)
CORS(app)

# Configuration
app.config['JSON_SORT_KEYS'] = False
MAX_CONTENT_LENGTH = 10 * 1024 * 1024  # 10MB max request size

# Default lightweight mode for low-memory platforms like Render free tier.
LIGHTWEIGHT_ML_MODE = os.getenv("LIGHTWEIGHT_ML_MODE", "true").lower() == "true"


class APIError(Exception):
    """Custom API error for consistent error responses"""
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


def serialize_response(success: bool, data=None, error=None, status_code: int = 200):
    """Create consistent response format"""
    response = {
        "success": success,
        "timestamp": datetime.utcnow().isoformat(),
    }
    if data is not None:
        response["data"] = data
    if error is not None:
        response["error"] = error
    
    return jsonify(response), status_code


@app.errorhandler(APIError)
def handle_api_error(error):
    """Handle custom API errors"""
    logger.error(f"API Error: {error.message}")
    return serialize_response(
        success=False,
        error=error.message,
        status_code=error.status_code
    )


@app.errorhandler(Exception)
def handle_exception(error):
    """Handle unexpected errors"""
    logger.error(f"Unexpected error: {str(error)}")
    logger.error(traceback.format_exc())
    return serialize_response(
        success=False,
        error="Internal server error",
        status_code=500
    )


# ──────────────────────────────────────────────────────────────────
# HEALTH CHECK
# ──────────────────────────────────────────────────────────────────

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return serialize_response(
        success=True,
        data={
            "status": "healthy",
            "service": "Resume AI ML Pipeline API",
            "version": "1.0.0"
        }
    )


# ──────────────────────────────────────────────────────────────────
# CORE ML PIPELINE ENDPOINTS
# ──────────────────────────────────────────────────────────────────

@app.route('/api/extract', methods=['POST'])
def extract_resume_skills():
    """
    Extract skills from resume PDF
    
    Request:
    {
        "resume_base64": "base64-encoded-pdf-content",
        "filename": "resume.pdf"
    }
    
    Response:
    {
        "success": true,
        "data": {
            "profile_string": "Technical skills and expertise: ...",
            "raw_skills": ["Python", "Java", ...],
            "expanded_skills": ["Python", "OOP", "Data structures", ...],
            "extracted_data": {
                "project_terms": [...],
                "experience_terms": [...],
                "education_terms": [...],
                ...
            },
            "sections_found": ["Skills", "Experience", ...]
        }
    }
    """
    try:
        # Validate request
        if not request.json:
            raise APIError("Request must be JSON", 400)
        
        resume_base64 = request.json.get('resume_base64')
        filename = request.json.get('filename', 'resume.pdf')
        
        if not resume_base64:
            raise APIError("resume_base64 is required", 400)
        
        logger.info(f"Extracting skills from: {filename}")
        
        # Decode base64 PDF
        try:
            pdf_bytes = base64.b64decode(resume_base64)
        except Exception as e:
            raise APIError(f"Invalid base64 encoding: {str(e)}", 400)
        
        # Save to temporary file
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
            tmp.write(pdf_bytes)
            tmp_path = tmp.name
        
        try:
            # Extract text from PDF
            logger.info("Extracting text from PDF...")
            resume_text = extract_clean_text(tmp_path)
            
            if not resume_text or len(resume_text.strip()) < 50:
                raise APIError("Resume appears to be empty or invalid", 400)
            
            # Build profile using ML pipeline
            logger.info("Building semantic profile...")
            profile = build_profile(resume_text)
            
            # Prepare response
            response_data = {
                "profile_string": profile.get("profile_string", ""),
                "raw_skills": profile.get("raw_skills", []),
                "expanded_skills": profile.get("expanded_skills", []),
                "extracted_data": {
                    "project_terms": profile.get("project_terms", []),
                    "experience_terms": profile.get("experience_terms", []),
                    "education_terms": profile.get("education_terms", []),
                    "summary_terms": profile.get("summary_terms", []),
                    "achievement_terms": profile.get("achievement_terms", []),
                },
                "sections_found": profile.get("sections_found", []),
            }
            
            logger.info(f"✅ Extraction successful. Found {len(profile.get('expanded_skills', []))} expanded skills")
            
            return serialize_response(success=True, data=response_data)
        
        finally:
            # Clean up temp file
            try:
                os.unlink(tmp_path)
            except:
                pass
    
    except APIError:
        raise
    except Exception as e:
        logger.error(f"Error in extract endpoint: {str(e)}")
        logger.error(traceback.format_exc())
        raise APIError(f"Resume processing failed: {str(e)}", 500)


@app.route('/api/expand-skills', methods=['POST'])
def expand_user_skills():
    """
    Expand a list of skills using the skill ontology
    
    Request:
    {
        "skills": ["Python", "Docker", "React"]
    }
    
    Response:
    {
        "success": true,
        "data": {
            "input_skills": ["Python", "Docker", "React"],
            "expanded_skills": ["Python", "OOP", ..., "Docker", "containerization", ...]
        }
    }
    """
    try:
        if not request.json:
            raise APIError("Request must be JSON", 400)
        
        skills = request.json.get('skills', [])
        
        if not isinstance(skills, list):
            raise APIError("skills must be a list", 400)
        
        if not skills:
            raise APIError("skills list cannot be empty", 400)
        
        logger.info(f"Expanding {len(skills)} skills...")
        
        # Expand skills using ontology
        expanded = expand_skills(skills)
        
        response_data = {
            "input_skills": skills,
            "expanded_skills": list(expanded),
            "new_skills_added": list(set(expanded) - set(skills))
        }
        
        logger.info(f"✅ Expanded {len(skills)} skills to {len(expanded)}")
        
        return serialize_response(success=True, data=response_data)
    
    except APIError:
        raise
    except Exception as e:
        logger.error(f"Error in expand-skills endpoint: {str(e)}")
        raise APIError(f"Skill expansion failed: {str(e)}", 500)


@app.route('/api/search', methods=['POST'])
def search_questions():
    """
    Search for interview questions based on resume profile
    
    Request:
    {
        "profile_string": "Technical skills and expertise: Python, Java...",
        "user_skills": ["Python", "Java", "Docker"],
        "top_k": 30,
        "min_score": 0.25,
        "use_tag_boosting": true,
        "with_explanations": true
    }
    
    Response:
    {
        "success": true,
        "data": {
            "questions": [
                {
                    "sr_no": 1,
                    "topic": "Python",
                    "question": "What is...",
                    "difficulty": "easy",
                    "tags": ["Python", "OOP"],
                    "similarity_score": 0.95,
                    "tag_overlap": 0.5,
                    ...
                },
                ...
            ],
            "total_found": 30,
            "processing_time_ms": 150
        }
    }
    """
    try:
        import time
        start_time = time.time()
        
        if not request.json:
            raise APIError("Request must be JSON", 400)
        
        profile_string = request.json.get('profile_string')
        user_skills = request.json.get('user_skills', [])
        top_k = request.json.get('top_k', 30)
        min_score = request.json.get('min_score', 0.25)
        use_tag_boosting = request.json.get('use_tag_boosting', True)
        with_explanations = request.json.get('with_explanations', False)
        
        # Validate inputs
        if not profile_string:
            raise APIError("profile_string is required", 400)
        
        if not isinstance(user_skills, list):
            raise APIError("user_skills must be a list", 400)
        
        if not isinstance(top_k, int) or top_k < 1 or top_k > 100:
            raise APIError("top_k must be between 1 and 100", 400)
        
        if not isinstance(min_score, (int, float)) or min_score < 0 or min_score > 1:
            raise APIError("min_score must be between 0 and 1", 400)
        
        logger.info(f"Searching for {top_k} questions with min_score={min_score}")
        
        # Search for questions
        if LIGHTWEIGHT_ML_MODE:
            results = build_questions_from_skills(
                skills=user_skills,
                max_per_skill=5,
                total_limit=top_k,
            )
        else:
            if with_explanations and user_skills:
                logger.info("Using detailed explanations mode")
            results = semantic_search_questions(
                profile_string=profile_string,
                user_skills=user_skills,
                top_k=top_k,
                min_score=min_score,
                with_explanations=with_explanations,
            )
        
        processing_time = int((time.time() - start_time) * 1000)
        
        response_data = {
            "questions": results,
            "total_found": len(results),
            "processing_time_ms": processing_time,
            "parameters": {
                "top_k": top_k,
                "min_score": min_score,
                "use_tag_boosting": use_tag_boosting,
                "with_explanations": with_explanations
            }
        }
        
        logger.info(f"✅ Found {len(results)} relevant questions in {processing_time}ms")
        
        return serialize_response(success=True, data=response_data)
    
    except APIError:
        raise
    except Exception as e:
        logger.error(f"Error in search endpoint: {str(e)}")
        logger.error(traceback.format_exc())
        raise APIError(f"Question search failed: {str(e)}", 500)


@app.route('/get-questions-by-skills', methods=['POST'])
def get_questions_by_skills():
    """Compatibility endpoint for frontend skill-based question fetch.

    Accepts JSON: { skills: ["Python", "Docker"], max_per_skill: 5 }
    Returns structure similar to the FastAPI implementation.
    """
    try:
        if not request.json:
            raise APIError("Request must be JSON", 400)

        skills = request.json.get('skills', [])
        max_per_skill = int(request.json.get('max_per_skill', 5))

        if not isinstance(skills, list) or len(skills) == 0:
            raise APIError("skills must be a non-empty list", 400)

        # Load dataset
        dataset = load_questions_dataset()

        if not dataset:
            # No dataset available; return empty results with message
            results = [{
                "skill": s,
                "matchedCount": 0,
                "questions": [],
            } for s in skills]

            return serialize_response(True, data={
                "message": "No questions dataset loaded",
                "totalQuestions": 0,
                "results": results,
            })

        results = []
        seen_questions = set()

        for skill in skills:
            matched_rows = match_skill_rows(skill, dataset)

            # Remove already seen question texts
            filtered = [r for r in matched_rows if (r.get('question') or '') not in seen_questions]

            # Sample up to max_per_skill
            if len(filtered) > max_per_skill:
                filtered = random.sample(filtered, max_per_skill)

            questions = []
            for row in filtered:
                q_text = row.get('question') or ''
                seen_questions.add(q_text)
                questions.append({
                    "question": q_text,
                    "topic": row.get('topic') or '',
                    "difficulty": row.get('difficulty') or '',
                })

            results.append({
                "skill": skill,
                "matchedCount": len(questions),
                "questions": questions,
            })

        total_questions = sum(r['matchedCount'] for r in results)

        return serialize_response(True, data={
            "message": f"Found {total_questions} questions across {len(skills)} skills",
            "totalQuestions": total_questions,
            "results": results,
        })

    except APIError:
        raise
    except Exception as e:
        logger.error("Error in get-questions-by-skills endpoint: %s", str(e))
        logger.error(traceback.format_exc())
        raise APIError("Internal server error", 500)


@app.route('/api/process', methods=['POST'])
def process_resume_end_to_end():
    """
    Complete end-to-end processing: extract skills and search questions
    
    Request:
    {
        "resume_base64": "base64-encoded-pdf-content",
        "filename": "resume.pdf",
        "top_k": 30,
        "min_score": 0.25
    }
    
    Response:
    {
        "success": true,
        "data": {
            "profile_string": "...",
            "raw_skills": [...],
            "expanded_skills": [...],
            "questions": [...],
            "total_questions": 30,
            "processing_time_ms": 5000
        }
    }
    """
    try:
        import time
        start_time = time.time()
        
        if not request.json:
            raise APIError("Request must be JSON", 400)
        
        resume_base64 = request.json.get('resume_base64')
        filename = request.json.get('filename', 'resume.pdf')
        top_k = request.json.get('top_k', 30)
        min_score = request.json.get('min_score', 0.25)
        
        if not resume_base64:
            raise APIError("resume_base64 is required", 400)
        
        logger.info("Starting end-to-end resume processing...")
        
        # Decode base64 PDF
        try:
            pdf_bytes = base64.b64decode(resume_base64)
        except Exception as e:
            raise APIError(f"Invalid base64 encoding: {str(e)}", 400)
        
        # Save to temporary file
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
            tmp.write(pdf_bytes)
            tmp_path = tmp.name
        
        try:
            # Step 1: Extract text and build profile
            logger.info("Step 1: Extracting resume text...")
            resume_text = extract_clean_text(tmp_path)
            
            if not resume_text or len(resume_text.strip()) < 50:
                raise APIError("Resume appears to be empty or invalid", 400)
            
            logger.info("Step 2: Building semantic profile...")
            profile = build_profile(resume_text)
            
            # Step 2: Search for questions
            logger.info("Step 3: Searching for relevant questions...")

            if LIGHTWEIGHT_ML_MODE:
                questions = build_questions_from_skills(
                    skills=profile.get("expanded_skills", []),
                    max_per_skill=5,
                    total_limit=top_k,
                )
            else:
                questions = semantic_search_questions(
                    profile_string=profile.get("profile_string", ""),
                    user_skills=profile.get("expanded_skills", []),
                    top_k=top_k,
                    min_score=min_score,
                    with_explanations=False,
                )
            
            processing_time = int((time.time() - start_time) * 1000)
            
            response_data = {
                "profile_string": profile.get("profile_string", ""),
                "raw_skills": profile.get("raw_skills", []),
                "expanded_skills": profile.get("expanded_skills", []),
                "extracted_data": {
                    "project_terms": profile.get("project_terms", []),
                    "experience_terms": profile.get("experience_terms", []),
                    "education_terms": profile.get("education_terms", []),
                },
                "sections_found": profile.get("sections_found", []),
                "questions": questions,
                "total_questions": len(questions),
                "processing_time_ms": processing_time,
            }
            
            logger.info(f"✅ End-to-end processing completed in {processing_time}ms")
            logger.info(f"   - Found {len(profile.get('expanded_skills', []))} expanded skills")
            logger.info(f"   - Generated {len(questions)} interview questions")
            
            return serialize_response(success=True, data=response_data)
        
        finally:
            # Clean up temp file
            try:
                os.unlink(tmp_path)
            except:
                pass
    
    except APIError:
        raise
    except Exception as e:
        logger.error(f"Error in process endpoint: {str(e)}")
        logger.error(traceback.format_exc())
        raise APIError(f"Resume processing failed: {str(e)}", 500)


# ──────────────────────────────────────────────────────────────────
# SERVER STARTUP
# ──────────────────────────────────────────────────────────────────

# if __name__ == '__main__':
#     port = int(os.environ.get('ML_API_PORT', 5001))
#     debug = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    
#     logger.info(f"Starting ML API Server on port {port}")
#     logger.info(f"Debug mode: {debug}")
#     logger.info(f"ML Scripts directory: {SCRIPT_DIR}")
    
#     app.run(
#         host='0.0.0.0',
#         port=port,
#         debug=debug,
#         use_reloader=debug
#     )


if __name__ == '__main__':
    import os

    port = int(os.environ.get('PORT', 5001))  # FIXED port
    debug = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    
    logger.info(f"Starting ML API Server on port {port}")
    logger.info(f"Debug mode: {debug}")
    logger.info(f"ML Scripts directory: {SCRIPT_DIR}")
    
    app.run(
        host='0.0.0.0',
        port=port,
        debug=debug,
        use_reloader=debug
    )


