# Appendix — Full Code and Pointers

This appendix lists the primary code files in the repository that implement the functionality described in this report. Use these as starting points for reading or extended development.

- Backend API and ML: [ML_Preprocessor_scripts/ml_api.py](ML_Preprocessor_scripts/ml_api.py)
- FAISS index and preprocessor scripts: [ML_Preprocessor_scripts/build_faiss_index.py](ML_Preprocessor_scripts/build_faiss_index.py)
- Resume text extraction and helpers: [ML_Preprocessor_scripts/extract_text.py](ML_Preprocessor_scripts/extract_text.py)
- Model-serving / API server: [ML_Preprocessor_scripts/ml_api_server.py](ML_Preprocessor_scripts/ml_api_server.py)
- Frontend client code: [client/src](client/src) (React app)

How to run locally (developer notes):

1. Create Python environment and install requirements from `ML_Preprocessor_scripts/requirements.txt` (or root `requirements.txt`).

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r ML_Preprocessor_scripts/requirements.txt
```

2. Build or load the FAISS index:

```bash
python ML_Preprocessor_scripts/build_faiss_index.py --data data/questions.json --out_index faiss.index
```

3. Start the API server:

```bash
uvicorn ML_Preprocessor_scripts.ml_api_server:app --reload --host 0.0.0.0 --port 8000
```

4. Open the client (in `client/`) with `npm install` and `npm run dev` (or follow client/ README).

Notes:
- Replace file paths and model names to fit your environment. The project ships multiple helper scripts in `ML_Preprocessor_scripts/` for pre-processing and index-building.
