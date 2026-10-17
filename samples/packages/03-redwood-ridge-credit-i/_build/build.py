#!/usr/bin/env python3
"""Generate the Redwood Ridge Credit Opportunities Fund I sample package (all FICTIONAL).

Run:  python3 samples/packages/03-redwood-ridge-credit-i/_build/build.py
Reads the text sources in _build/src/*.txt (small markup, see parse_blocks) and writes docs/*.docx.
Deterministic: no randomness except a fixed-seed scan texture.
"""
import io
import random
import re
from pathlib import Path

from docx import Document
from docx.enum.section import WD_ORIENT  # noqa: F401
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
OUT = ROOT.parent / "docs"
DISCLAIMER = "FICTIONAL SAMPLE — test data for Sub-doc QA — not a real offering"

# (output file, [source files], footer title)
DOCS = [
    ("01-RR1-Subscription-Agreement.docx", ["01a.txt", "01b.txt", "01c.txt"],
     "Redwood Ridge Credit Opportunities Fund I, L.P. — Subscription Agreement"),
    ("02-RR1-LPA-Definitions.docx", ["02.txt"],
     "Redwood Ridge Credit Opportunities Fund I, L.P. — LPA Article I (Definitions)"),
    ("03-RR1-PPM-Summary.docx", ["03.txt"],
     "Redwood Ridge Credit Opportunities Fund I, L.P. — PPM Summary of Terms"),
    ("04-Pinecroft-AML-KYC-Checklist.docx", ["04.txt"],
     "Pinecroft Administration LLC — Investor AML and KYC Onboarding Checklist"),
    ("05-GP-Requirements-Email.docx", ["05.txt"],
     "GP Requirements Email — Subscription Document Review"),
]

INLINE = re.compile(r"(\*\*.+?\*\*|\^\{[^}]+\})")


def add_runs(par, text, size=None, bold=False):
    for part in INLINE.split(text):
        if not part:
            continue
        if part.startswith("**") and part.endswith("**"):
            r = par.add_run(part[2:-2])
            r.bold = True
        elif part.startswith("^{"):
            r = par.add_run(part[2:-1])
            r.font.superscript = True
            r.bold = bold
        else:
            r = par.add_run(part)
            r.bold = bold
        if size:
            r.font.size = Pt(size)


def add_field(par, instr):
    run = par.add_run()
    for kind, txt in (("begin", None), (None, instr), ("end", None)):
        if kind:
            el = OxmlElement("w:fldChar")
            el.set(qn("w:fldCharType"), kind)
        else:
            el = OxmlElement("w:instrText")
            el.set(qn("xml:space"), "preserve")
            el.text = txt
        run._r.append(el)
    run.font.size = Pt(8)


def setup_header_footer(doc, title):
    sec = doc.sections[0]
    hp = sec.header.paragraphs[0]
    hp.text = ""
    hp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = hp.add_run(DISCLAIMER)
    r.font.size = Pt(8)
    r.bold = True
    fp = sec.footer.paragraphs[0]
    fp.text = ""
    fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = fp.add_run(title + "  |  Page ")
    r.font.size = Pt(8)
    add_field(fp, "PAGE")


def base_styles(doc):
    st = doc.styles["Normal"]
    st.font.name = "Times New Roman"
    st.font.size = Pt(11)
    st.paragraph_format.space_after = Pt(6)
    for name, size in (("Heading 1", 14), ("Heading 2", 12), ("Heading 3", 11), ("Title", 16)):
        s = doc.styles[name]
        s.font.name = "Times New Roman"
        s.font.size = Pt(size)
        s.font.bold = True


def render_table(doc, rows):
    ncols = len(rows[0])
    t = doc.add_table(rows=len(rows), cols=ncols)
    t.style = "Table Grid"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, row in enumerate(rows):
        for j, cell_text in enumerate(row):
            cell = t.cell(i, j)
            cell.text = ""
            par = cell.paragraphs[0]
            par.paragraph_format.space_after = Pt(2)
            add_runs(par, cell_text, size=10, bold=(i == 0))
    doc.add_paragraph()


def build_doc(out_name, sources, title):
    doc = Document()
    base_styles(doc)
    setup_header_footer(doc, title)
    doc.core_properties.title = title
    doc.core_properties.author = "Fictional sample generator"
    lines = []
    for s in sources:
        lines += (SRC / s).read_text(encoding="utf-8").splitlines()
        lines.append("")
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i].rstrip()
        i += 1
        if not line.strip():
            continue
        if line == "---PB---":
            doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)
        elif line == "TABLE":
            rows = []
            while i < n and lines[i].strip() != "ENDTABLE":
                rows.append([c.strip() for c in lines[i].split(" | ")])
                i += 1
            i += 1
            render_table(doc, rows)
        elif line.startswith("#T "):
            p = doc.add_paragraph(style="Title")
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.add_run(line[3:])
        elif line.startswith("### "):
            doc.add_heading(line[4:], level=3)
        elif line.startswith("## "):
            doc.add_heading(line[3:], level=2)
        elif line.startswith("# "):
            doc.add_heading(line[2:], level=1)
        elif re.match(r"^FN \d+: ", line):
            num, txt = line[3:].split(": ", 1)
            p = doc.add_paragraph()
            r = p.add_run(num)
            r.font.superscript = True
            r.font.size = Pt(9)
            r = p.add_run(" " + txt)
            r.font.size = Pt(9)
        elif line.startswith("Footnotes to "):
            p = doc.add_paragraph()
            r = p.add_run(line)
            r.bold = True
            r.font.size = Pt(9)
        else:
            p = doc.add_paragraph()
            add_runs(p, line)
    OUT.mkdir(parents=True, exist_ok=True)
    doc.save(OUT / out_name)


def build_scan(out_name):
    """Single page, one embedded image, no text layer (simulates a scanned PDF-style file)."""
    from PIL import Image, ImageDraw, ImageFilter, ImageFont

    rnd = random.Random(7)
    w, h = 1240, 1754
    img = Image.new("L", (w, h), 244)
    d = ImageDraw.Draw(img)
    for _ in range(9000):  # paper grain
        x, y = rnd.randrange(w), rnd.randrange(h)
        d.point((x, y), fill=rnd.randrange(200, 240))
    font_paths = ["/System/Library/Fonts/Supplemental/Times New Roman.ttf",
                  "/System/Library/Fonts/Times.ttc", "/Library/Fonts/Arial.ttf"]
    def font(sz):
        for p in font_paths:
            try:
                return ImageFont.truetype(p, sz)
            except Exception:
                continue
        return ImageFont.load_default()
    d.text((120, 140), "Tax Forms Guide — scanned copy", fill=20, font=font(54))
    d.text((120, 230), "Redwood Ridge Credit Opportunities Fund I, L.P.", fill=40, font=font(34))
    d.text((120, 290), DISCLAIMER, fill=60, font=font(26))
    body = [
        "Which IRS form should an investor send?",
        "",
        "  U.S. person (individual or entity) ............ IRS Form W-9",
        "  Non-U.S. individual ........................... IRS Form W-8BEN",
        "  Non-U.S. entity ............................... IRS Form W-8BEN-E",
        "  Non-U.S. intermediary ......................... IRS Form W-8IMY",
        "",
        "Send the signed form to the Administrator with the",
        "subscription agreement. Do not email forms to the Manager.",
        "",
        "(This page is a picture only. It has no text layer.)",
    ]
    y = 420
    for ln in body:
        d.text((120, y), ln, fill=30, font=font(30))
        y += 56
    img = img.rotate(0.6, resample=Image.BICUBIC, fillcolor=240).filter(ImageFilter.GaussianBlur(0.6))
    buf = io.BytesIO()
    img.convert("L").save(buf, format="PNG")
    (ROOT / "scan-page.png").write_bytes(buf.getvalue())
    buf.seek(0)

    doc = Document()
    sec = doc.sections[0]
    sec.left_margin = sec.right_margin = sec.top_margin = sec.bottom_margin = Inches(0.5)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.add_run().add_picture(buf, width=Inches(7.4))
    doc.core_properties.title = "06-RR1-Tax-Forms-Guide-SCANNED"
    doc.core_properties.author = "Fictional sample generator"
    OUT.mkdir(parents=True, exist_ok=True)
    doc.save(OUT / out_name)


def main():
    for out_name, sources, title in DOCS:
        build_doc(out_name, sources, title)
    build_scan("06-RR1-Tax-Forms-Guide-SCANNED.docx")
    print("built", len(DOCS) + 1, "documents in", OUT)


if __name__ == "__main__":
    main()
