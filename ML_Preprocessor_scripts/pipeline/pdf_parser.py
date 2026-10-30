import fitz
from collections import Counter


def extract_clean_text(pdf_path: str) -> str:
    text_blocks = []

    with fitz.open(pdf_path) as doc:
        for page in doc:
            blocks = page.get_text("blocks")
            blocks.sort(key=lambda b: (b[1], b[0]))

            for block in blocks:
                block_text = block[4].strip()
                if len(block_text) < 3:
                    continue
                text_blocks.append(block_text)

    raw = "\n".join(text_blocks)
    return _remove_repeated_lines(raw)


def _remove_repeated_lines(text: str) -> str:
    lines = text.split("\n")
    freq = Counter(lines)
    cleaned = [
        line for line in lines
        if not (freq[line] > 5 and len(line.split()) < 3)
    ]
    return "\n".join(cleaned)