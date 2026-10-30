# 🚀 Quick Start Guide - Using Your Resume

## Step 1: Prepare Your Resume
1. Convert to PDF if not already (or export from Word/Google Docs as PDF)
2. Copy the file to: `ML_Preprocessor_scripts/user_resumes/`
3. You can name it anything: `resume.pdf`, `my_resume.pdf`, etc.

## Step 2: Run the Analysis
```bash
cd Resume_based_AI_Interview_Question_Finder
python ML_Preprocessor_scripts/tests/tests_extraction.py
```

## Step 3: View Results
The script will:
1. ✅ Extract text from your resume
2. ✅ Identify skills and experience
3. ✅ Find 30 most relevant interview questions
4. ✅ Display them grouped by topic and difficulty

## Output Example
```
============================================================
STEP 1 — Extracting text and building profile
============================================================

Sections found: ['header', 'education', 'skills', 'experience', ...]
Raw skills: ['python', 'java', 'databases', ...]
Expanded skills: ['python', 'java', 'OOP', 'JVM', ...]

============================================================
STEP 2 — Searching questions via FAISS
============================================================

Total matches above threshold: 30

============================================================
STEP 3 — Results grouped by topic
============================================================

── Algorithms (2 questions) ──
  [Easy] What is time complexity?
  [Medium] Explain dynamic programming

── Database (3 questions) ──
  [Easy] What is SQL?
  [Medium] Explain normalization
  ...
```

## Advanced: Analyze Skill Mapping
To see which skills map to which questions:
```bash
python ML_Preprocessor_scripts/analyze_skill_mapping.py
```

This shows:
- All skills extracted from your resume
- For each question: which of your skills match best
- Similarity scores for each match

## Troubleshooting

### "No PDF files found in user_resumes folder"
- Solution: Add a PDF file to `ML_Preprocessor_scripts/user_resumes/`

### "FileNotFoundError: kp_resume.pdf"
- This shouldn't happen - the system now looks in `user_resumes/` first
- If it still fails, check that the file exists in the correct folder

### "No matches above threshold"
- Try adjusting `min_score` parameter in the test script
- Default is 0.15 (on a scale of 0-1)
- Lower value = more results but less relevant

## FAQ

**Q: Can I use a resume with any name?**
A: Yes! Any PDF filename works (resume.pdf, john_doe.pdf, etc.)

**Q: Can I use multiple resumes?**
A: The system uses the first PDF found. To use another, rename or move the current one.

**Q: What if my resume has a weird format?**
A: The PDF extraction uses PyMuPDF (fitz). Most PDFs work fine.
   If extraction fails, try re-exporting the PDF from its source.

**Q: How accurate are the matches?**
A: The system uses semantic embeddings (SBERT), so matches are based on meaning, not keywords.
   Top 10 questions are usually highly relevant.

**Q: Can I retrain with my resume?**
A: No, the SBERT model is frozen (pretrained). It works as-is for any domain.

## Files Explained

```
ML_Preprocessor_scripts/
├─ user_resumes/                    ← 📁 PUT YOUR RESUME HERE
│  ├─ README.md                     ← Instructions
│  └─ your_resume.pdf               ← Your PDF file (any name)
│
├─ tests/
│  ├─ tests_extraction.py           ← Main test script
│  └─ kp_resume.pdf                 ← Sample resume (for fallback)
│
├─ analyze_skill_mapping.py         ← Detailed skill analysis
├─ pipeline/
│  ├─ resume_loader.py              ← Finds your resume PDF
│  ├─ pdf_parser.py                 ← Extracts text
│  ├─ profile_builder.py            ← Builds skill profile
│  └─ ...
└─ data/
   ├─ questions.index               ← FAISS index (338 questions)
   └─ questions.json                ← Question metadata
```

## Next Steps

1. ✅ Add your resume to `user_resumes/`
2. ✅ Run: `python ML_Preprocessor_scripts/tests/tests_extraction.py`
3. ✅ Review the questions
4. ✅ (Optional) Run: `python ML_Preprocessor_scripts/analyze_skill_mapping.py` for detailed mapping

Happy interviewing! 🎯
