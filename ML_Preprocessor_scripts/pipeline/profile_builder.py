from pipeline.section_splitter import split_sections, get_section
from pipeline.extract_resume_skills import extract_skills, SKILLS_DB
from pipeline.section_extractor import (
    extract_from_projects,
    extract_from_experience,
    extract_from_education,
    extract_from_summary,
    extract_from_achievements,
)
from pipeline.ontology import expand_skills


def build_profile(resume_text: str) -> dict:
    # Step 1: Split resume into sections
    sections = split_sections(resume_text)

    # Step 2: Extract from each section
    raw_skills       = extract_skills(get_section(sections, "skills"), SKILLS_DB)
    project_terms    = extract_from_projects(get_section(sections, "projects"))
    experience_terms = extract_from_experience(get_section(sections, "experience"))
    education_terms  = extract_from_education(get_section(sections, "education"))
    summary_terms    = extract_from_summary(get_section(sections, "summary"))
    achievement_terms= extract_from_achievements(get_section(sections, "achievements"))

    # Step 3: Expand skills via ontology
    expanded_skills = expand_skills(raw_skills)

    # Step 4: Build the profile string
    # Skills are mentioned first (and carry most weight for matching)
    profile_string = (
        f"Technical skills and expertise: {', '.join(expanded_skills)}. "
        f"Project experience: {', '.join(project_terms)}. "
        f"Work experience: {', '.join(experience_terms)}. "
        f"Educational background: {', '.join(education_terms)}. "
        f"Profile summary: {', '.join(summary_terms)}. "
        f"Achievements: {', '.join(achievement_terms)}."
    )

    return {
        "profile_string":    profile_string,
        "raw_skills":        raw_skills,
        "expanded_skills":   expanded_skills,
        "project_terms":     project_terms,
        "experience_terms":  experience_terms,
        "education_terms":   education_terms,
        "summary_terms":     summary_terms,
        "achievement_terms": achievement_terms,
        "sections_found":    list(sections.keys()),
    }


# ──────────────────────────────────────────────────────────────────
# CLI Interface for backward compatibility with Node.js
# Can be called from command line as: python profile_builder.py <resume_path>
# ──────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    import sys
    import json
    
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "Resume path is required",
            "usage": "python profile_builder.py <resume_path>"
        }))
        sys.exit(1)
    
    resume_path = sys.argv[1]
    
    try:
        from pdf_parser import extract_clean_text
        
        # Extract text from resume
        resume_text = extract_clean_text(resume_path)
        
        if not resume_text or len(resume_text.strip()) < 50:
            raise ValueError("Resume appears to be empty or invalid")
        
        # Build profile
        profile = build_profile(resume_text)
        
        # Output as JSON
        print(json.dumps(profile, indent=2, ensure_ascii=False))
    
    except Exception as e:
        print(json.dumps({
            "error": str(e),
            "type": type(e).__name__
        }))
        sys.exit(1)