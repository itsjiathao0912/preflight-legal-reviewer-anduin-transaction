from common import *
from sub_a import build_a
from sub_b import build_b
from sub_c import build_c

FUND3 = dict(
    III=True, FUND="Northgate Infrastructure Fund III, L.P.", FUND_SHORT="Northgate III",
    GP="Northgate Infrastructure Partners III GP, LLC", I="Interests", i="Interest",
    MIN="$5,000,000", ADDR="200 Harborview Drive, Suite 1400", FIRST="September 15, 2026",
    PPM_DATE="June 2026", LPA_DATE="September 15, 2026",
    LPA_TITLE="Amended and Restated Agreement of Limited Partnership")
FUND2 = dict(
    III=False, FUND="Northgate Infrastructure Fund II, L.P.", FUND_SHORT="Northgate II",
    GP="Northgate Infrastructure Partners II GP, LLC", I="Units", i="Unit",
    MIN="$2,500,000", ADDR="200 Harborview Drive, Suite 1200", FIRST="September 12, 2024",
    PPM_DATE="June 2024", LPA_DATE="September 12, 2024",
    LPA_TITLE="Amended and Restated Agreement of Limited Partnership")


def make_sub(path, c):
    title = c["FUND"] + " — Subscription Agreement"
    d = new_doc(title)
    fn = Footnotes(d)
    build_a(d, c, fn)
    build_b(d, c, fn)
    build_c(d, c, fn)
    d.save(path)
