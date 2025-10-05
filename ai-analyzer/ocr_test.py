import pdfplumber
import pytesseract
from PIL import Image
import io

pdf_path = "C:/Users/yedid/Desktop/grant-platform/ai-analyzer/samples/test.pdf"

try:
    with pdfplumber.open(pdf_path) as pdf:
        text = ""
        for page in pdf.pages:
            text += page.extract_text() or ""
    if text.strip():
        print("✅ Text extracted successfully using pdfplumber:")
        print(text[:500])
    else:
        print("⚠️ No text found with pdfplumber. Trying OCR...")

        from pdf2image import convert_from_path
        pages = convert_from_path(pdf_path)
        text = ""
        for page_img in pages:
            text += pytesseract.image_to_string(page_img)

        if text.strip():
            print("✅ Text extracted using OCR (pytesseract):")
            print(text[:500])
        else:
            print("❌ No readable text found in the file.")
except Exception as e:
    print("Error:", e)
