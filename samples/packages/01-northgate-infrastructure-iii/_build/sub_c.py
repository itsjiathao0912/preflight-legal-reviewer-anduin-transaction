"""Subscription agreement template, part C: Annexes A-E. Fictional text."""
from common import *

CHK = "☐"


def fmt(s, c):
    return s.format(**c)


def build_c(d, c, fn):
    III = c["III"]
    P = lambda t, **k: para(d, fmt(t, c), **k)
    T = lambda rows, **k: table(d, [[fmt(x, c) for x in r] for r in rows], **k)

    # ---------- Annex A ----------
    page_break(d)
    h1(d, "Annex A. Investor Questionnaire")
    P("Complete every Item. Where an Item offers boxes, mark each box that applies. Use a separate sheet if more space is needed. The information is relied on by the Fund and the Administrator under Sections 4, 6, 9, 11 and 12.")
    h3(d, "Item 1. Investor Details")
    T([["Field", "Response"],
       ["Full legal name of Investor", ""],
       ["Tax identification number", ""],
       ["Date and place of formation or birth", ""],
       ["Principal address", ""],
       ["Mailing address (if different)", ""],
       ["Email address for notices", ""],
       ["Telephone number", ""],
       ["Capital Commitment (USD)", ""],
       ["Class of {I} (if the General Partner has advised you)", ""]])
    h3(d, "Item 2. Authorized Signatories and Custodian")
    T([["Field", "Response"],
       ["Name and title of authorized signatory", ""],
       ["Name and title of second signatory (if required)", ""],
       ["Direct telephone and email of signatory", ""],
       ["Name of Custodian (if any)", ""],
       ["Address of Custodian", ""],
       ["Custodian account name and number", ""],
       ["Contact person at Custodian", ""]])
    h3(d, "Item 3. Accredited Investor Status")
    P("Mark each category that applies to the Investor. At least one box must be marked.")
    T([["Mark", "Category"],
       [CHK, "A natural person with an individual net worth, or joint net worth with a spouse or spousal equivalent, that exceeds $1,000,000, excluding the primary residence"],
       [CHK, "A natural person with individual income that exceeds $200,000, or joint income with a spouse or spousal equivalent that exceeds $300,000, in each of the two most recent years, with a reasonable expectation of the same in the current year"],
       [CHK, "A trust with total assets that exceed $5,000,000, not formed to acquire {I}, directed by a sophisticated person"],
       [CHK, "A corporation, partnership, limited liability company or similar entity, not formed to acquire {I}, with total assets that exceed $5,000,000"],
       [CHK, "An entity all of whose equity owners are accredited investors"],
       [CHK, "A bank, insurance company, registered investment company, employee benefit plan or other institution described in Rule 501(a) of Regulation D"],
       [CHK, "A governmental plan with total assets that exceed $5,000,000"]])
    h3(d, "Item 4. Qualified Purchaser Status")
    P("Is the Investor a Qualified Purchaser as described in Section 12?")
    T([["Mark", "Response", "Category in Section 12 (1, 2, 3 or 4)"],
       [CHK, "Yes", "____"],
       [CHK, "No", "Not applicable"]])
    P("If the Investor is not a Qualified Purchaser, skip Item 5 and go to Item 6.")
    h3(d, "Item 5. Qualified Purchaser Details")
    T([["Field", "Response"],
       ["Date as of which investments were valued", ""],
       ["Aggregate investments owned (USD)", ""],
       ["Was the Investor formed to invest in the Fund? (Yes / No)", ""],
       ["Does the Investor rely on Section 3(c)(1) or 3(c)(7) of the Investment Company Act? (Yes / No)", ""]])
    h3(d, "Item 6. ERISA Status")
    P("Is the Investor a Benefit Plan Investor, or is it acting on behalf of one?")
    T([["Mark", "Response", "Percentage of the Investor’s assets that are plan assets"],
       [CHK, "Yes", "____ %"],
       [CHK, "No", "Not applicable"]])
    h3(d, "Item 7. Special Status")
    T([["Mark", "Status", "Further information"],
       [CHK, "The Investor is a governmental plan or public body that is subject to public records laws", "Identify statute: ____________"],
       [CHK, "The Investor is entitled to the benefit of a Side Letter", "Date of Side Letter: ____________"],
       [CHK, "The Investor is a regulated financial institution", "Regulator: ____________"],
       [CHK, "The Investor is a publicly listed company", "Exchange and ticker: ____________"],
       [CHK, "None of the above", "Not applicable"]])
    h3(d, "Item 8. Beneficial Owners")
    P("List each beneficial owner as described in Section 4.2. Attach additional sheets if necessary.")
    T([["Name of beneficial owner", "Country of residence", "Percentage held", "Nature of control"],
       ["", "", "", ""], ["", "", "", ""], ["", "", "", ""]])

    # ---------- Annex B ----------
    page_break(d)
    h1(d, "Annex B. Wire Instructions")
    P("All capital calls are payable by wire transfer to the following account, unless the General Partner notifies the Investor of a change in accordance with Section 14.7. The details below are fictional placeholders for testing and do not identify a real account.")
    T([["Item", "Detail"],
       ["Beneficiary name", "{FUND} — Subscription Account"],
       ["Beneficiary address", "{ADDR}, Boston, MA 02110"],
       ["Bank name", "Example Harbor Bank, N.A."],
       ["Bank address", "1 Example Plaza, Boston, MA 02110"],
       ["ABA routing number", "ABA 021000000"],
       ["Account number", "Acct 000123456789"],
       ["SWIFT code (international wires)", "EXHBUS33XXX"],
       ["Reference", "Investor name and the words “{FUND_SHORT} subscription”"]])
    P("Before sending any wire, the Investor shall call the Administrator at +1 212 555 0188, using a number that the Investor has verified independently, and confirm the instructions above orally. The Fund, the General Partner and the Administrator will never ask an Investor to change wire instructions by email alone.")
    P("Wires must be sent in United States dollars, in immediately available funds, and the Investor shall bear the cost of any intermediary bank or currency conversion fee. The Investor shall email a copy of the wire confirmation to the Administrator on the day of the wire so that the Administrator can match the payment to the Investor’s account.")

    # ---------- Annex C ----------
    page_break(d)
    h1(d, "Annex C. Tax Forms Guide")
    P("This Annex describes the tax forms that the Investor must deliver under Section 8. It is a guide only and is not tax advice. The forms and their instructions may be obtained from the Internal Revenue Service website.")
    T([["Investor", "Form to deliver", "Notes"],
       ["United States person (individual, entity, trust or governmental plan)", "Form W-9", "Sign and date; provide the tax identification number."],
       ["Non-United States individual", "Form W-8BEN", "Provide the foreign tax identification number if one exists."],
       ["Non-United States entity", "Form W-8BEN-E", "Complete the chapter 3 and chapter 4 status sections."],
       ["Non-United States government, pension fund or similar entity claiming special treatment", "Form W-8EXP", "Attach any documentation that supports the claim."],
       ["Entity that receives income through another person or is a flow-through", "Form W-8IMY and the forms of each owner", "The Administrator will confirm what is required."]])
    c3, c4 = ("C.3", "C.4") if III else ("C-3", "C-4")
    P("C-1. Each form must be signed by a person who is authorized to sign for the Investor and must be dated within the period that the form instructions permit.")
    P("C-2. If a form expires or any information on it becomes incorrect, the Investor shall deliver a new form within thirty days.")
    P(c3 + ". FATCA and CRS self-certification: each Investor that is an entity shall complete the self-certification form that the Administrator provides, stating its FATCA classification and, where applicable, its tax residence for CRS.")
    P(c4 + ". Investors that are disregarded entities shall deliver the form that corresponds to the tax status of their owner, and shall identify the owner in Annex A.")
    P("C-5. The Administrator will review the forms for completeness only. It does not review the Investor’s eligibility for any reduced rate of withholding and the Investor is responsible for that determination.")
    P("C-6. Withholding at the applicable rate will apply to any Investor that has not delivered a valid form by the date of the first distribution.")

    # ---------- Annex D ----------
    page_break(d)
    h1(d, "Annex D. AML/KYC Documents by Investor Type")
    P("The Administrator requires the documents below for each Investor type. The Administrator may ask for more documents after it has reviewed the first set. Copies must be certified in accordance with Section 7.2.")
    T([["Investor type", "Documents required"],
       ["Natural person", "Passport or national identity card; proof of residential address dated within three months; tax identification number"],
       ["Joint holders", "The documents required for a natural person, for each holder"],
       ["Corporation, limited liability company or partnership", "Certificate of formation or registration; constitutional documents; register of directors and of owners; list of authorized signatories with identification; beneficial owner details under Section 4.2"],
       ["Trust", "Trust instrument or certification of trust; identification of each trustee, settlor and beneficiary who is entitled to ten percent or more; evidence of the trustee’s authority"],
       ["Governmental plan or public body", "Statute or charter establishing the plan; list of authorized signatories with identification; letter confirming the plan’s authority to invest"],
       ["Regulated financial institution or listed company", "Evidence of the regulator or the exchange listing; list of authorized signatories with identification"]])
    P("Documents that are not in English must be translated by a certified translator. An Investor that cannot supply a document listed above shall contact the Administrator before submitting its Subscription Documents, and the Administrator will say whether an alternative is acceptable.")

    # ---------- Annex E ----------
    page_break(d)
    h1(d, "Annex E. Signature Pages")
    P("By signing below, the Investor agrees to subscribe for {I} in the Fund on the terms of this Agreement, makes the representations and warranties in it, and agrees to be bound by the Partnership Agreement as a Limited Partner.")
    h3(d, "Signature Page for Natural Persons")
    T([["Field", "Response"],
       ["Capital Commitment (USD)", ""], ["Signature", "____________________"], ["Printed name", ""], ["Date", ""],
       ["Signature of joint holder (if any)", "____________________"], ["Printed name of joint holder", ""]])
    h3(d, "Signature Page for Entities and Trusts")
    T([["Field", "Response"],
       ["Name of Investor", ""], ["Capital Commitment (USD)", ""], ["By (signature)", "____________________"],
       ["Name and title of signatory", ""], ["Date", ""],
       ["Name of trustee or second signatory (if required)", ""], ["Signature of trustee or second signatory", "____________________"]])
    h3(d, "Acceptance by the Fund")
    P("The foregoing subscription is accepted as of the date written below, for a Capital Commitment of $____________, and the Investor is admitted to the Fund as a Limited Partner on the Closing Date stated below.")
    T([["Field", "Response"],
       ["Fund", "{FUND}"],
       ["By", "{GP}, its General Partner"],
       ["Signature", "____________________"],
       ["Name and title", "Eleanor Voss, Authorized Person"],
       ["Closing Date", "____________________"],
       ["Date", ""]])
    P("End of Subscription Agreement.", italic=True)
