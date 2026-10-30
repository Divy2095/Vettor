# 📄 User Resumes Folder

This folder is where you should place your resume PDF file for analysis.

## How to Use

1. **Add your resume**: Place any PDF file in this folder
   - Name can be anything: `my_resume.pdf`, `john_doe.pdf`, `resume.pdf`, etc.
   - Supported format: PDF only

2. **Run analysis**: The system will automatically find and use your resume
   ```bash
   cd /path/to/Resume_based_AI_Interview_Question_Finder
   python ML_Preprocessor_scripts/tests/tests_extraction.py
   ```

3. **View results**: Get personalized interview questions based on your resume

## Examples

✅ Valid resume names:
- `resume.pdf`
- `my_resume.pdf`
- `John_Doe_Resume.pdf`
- `CV_2024.pdf`
- `application.pdf`

❌ Invalid:
- `resume.docx` (must be PDF)
- `resume.txt` (must be PDF)
- Folders (must be files)

## Technical Details

- The system will use the **first PDF file** it finds in this folder
- If multiple PDFs exist, it will use the first one alphabetically
- If no PDF is found, it falls back to the test resume in `tests/` folder

## What Happens Next?

Once you add a resume:
1. PDF text is extracted
2. Skills are identified (raw + expanded via skill ontology)
3. Semantic embeddings are generated (SBERT model)
4. Similar questions are retrieved using FAISS search
5. Results are grouped by topic and difficulty

See `QUICK_START.md` for more details.
