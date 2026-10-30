import pandas as pd
import numpy as np
import faiss
import json
from pathlib import Path
from sentence_transformers import SentenceTransformer

# Paths
BASE_DIR = Path(__file__).parent.parent
RAW_DIR   = BASE_DIR / "data" / "raw"
OUT_JSON  = BASE_DIR / "data" / "questions.json"
OUT_INDEX = BASE_DIR / "data" / "questions.index"


def build():
    # ── 1. Load all Excel and CSV files from raw folder ──────────────────
    print(f"Loading all data files from {RAW_DIR}...")
    
    # Support both Excel and CSV formats
    excel_files = list(RAW_DIR.glob("*.xlsx"))
    csv_files = list(RAW_DIR.glob("*.csv"))
    
    all_files = excel_files + csv_files
    
    if not all_files:
        print("No Excel or CSV files found!")
        return
    
    print(f"Found {len(excel_files)} Excel + {len(csv_files)} CSV = {len(all_files)} total file(s)")
    for f in all_files:
        print(f"  - {f.name}")
    
    # Combine all dataframes
    dfs = []
    for data_file in all_files:
        try:
            print(f"  Reading {data_file.name}...")
            if data_file.suffix.lower() == ".csv":
                df_temp = pd.read_csv(data_file)
            else:  # Excel
                df_temp = pd.read_excel(data_file)
            dfs.append(df_temp)
        except Exception as e:
            print(f"  ⚠ Error reading {data_file.name}: {e}")
    
    if not dfs:
        print("No valid data found!")
        return
    
    df = pd.concat(dfs, ignore_index=True)
    print(f"Columns found: {df.columns.tolist()}")

    # Normalize column names to lowercase
    df.columns = [c.strip().lower() for c in df.columns]
    df = df.dropna(subset=["question"]).reset_index(drop=True)
    print(f"Total questions after cleaning: {len(df)}")
    
    # ── 2. Parse and process tags ────────────────────────────────
    print("\nProcessing tags for questions...")
    
    def parse_tags(tag_value):
        """
        Parse tags from Excel (comma-separated string or list)
        Returns: list of tags (lowercase, stripped)
        """
        if pd.isna(tag_value):
            return []
        
        tag_str = str(tag_value).strip()
        if not tag_str:
            return []
        
        # Split by comma and clean
        tags = [t.strip().lower() for t in tag_str.split(',')]
        return [t for t in tags if t]  # Remove empty strings
    
    # Check if 'tags' or 'tag' column exists
    tag_column = None
    for col in df.columns:
        if 'tag' in col.lower():
            tag_column = col
            break
    
    if tag_column:
        print(f"Found tag column: '{tag_column}'")
        df['tags'] = df[tag_column].apply(parse_tags)
        print(f"Sample tags: {df['tags'].iloc[0] if len(df) > 0 else 'N/A'}")
    else:
        print("⚠ No tag column found. Using topic as tags.")
        # Fallback: use topic as a single tag
        df['tags'] = df.apply(
            lambda row: [str(row.get('topic', 'general')).lower().strip()],
            axis=1
        )

    # ── 2. Build text for embedding ──────────────────────────────
    # Combines topic + question for richer semantic signal
    def build_text(row):
        topic    = str(row.get("topic", "")).strip()
        question = str(row.get("question", "")).strip()
        return f"{topic} {question}".strip()

    texts = [build_text(row) for _, row in df.iterrows()]

    # ── 3. Encode with SBERT ─────────────────────────────────────
    print("Loading SBERT model...")
    model = SentenceTransformer("all-MiniLM-L6-v2")

    print("Encoding questions...")
    embeddings = model.encode(
        texts,
        normalize_embeddings=True,
        show_progress_bar=True,
        batch_size=64,
    )
    print(f"Embeddings shape: {embeddings.shape}")

    # ── 4. Build FAISS index ─────────────────────────────────────
    dim = embeddings.shape[1]  # 384
    index = faiss.IndexFlatIP(dim)
    index.add(np.array(embeddings, dtype="float32"))
    print(f"FAISS index built: {index.ntotal} vectors")

    # ── 5. Save outputs ──────────────────────────────────────────
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)

    faiss.write_index(index, str(OUT_INDEX))
    print(f"Saved index → {OUT_INDEX}")

    df.to_json(OUT_JSON, orient="records", indent=2)
    print(f"Saved questions → {OUT_JSON}")

    print("\nDone. You can now run the tests.")


if __name__ == "__main__":
    build()