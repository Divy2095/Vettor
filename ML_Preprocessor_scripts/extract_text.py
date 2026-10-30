import fitz
from collections import Counter

def extract_clean_text(pdf_path):
    text = []

    with fitz.open(pdf_path) as doc:
        for page in doc:
            blocks = page.get_text("blocks")
            
            blocks.sort(key=lambda b: (b[1], b[0]))

            for block in blocks:
                block_text = block[4].strip()

                if len(block_text) < 3:
                    continue

                text.append(block_text)

    return "\n".join(text)


# print(extract_clean_text("Resume_based_AI_Interview_Question_Finder/ML_Preprocessor_scripts/kp_resume.pdf"))

def remove_repeated_lines(text):
    lines = text.split("\n")
    freq = Counter(lines)

    cleaned = []
    for line in lines:
        # Remove lines repeated too many times
        if freq[line] > 5:
            continue
        cleaned.append(line)

    return "\n".join(cleaned) 

raw = extract_clean_text("Resume_based_AI_Interview_Question_Finder/ML_Preprocessor_scripts/kp_resume.pdf")
final_text = remove_repeated_lines(raw)

print(final_text)