"""Shared python-docx helpers for the Lotus Bay package generator."""
import re
from docx import Document
from docx.shared import Pt, Cm
from docx.enum.text import WD_BREAK, WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

BANNER = "FICTIONAL SAMPLE — test data for Sub-doc QA — not a real offering"
FN_RE = re.compile(r"<<fn:(.*?)>>")
BOLD_RE = re.compile(r"(\*\*.+?\*\*)")
SUP = "¹²³⁴⁵⁶⁷⁸⁹"  # unused; we use real superscript runs


def _field(run, instr):
    for t, txt in (("begin", None), (None, instr), ("end", None)):
        if t:
            el = OxmlElement("w:fldChar")
            el.set(qn("w:fldCharType"), t)
        else:
            el = OxmlElement("w:instrText")
            el.set(qn("xml:space"), "preserve")
            el.text = txt
        run._r.append(el)


class Doc:
    def __init__(self, title):
        self.title = title
        self.d = Document()
        st = self.d.styles["Normal"]
        st.font.name = "Times New Roman"
        st.font.size = Pt(11)
        st.element.rPr.rFonts.set(qn("w:eastAsia"), "Times New Roman")
        for name, size in (("Heading 1", 14), ("Heading 2", 12), ("Heading 3", 11)):
            h = self.d.styles[name]
            h.font.name = "Times New Roman"
            h.font.size = Pt(size)
            h.font.bold = True
            h.element.rPr.rFonts.set(qn("w:asciiTheme"), "") if False else None
        sec = self.d.sections[0]
        sec.left_margin = sec.right_margin = Cm(2.5)
        hp = sec.header.paragraphs[0]
        hp.text = BANNER
        hp.alignment = WD_ALIGN_PARAGRAPH.CENTER
        hp.runs[0].font.size = Pt(8)
        hp.runs[0].bold = True
        hp2 = sec.header.add_paragraph(title)
        hp2.alignment = WD_ALIGN_PARAGRAPH.CENTER
        hp2.runs[0].font.size = Pt(8)
        fp = sec.footer.paragraphs[0]
        fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = fp.add_run(BANNER + " | " + title + " | Page ")
        r.font.size = Pt(8)
        r2 = fp.add_run()
        r2.font.size = Pt(8)
        _field(r2, "PAGE")
        self.fns = []

    # ---- inline text with **bold** and {{fn:...}} ----
    def _add(self, par, text, bold=False, italic=False):
        pos = 0
        parts = []
        for m in FN_RE.finditer(text):
            parts.append(("t", text[pos:m.start()]))
            parts.append(("f", m.group(1).strip()))
            pos = m.end()
        parts.append(("t", text[pos:]))
        for kind, val in parts:
            if kind == "f":
                self.fns.append(val)
                r = par.add_run(str(len(self.fns)))
                r.font.superscript = True
                continue
            for seg in BOLD_RE.split(val):
                if not seg:
                    continue
                if seg.startswith("**") and seg.endswith("**") and len(seg) > 4:
                    r = par.add_run(seg[2:-2])
                    r.bold = True
                else:
                    r = par.add_run(seg)
                    r.bold = bold
                r.italic = italic

    def flush_footnotes(self):
        if not self.fns:
            return
        p = self.d.add_paragraph()
        p.paragraph_format.space_before = Pt(6)
        r = p.add_run("Footnotes")
        r.bold = True
        r.font.size = Pt(9)
        for i, t in enumerate(self.fns, 1):
            q = self.d.add_paragraph()
            q.paragraph_format.left_indent = Cm(0.5)
            a = q.add_run(str(i))
            a.font.superscript = True
            a.font.size = Pt(9)
            b = q.add_run(" " + t)
            b.font.size = Pt(9)
        self.fns = []

    # ---- structure ----
    def h1(self, t):
        self.flush_footnotes()
        self.d.add_heading(t, 1)

    def h2(self, t):
        self.d.add_heading(t, 2)

    def h3(self, t):
        self.d.add_heading(t, 3)

    def p(self, text, bold=False, italic=False, align=None, indent=0.0):
        par = self.d.add_paragraph()
        if indent:
            par.paragraph_format.left_indent = Cm(indent)
        if align == "center":
            par.alignment = WD_ALIGN_PARAGRAPH.CENTER
        self._add(par, text, bold, italic)
        return par

    def clause(self, num, title, text):
        par = self.d.add_paragraph()
        r = par.add_run(f"{num} {title}. ")
        r.bold = True
        self._add(par, text)
        return par

    def sub(self, label, text, level=1):
        par = self.d.add_paragraph()
        par.paragraph_format.left_indent = Cm(1.0 * level)
        self._add(par, f"{label} {text}")
        return par

    def table(self, rows, header=True, widths=None):
        t = self.d.add_table(rows=len(rows), cols=len(rows[0]))
        t.style = "Table Grid"
        for i, row in enumerate(rows):
            for j, cell in enumerate(row):
                c = t.cell(i, j)
                c.text = ""
                self._add(c.paragraphs[0], str(cell), bold=(header and i == 0))
                for run in c.paragraphs[0].runs:
                    run.font.size = Pt(10)
        if widths:
            for row in t.rows:
                for j, w in enumerate(widths):
                    row.cells[j].width = Cm(w)
        self.d.add_paragraph()
        return t

    def checks(self, items, title=None):
        rows = [["☐", i] for i in items]
        if title:
            rows.insert(0, ["", title])
        self.table(rows, header=bool(title), widths=[1.2, 14.0])

    def page_break(self):
        self.d.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    def save(self, path):
        self.flush_footnotes()
        self.d.save(path)
