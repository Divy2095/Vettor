# Tag Implementation Checklist

Complete this checklist to implement the tag-based question labeling system.

## Phase 1: Setup & Testing (10 minutes)

- [ ] **Read documentation**
  - [ ] Read `TAG_IMPLEMENTATION_QUICK_START.md` (5 min overview)
  - [ ] Skim `TAG_MATCHING_GUIDE.md` for reference

- [ ] **Run demo script**
  ```bash
  python demo_tag_matching.py
  ```
  - [ ] See demo output without errors
  - [ ] Understand tag overlap calculation

- [ ] **Check current system**
  ```bash
  python -m tests.test_tag_matching
  ```
  - [ ] System loads resume from user_resumes/
  - [ ] Current index has 338 questions
  - [ ] Semantic search works (TEST 1)

## Phase 2: Prepare Your Data (20-30 minutes)

- [ ] **Gather Excel files**
  - [ ] Locate all interview question Excel/CSV files
  - [ ] Check column names: Sr No, Topic, Question, Difficulty

- [ ] **Add Tags column**
  For each file:
  - [ ] Open in Excel or CSV editor
  - [ ] Add new column: `Tags`
  - [ ] Fill each row with granular technical concepts
    ```
    Example: "binary-search, searching, arrays, algorithms"
    ```
  - [ ] Use lowercase, hyphenated format
  - [ ] Save file

  **Reference:** See `SAMPLE_QUESTIONS_WITH_TAGS.csv` for format

  **Tag Ideas by Category:**
  ```
  DSA:
    - sorting: quicksort, merge-sort, bubble-sort
    - searching: binary-search, linear-search
    - arrays: two-pointers, sliding-window
    - trees: dfs, bfs, level-order, inorder
    - dynamic-programming: memoization, recursion
  
  System Design:
    - caching: lru, redis, cache-strategies
    - databases: indexing, sharding, replication
    - load-balancing: round-robin, consistent-hashing
  
  Networks:
    - protocols: tcp-ip, udp, http, https
    - layers: osi-model, routing, dns
  ```

- [ ] **Place files in correct location**
  ```bash
  ML_Preprocessor_scripts/data/raw/
  ```
  - [ ] All Excel/CSV files moved to `data/raw/`
  - [ ] Files have `Tags` column

## Phase 3: Rebuild Index (5 minutes)

- [ ] **Backup current index (optional)**
  ```bash
  cd ML_Preprocessor_scripts/data
  cp questions.index questions.index.backup
  cp questions.json questions.json.backup
  ```

- [ ] **Run build script**
  ```bash
  cd /path/to/project
  python -m ML_Preprocessor_scripts.scripts.build_index
  ```
  - [ ] Script finds all Excel/CSV files
  - [ ] Script detects "Tags" column
  - [ ] Script shows sample tags parsed
  - [ ] Embeddings created (should be quick)
  - [ ] FAISS index saved (questions.index)
  - [ ] questions.json saved with tags

  **Expected output:**
  ```
  Found tag column: 'Tags'
  Sample tags: ['binary-search', 'searching', 'arrays']
  Encoding questions...
  Embeddings shape: (XXX, 384)
  FAISS index built: XXX vectors
  Saved index → .../questions.index
  Saved questions → .../questions.json
  ```

## Phase 4: Verify Tag Data (10 minutes)

- [ ] **Check questions.json structure**
  ```bash
  python3 << 'EOF'
  import json
  with open('ML_Preprocessor_scripts/data/questions.json') as f:
      data = json.load(f)
      q = data[0]
      print("First question:")
      print(f"  Question: {q.get('Question', 'N/A')[:50]}...")
      print(f"  Tags: {q.get('tags', [])}")
      print(f"  Topic: {q.get('Topic')}")
  EOF
  ```
  - [ ] Questions have `tags` field
  - [ ] Tags are lists (not strings): `['tag1', 'tag2']`
  - [ ] Tags are lowercase

- [ ] **Count tagged questions**
  ```bash
  python3 << 'EOF'
  import json
  with open('ML_Preprocessor_scripts/data/questions.json') as f:
      data = json.load(f)
      with_tags = sum(1 for q in data if q.get('tags'))
      total = len(data)
      print(f"Questions with tags: {with_tags}/{total}")
  EOF
  ```
  - [ ] Most questions have tags
  - [ ] No major data loss

## Phase 5: Test Tag-Based Search (15 minutes)

- [ ] **Run test with real resume**
  ```bash
  python -m ML_Preprocessor_scripts.tests.test_tag_matching
  ```
  - [ ] TEST 1 (baseline) shows semantic results
  - [ ] TEST 2 (tag-boosted) shows improved results
  - [ ] TEST 3 shows relevant explanations
  - [ ] Matching tags are displayed

- [ ] **Verify tag boosting is working**
  ```bash
  python3 << 'EOF'
  from ML_Preprocessor_scripts.pipeline.profile_builder import build_profile
  from ML_Preprocessor_scripts.search.searcher import search
  
  # Test with your resume
  profile, skills = build_profile("ML_Preprocessor_scripts/user_resumes/your_resume.pdf")
  
  results = search(
      profile_string=profile,
      user_skills=list(skills),
      use_tag_boosting=True,
      top_k=5
  )
  
  for r in results:
      print(f"Q: {r.get('Question', '')[:40]}...")
      print(f"  Semantic: {r.get('original_score', r.get('similarity_score')):.3f}")
      print(f"  Tag overlap: {r.get('tag_overlap', 0):.3f}")
      print(f"  Combined: {r.get('combined_score', r.get('similarity_score')):.3f}")
      print()
  EOF
  ```
  - [ ] Results show `combined_score` field
  - [ ] `tag_overlap` values are >0 for matched skills
  - [ ] Results ranked by `combined_score` (highest first)

## Phase 6: Integration (Optional - For Backend/API)

- [ ] **Update backend API (if using Express.js)**
  - [ ] Check `server/controllers/questionController.js`
  - [ ] Update search endpoint to use `use_tag_boosting=True`
  - [ ] Pass user_skills from profile
  - [ ] Return `combined_score` in response

  **Example:**
  ```python
  # In your ML service endpoint
  results = search(
      profile_string=profile_string,
      user_skills=user_skills,  # from resume extraction
      use_tag_boosting=True,
      top_k=30
  )
  ```

- [ ] **Update frontend (if using React)**
  - [ ] Display `matching_tags` in results
  - [ ] Show reason: "Matches your skills in: arrays, sorting"
  - [ ] Highlight tag matches in UI

## Phase 7: Optimization (Optional)

- [ ] **Fine-tune tag weight**
  
  Current: 30% tags, 70% semantic
  
  Test different weights:
  - [ ] Run with `tag_weight=0.2` (20% tags)
  - [ ] Run with `tag_weight=0.4` (40% tags)
  - [ ] Compare results
  - [ ] Choose best weight for your use case

  ```python
  from ML_Preprocessor_scripts.search.tag_matcher import boost_results
  
  # Re-boost with different weight
  results_reweighted = boost_results(
      results, 
      skills, 
      tag_weight=0.4  # Try different values
  )
  ```

- [ ] **Expand skill ontology (if needed)**
  - [ ] Edit `ML_Preprocessor_scripts/pipeline/ontology.py`
  - [ ] Add more skill expansions
  - [ ] Map skills to tags: `binary-search` → `["binary-search", "bsearch", "search"]`

## Phase 8: Documentation & Handoff

- [ ] **Document your tag scheme**
  - [ ] Create `TAG_SCHEME.md` in your project
  - [ ] List all tags used
  - [ ] Explain tag meanings
  - [ ] Provide examples

  **Template:**
  ```markdown
  # Our Question Tag Scheme
  
  ## DSA Tags
  - **sorting**: quicksort, merge-sort, bubble-sort, selection-sort
  - **searching**: binary-search, linear-search, jump-search
  - **arrays**: two-pointers, sliding-window, prefix-sum, kadane
  
  ## System Design Tags
  - **caching**: lru, cache-strategies, ttl
  - **databases**: sharding, replication, indexing
  ```

- [ ] **Update project README**
  - [ ] Add section: "Tag-Based Question Matching"
  - [ ] Link to TAG_IMPLEMENTATION_QUICK_START.md
  - [ ] Add example usage

- [ ] **Create runbook for maintenance**
  - [ ] How to add new questions with tags
  - [ ] How to rebuild index
  - [ ] How to troubleshoot

## Phase 9: Monitoring (Ongoing)

- [ ] **Track relevance improvements**
  - [ ] Compare `combined_score` before/after tags
  - [ ] Monitor user feedback on question quality
  - [ ] Check if top-10 results are more relevant

- [ ] **Collect user feedback**
  - [ ] Track which questions users find relevant
  - [ ] Identify missing or poor tags
  - [ ] Adjust tags based on feedback

- [ ] **Regular maintenance**
  - [ ] Monthly: Review new questions
  - [ ] Add tags to new questions
  - [ ] Rebuild index: `python -m scripts.build_index`

## ✅ Completion Checklist

- [ ] All phases completed (1-5 minimum, 6-9 recommended)
- [ ] Tag-boosted search working
- [ ] Results ranked correctly
- [ ] No errors in tests
- [ ] Documentation up to date
- [ ] Team notified of changes

---

## 🆘 Troubleshooting

### Build script says "No Excel files found"
- **Check:** Are files in `ML_Preprocessor_scripts/data/raw/`?
- **Check:** Are files `.xlsx` or `.csv`?
- **Fix:** Move files to correct location

### "No tag column found" warning
- **Check:** Does your Excel/CSV have `Tags` column?
- **Check:** Is column name exactly `Tags` or `tags`?
- **Fix:** Add column and re-run build

### Tag overlap always 0
- **Check:** Are user skills matching question tags?
- **Check:** Same format? Both lowercase? No spacing?
- **Fix:** Debug with:
  ```python
  user_skills = ["binary-search"]  # from resume
  q_tags = ["binary-search"]       # from question
  # Should match!
  ```

### Results not improving after tags
- **Check:** Did you use `use_tag_boosting=True`?
- **Check:** Are tags granular enough?
- **Fix:** Increase tag weight to 0.4-0.5

---

## ⏱️ Estimated Timeline

| Phase | Time | Status |
|-------|------|--------|
| 1: Setup & Testing | 10 min | - |
| 2: Prepare Data | 20-30 min | - |
| 3: Rebuild Index | 5 min | - |
| 4: Verify Data | 10 min | - |
| 5: Test Search | 15 min | - |
| 6: Integration | 30 min | Optional |
| 7: Optimization | 20 min | Optional |
| 8: Documentation | 20 min | Optional |
| **TOTAL** | **2-2.5 hours** | - |

---

**Next Step:** Start with Phase 1! 🚀

Read: [TAG_IMPLEMENTATION_QUICK_START.md](TAG_IMPLEMENTATION_QUICK_START.md)
