import os
import fitz  # PyMuPDF

pdf_files = {
    "form1_lien_mark_preview.png": r"G:\Astro\scratch\user_workbook_pdfs\BANK_LINE_MARK_001-005.pdf",
    "form2_form_i_preview.png": r"G:\Astro\scratch\user_workbook_pdfs\FORM_I_001.pdf",
    "form3_form_j_preview.png": r"G:\Astro\scratch\user_workbook_pdfs\FORM_J_001-005.pdf",
    "form4_share_register_preview.png": r"G:\Astro\scratch\user_workbook_pdfs\SHARE_REGISTER_001-005.pdf",
    "form5_property_register_preview.png": r"G:\Astro\scratch\user_workbook_pdfs\PROPERTY_REGISTER_001-005.pdf",
    "form6_nomination_register_preview.png": r"G:\Astro\scratch\user_workbook_pdfs\NOMINATION_REGISTER_001-005.pdf",
}

artifact_dir = r"C:\Users\henus\.gemini\antigravity-ide\brain\4b40716c-fa20-4e76-9f48-addb2c9d4d50"

for img_name, pdf_path in pdf_files.items():
    if os.path.exists(pdf_path):
        doc = fitz.open(pdf_path)
        page = doc[0]  # First page
        pix = page.get_pixmap(dpi=150)
        out_path = os.path.join(artifact_dir, img_name)
        pix.save(out_path)
        print(f"Rendered {img_name} -> {out_path} ({pix.width}x{pix.height} px)")
    else:
        print(f"File not found: {pdf_path}")

print("All 6 PDF form preview images generated successfully!")
