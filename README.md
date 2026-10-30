# 🧠 Resume_based_AI_Interview_Question_Finder

> Upload your resume. Get personalized interview questions — semantically matched to your actual skills, projects, and experience.

---

## What Is This?

**ResumeBud** is a full-stack web application that takes a student's resume (PDF) and generates highly relevant, personalized interview questions using semantic understanding — not simple keyword matching.

You upload your resume, and the system reads it, understands what you know, infers what you likely know based on your skills, and returns a curated set of interview questions tailored specifically to your profile — grouped by topic and difficulty.

---

## Why Is This Different?

Most resume-based interview tools work on **keyword matching** — they scan your resume for the word "Python" and return questions tagged `#python`. That's it.

**ResumeBud works differently.**

### Semantic Understanding

Instead of matching keywords, we convert your entire resume profile into a dense vector using a sentence-transformer model (`all-MiniLM-L6-v2`). Every question in our dataset is also embedded the same way. We then find the questions that are *semantically closest* to your profile — meaning questions that relate to your actual knowledge area, even if the exact words never appear in your resume.

| Scenario | Keyword System | ResumeIQ |
|----------|---------------|----------|
| Resume has "Flask" | Returns only Flask-tagged questions | Also returns REST API design, HTTP methods, web server concepts |
| Resume has "MySQL" | Returns only MySQL questions | Also returns SQL joins, normalization, indexing, DBMS transactions |
| Resume has "React" | Returns only React questions | Also returns state management, component lifecycle, JavaScript fundamentals |

### Implicit Knowledge Inference

If your resume mentions a technology, you almost certainly know the concepts behind it — even if you didn't write them out. ResumeIQ accounts for this.

- Resume says **Java** → system also covers `OOP`, `JVM internals`, `multithreading`, `DSA`
- Resume says **Deep Learning** → system also covers `ML fundamentals`, `neural networks`, `backpropagation`
- Resume says **Docker** → system also covers `containerization`, `microservices`, `DevOps concepts`
- Resume says **MongoDB** → system also covers `NoSQL design`, `document modeling`, `ACID vs BASE`

This inference is powered by a hand-crafted skill ontology — a structured map of technologies to their implied concepts — combined with semantic vector search. The result is a question set that feels like it was picked by someone who actually read your resume and knows what to ask.

---

## What We're Building Toward

A tool where a CS/IT student can upload their resume 10 minutes before an interview and walk away with a focused, relevant, difficulty-calibrated set of questions that actually reflects what they know and what they're likely to be asked — not a generic question bank with their name on it.

---

*More documentation coming as the project develops.*

## Dependencies(.env requirements)
NODE_ENV
PORT
FRONTEND_URL
MONGODB_URI
JWT_ACCESS_SECRET
JWT_ACCESS_EXPIRY
EMAIL_TOKEN_EXPIRY_MINUTES
RESET_TOKEN_EXPIRY_MINUTES
DEFAULT_ADMIN_EMAIL

SMTP_HOST
SMTP_PORT
SMTP_SECURE
SMTP_USER
SMTP_PASS
EMAIL_FROM
