"""GP email requirements note (requirement document). Fictional text."""
from common import *


def make_email(path):
    title = "Email from Eleanor Voss — Northgate Infrastructure Fund III GP requirements"
    d = new_doc(title)
    P = lambda t, **k: para(d, t, **k)
    d.add_heading("Email: GP Requirements for the Fund III Subscription Agreement", level=1)
    table(d, [["Field", "Detail"],
              ["From", "Eleanor Voss <eleanor.voss@example.com>"],
              ["To", "Margaret Lin <margaret.lin@example.com> (Hartwell & Crane LLP); Meridale Fund Services onboarding team <onboarding@meridale.example.com>"],
              ["Cc", "Daniel Okafor <daniel.okafor@example.com>"],
              ["Date", "August 24, 2026"],
              ["Subject", "Fund III subscription documents — what we need before the September 15 closing"]], header=False)
    P("Margaret, team,")
    P("Thank you for the draft Fund III subscription documents. Daniel and I have been through them against the PPM and the Fund II package. We are comfortable with the structure. Below are the points that we need reflected before we send the documents to investors. Please treat the list as our requirements; where the draft does not yet reflect them, tell us and we will agree the wording.")
    P("1. We will accept Singapore investors. Tanjong Pagar Holdings Pte. Ltd. has asked to subscribe and we want Fund III to be open to Singapore investors generally, on the same terms as our other non-United States investors. The jurisdiction list needs a Singapore entry. Margaret, please confirm that the PPM legend and the offering restrictions are in order for Singapore, and Meridale, please confirm that you can onboard a Singapore entity with the documents you already require.")
    P("2. The minimum is $5 million, waivable. Fund II had a $2.5 million minimum. For Fund III the minimum commitment is $5,000,000, and I want to keep the right to waive or reduce it in my discretion, for family offices and for investors that have a long relationship with us. Please make sure that every document that states the minimum says the same thing.")
    P("3. A sanctions representation is required. Fund II did not have a standalone sanctions representation. For Fund III, please add one to the subscription agreement, covering the investor, its beneficial owners and its controlling persons, and the proceeds of distributions. Our lenders now ask us about it and I would rather have it in the document than rely on the general compliance representation.")
    P("4. Source of funds. Meridale, we have discussed a verification threshold of $1,000,000 for source of funds evidence. Please keep the threshold at that level in your requirements, and Margaret, please make sure the subscription agreement says the same. I would like investors below the threshold not to be asked unless Meridale sees a risk reason.")
    P("5. Beneficial owners. For investors formed outside the United States we want the names of beneficial owners at the subscription stage. For United States entities we do not want to ask for them in the subscription agreement; Meridale can collect them during onboarding if needed.")
    P("6. Trusts. Please distinguish revocable trusts from irrevocable trusts in the investor type list. Margaret Whitfield’s trust is revocable and will want the grantor trust treatment, and the onboarding requirements differ.")
    P("7. Kestrel. Kestrel State Teachers’ Retirement System will have a side letter with most favored nation rights and environmental, social and governance reporting. Margaret, I understand that you are still finalizing it. Please make sure the subscription agreement points to it correctly.")
    P("We expect to hold the first closing on September 15, with the final closing within twelve months of that date. Please let me know by August 31 if any of the above cannot be done on that timetable.")
    P("Thanks,")
    P("Eleanor")
    P("Eleanor Voss, Managing Partner, Northgate Capital Management, LLC, 200 Harborview Drive, Suite 1400, Boston, MA 02110. Telephone +1 617 555 0101.")
    P("This message is a fictional sample prepared for software testing.", italic=True)
    d.save(path)
