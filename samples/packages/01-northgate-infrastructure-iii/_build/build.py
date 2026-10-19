#!/usr/bin/env python3
"""Reproducible generator for sample package 01 (Northgate Infrastructure Fund III).

Run:  python3 samples/packages/01-northgate-infrastructure-iii/_build/build.py
Writes the .docx files into ../docs/ and prints a check report (word counts, pages,
headings, seeded-defect quotes). Every name, number and address is fictional.
Helper modules live next to this file: common, sub_a/sub_b/sub_c, sub_doc, lpa, ppm, kyc, gpnote.
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from docx import Document  # noqa: E402
from common import words_of_docx  # noqa: E402
from sub_doc import FUND2, FUND3, make_sub  # noqa: E402
from lpa import make_lpa  # noqa: E402
from ppm import make_ppm  # noqa: E402
from kyc import make_kyc  # noqa: E402
from gpnote import make_email  # noqa: E402

DOCS = os.path.normpath(os.path.join(HERE, "..", "docs"))
FILES = {
    "01-NG3-Subscription-Agreement.docx": lambda p: make_sub(p, FUND3),
    "02-NG3-LPA-Definitions-and-Key-Terms.docx": make_lpa,
    "03-NG3-PPM-Summary-of-Terms.docx": make_ppm,
    "04-NG2-Subscription-Agreement-2024.docx": lambda p: make_sub(p, FUND2),
    "05-Meridale-AML-KYC-Requirements.docx": make_kyc,
    "06-GP-Email-Requirements-Note.docx": make_email,
}
TARGETS = {  # (min words, max words)
    "01-NG3-Subscription-Agreement.docx": (8000, 12000),
    "02-NG3-LPA-Definitions-and-Key-Terms.docx": (3500, 5000),
    "03-NG3-PPM-Summary-of-Terms.docx": (2000, 3000),
    "04-NG2-Subscription-Agreement-2024.docx": (7500, 10000),
    "05-Meridale-AML-KYC-Requirements.docx": (1200, 1800),
    "06-GP-Email-Requirements-Note.docx": (400, 700),
}

# Seeded defects in 01 (id -> verbatim quote that must be present)
SEEDS = {
    "D1": "to the Custodian indicated in Part B of Section 6",
    "D2": "paragraphs 1 through 4 of this Section 11",
    "D3": "the offered Units will not be registered",
    "D4": "[NTD: Hartwell & Crane to confirm the Class S minimum with tax counsel before filing.]",
    "D5": "[insert Final Closing Date]",
    "D6": "If the Investor is a Benefit Plan Investor, please complete Annex F.",
    "D6b": "Annex F (ERISA Representations)",
    "D7": "Eligible Transferee Certificate",
    "D9": "minimum Capital Commitment of $2,500,000",
    "D10": "ABA 021000000",
    "D10b": "Acct 000123456789",
    "Side letter (generic)": "any Side Letter entered into with the Investor",
    "Side letter (Kestrel)": "the Kestrel Side Letter",
    "Carve-out": "Capitalized terms used but not defined herein have the meanings given to them in the Partnership Agreement.",
}


def stats(path):
    d = Document(path)
    text = words_of_docx(path)
    words = len(text.split())
    heads = sum(1 for p in d.paragraphs if p.style.name.startswith("Heading"))
    return text, words, heads


def main():
    os.makedirs(DOCS, exist_ok=True)
    texts = {}
    print("%-46s %7s %6s %9s  %s" % ("file", "words", "pages", "headings", "target"))
    ok = True
    for name, fn in FILES.items():
        path = os.path.join(DOCS, name)
        fn(path)
        text, words, heads = stats(path)
        texts[name] = text
        lo, hi = TARGETS[name]
        flag = "OK" if lo <= words <= hi else "OUT OF RANGE"
        ok &= flag == "OK"
        print("%-46s %7d %6.1f %9d  %d-%d %s" % (name, words, words / 475, heads, lo, hi, flag))
    sub = texts["01-NG3-Subscription-Agreement.docx"]
    sub2 = texts["04-NG2-Subscription-Agreement-2024.docx"]
    lpa = texts["02-NG3-LPA-Definitions-and-Key-Terms.docx"]
    ppm = texts["03-NG3-PPM-Summary-of-Terms.docx"]
    print()
    n = len(sub.split())
    print("Main sub agreement >= 7,500 words:", "PASS" if n >= 7500 else "FAIL", "(%d)" % n)
    print("\nSeeded quotes in 01 (verbatim present):")
    for k, q in SEEDS.items():
        c = sub.count(q)
        ok &= c >= 1
        print("  %-24s %s  x%d  %r" % (k, "PRESENT" if c else "MISSING", c, q[:70]))
    print("\nNegative / consistency checks:")
    checks = [
        ("01 has exactly one 'Units' (D3 only)", len(re.findall(r"\bUnits?\b", sub)) == 1),
        ("01 has no Annex F heading", not re.search(r"^Annex F\.", sub, re.M)),
        ("01 uses 'Interests' as defined term", sub.count("Interests") > 20),
        ("Eligible Transferee Certificate absent from LPA", "Eligible Transferee Certificate" not in lpa),
        ("Eligible Transferee Certificate absent from PPM", "Eligible Transferee Certificate" not in ppm),
        ("LPA defines Capital Commitment", "“Capital Commitment” means" in lpa),
        ("LPA defines Closing Date", "“Closing Date” means" in lpa),
        ("LPA defines Defaulting Partner", "“Defaulting Partner” means" in lpa),
        ("LPA defines Benefit Plan Investor", "“Benefit Plan Investor” means" in lpa),
        ("01 does NOT define those four terms", not any("“%s” means" % t in sub for t in ("Capital Commitment", "Closing Date", "Defaulting Partner", "Benefit Plan Investor"))),
        ("PPM minimum is $5,000,000", "$5,000,000" in ppm),
        ("01 Section 1.2 minimum is $5,000,000", "minimum Capital Commitment is $5,000,000" in sub),
        ("04 (Fund II) has no Section 7A", "Section 7A" not in sub2),
        ("04 (Fund II) has no Singapore", "Singapore" not in sub2),
        ("04 (Fund II) has no 10.4 Sanctions", "10.4 Sanctions" not in sub2),
        ("04 4.2 old wording", "Each Investor that is an entity shall provide the names of its beneficial owners." in sub2),
        ("01 4.2 new wording", "Each Investor that is an entity formed or organized outside the United States shall provide the names of its beneficial owners." in sub),
        ("04 uses Units, not Interests", "Interests" not in sub2 and len(re.findall(r"\bUnits\b", sub2)) > 20),
        ("04 minimum $2,500,000", "minimum Capital Commitment is $2,500,000" in sub2),
        ("01 tax status 'select all that apply'", "(select all that apply)" in sub),
        ("04 tax status 'check one'", "Tax status of the Investor (check one)" in sub2),
        ("01 has Revocable + Irrevocable trust", "Revocable trust (grantor trust)" in sub and "Irrevocable trust" in sub),
        ("04 single 'Trust' option", "Trust" in sub2 and "Irrevocable trust" not in sub2),
        ("01 has Section 7A and 10.4", "7A. Source of Funds Verification" in sub and "10.4 Sanctions" in sub),
        ("01 Singapore domicile option", "Singapore" in sub),
        ("Source-of-funds threshold $1,000,000 in 01, 05", "$1,000,000 (the “Verification Threshold”)" in sub and "$1,000,000" in texts["05-Meridale-AML-KYC-Requirements.docx"]),
    ]
    for label, res in checks:
        ok &= bool(res)
        print("  %-62s %s" % (label, "PASS" if res else "FAIL"))
    print("\nOVERALL:", "ALL CHECKS PASS" if ok else "SOME CHECKS FAILED")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
