import fitz  # PyMuPDF

def extract_pdf_text(file_bytes: bytes, max_chars: int = 45_000) -> tuple[str, int]:
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    page_count = len(doc)
    pages: list[str] = []
    total_chars = 0

    for idx, page in enumerate(doc):
        text = page.get_text("text").strip()
        if not text:
            continue
        block = f"[PAGE {idx + 1}]\n{text}\n"
        if total_chars + len(block) > max_chars:
            break
        pages.append(block)
        total_chars += len(block)

    doc.close()
    return "\n".join(pages), page_count
