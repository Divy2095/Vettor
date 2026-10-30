SECTION_HEADERS = {
    "skills":     ["skills", "technical skills", "technologies", "tools",
                   "core competencies", "technical expertise", "tech stack"],
    "projects":   ["projects", "personal projects", "academic projects",
                   "key projects", "project work", "works"],
    "experience": ["experience", "work experience", "internship", "internships",
                   "employment", "professional experience", "work history"],
    "education":  ["education", "academic background", "qualifications",
                   "academic qualifications", "educational background"],
    "summary":    ["summary", "objective", "about me", "profile",
                   "career objective", "professional summary", "overview"],
    "achievements": ["achievements", "awards", "certifications", "accomplishments",
                     "honors", "certificates"],
}


def split_sections(text: str) -> dict[str, str]:
    lines = text.split("\n")
    sections = {}
    current_section = "header"
    current_lines = []

    for line in lines:
        stripped = line.strip()
        lower = stripped.lower()

        matched = None
        for section_key, keywords in SECTION_HEADERS.items():
            if any(lower == kw or lower.startswith(kw) for kw in keywords):
                matched = section_key
                break

        if matched:
            if current_lines:
                sections[current_section] = "\n".join(current_lines).strip()
            current_section = matched
            current_lines = []
        else:
            if stripped:
                current_lines.append(stripped)

    if current_lines:
        sections[current_section] = "\n".join(current_lines).strip()

    return sections


def get_section(sections: dict, key: str) -> str:
    return sections.get(key, "")