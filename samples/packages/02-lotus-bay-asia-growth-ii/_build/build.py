#!/usr/bin/env python3
"""Reproducible generator for the Lotus Bay Asia Growth Fund II sample package.
Run:  python3 samples/packages/02-lotus-bay-asia-growth-ii/_build/build.py
Writes every .docx into ../docs/.  Modules in this folder: common.py (helpers),
subagr.py (v2 + v1 subscription agreements), others.py (questionnaire, PPM summary, side letter, W-8 guide)."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import subagr, others

OUT = os.path.join(HERE, "..", "docs")
os.makedirs(OUT, exist_ok=True)

subagr.build(subagr.variant(2), os.path.join(OUT, "01-LB2-Subscription-Agreement-Offshore-v2.docx"))
others.questionnaire(os.path.join(OUT, "02-LB2-Investor-Questionnaire-Standalone.docx"))
others.ppm(os.path.join(OUT, "03-LB2-PPM-Summary.docx"))
subagr.build(subagr.variant(1), os.path.join(OUT, "04-LB2-Subscription-Agreement-Offshore-v1-draft.docx"))
others.side_letter(os.path.join(OUT, "05-Sakura-Side-Letter.docx"))
others.w8_guide(os.path.join(OUT, "06-Harbourline-W8-Guide.docx"))
print("built", sorted(os.listdir(OUT)))
