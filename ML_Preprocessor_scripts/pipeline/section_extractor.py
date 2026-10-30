import spacy

_nlp = None


def _get_nlp():
    global _nlp
    if _nlp is not None:
        return _nlp

    try:
        _nlp = spacy.load("en_core_web_sm")
    except OSError:
        _nlp = None

    return _nlp

DOMAIN_KEYWORDS = [
    "api", "rest", "graphql", "database", "backend", "frontend", "full stack",
    "authentication", "deployment", "real-time", "machine learning", "model",
    "neural network", "classification", "regression", "clustering", "nlp",
    "computer vision", "data pipeline", "cloud", "microservices", "caching",
    "optimization", "automation", "web scraping", "chatbot", "recommendation",
    "e-commerce", "payment gateway", "oauth", "jwt", "websocket", "socket.io",
    "crud", "mvc", "scalability", "load balancing", "data analysis", "dashboard",
    "visualization", "prediction", "training", "inference", "embedding",
    "search engine", "notification", "file upload", "image processing",
    "real time", "live", "stream", "queue", "event driven", "serverless",
]

EDUCATION_SIGNALS = [
    "computer science", "information technology", "software engineering",
    "data science", "artificial intelligence", "electronics", "mathematics",
    "data structures", "algorithms", "operating systems", "computer networks",
    "database management", "machine learning", "web development",
    "software development", "information systems",
]


def _extract_noun_phrases(text: str, min_words: int = 2, max_words: int = 4) -> list[str]:
    nlp = _get_nlp()
    if nlp is None or not nlp.has_pipe("parser"):
        return []

    doc = nlp(text)
    phrases = []

    try:
        for chunk in doc.noun_chunks:
            phrase = chunk.text.strip().lower()
            word_count = len(phrase.split())
            if min_words <= word_count <= max_words:
                phrases.append(phrase)
    except ValueError:
        return []

    return phrases


def extract_from_projects(text: str) -> list[str]:
    if not text:
        return []
    text_lower = text.lower()
    keywords = [kw for kw in DOMAIN_KEYWORDS if kw in text_lower]
    keywords += _extract_noun_phrases(text)
    return list(set(keywords))


def extract_from_experience(text: str) -> list[str]:
    if not text:
        return []
    text_lower = text.lower()
    keywords = [kw for kw in DOMAIN_KEYWORDS if kw in text_lower]
    keywords += _extract_noun_phrases(text)
    return list(set(keywords))


def extract_from_education(text: str) -> list[str]:
    if not text:
        return []
    text_lower = text.lower()
    return [sig for sig in EDUCATION_SIGNALS if sig in text_lower]


def extract_from_summary(text: str) -> list[str]:
    if not text:
        return []
    return _extract_noun_phrases(text, min_words=1, max_words=3)


def extract_from_achievements(text: str) -> list[str]:
    if not text:
        return []
    return _extract_noun_phrases(text, min_words=1, max_words=3)