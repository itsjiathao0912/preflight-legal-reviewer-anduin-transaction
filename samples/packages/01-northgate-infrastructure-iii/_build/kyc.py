"""Administrator AML/KYC requirements (requirement / reference document). Fictional text."""
from common import *


def make_kyc(path):
    title = "Meridale Fund Services Ltd. — AML/KYC Requirements for Northgate Infrastructure Fund III, L.P."
    d = new_doc(title)
    P = lambda t, **k: para(d, t, **k)
    d.add_heading("Meridale Fund Services Ltd.", level=0)
    d.add_heading("AML/KYC Requirements — Northgate Infrastructure Fund III, L.P.", level=0)
    P("Investor onboarding requirements issued by the Administrator. Version 2026-08. Fictional sample document prepared for software testing; Meridale Fund Services Ltd. is a fictitious administrator.", italic=True)

    h1(d, "1. Purpose and Scope")
    P("This document sets out the information and documents that Meridale Fund Services Ltd. (the Administrator) requires from each investor in Northgate Infrastructure Fund III, L.P. (the Fund) before the investor is admitted. It applies to every investor, to every beneficial owner of an investor, and to every person who is authorized to give instructions on behalf of an investor.")
    P("The requirements implement the anti-money laundering, counter-terrorist financing and sanctions obligations of the Fund and the Administrator. They apply together with Section 7 and the annexes of the subscription agreement of the Fund. If the subscription agreement and this document differ, the stricter requirement applies, and the Administrator will explain the difference to the investor on request.")

    h1(d, "2. General Requirements")
    for t in [
        "All documents must be legible, current and in English, or accompanied by a certified translation.",
        "Copies of identification documents must be certified by a lawyer, notary, or other person that the Administrator accepts, and the certification must be dated within three months of the date of submission.",
        "Proof of address must be dated within three months of the date of submission and may be a utility bill, a bank statement or an official letter from a government authority.",
        "Each beneficial owner who owns or controls twenty-five percent or more of an investor, and each person who exercises control by other means, must be identified and verified.",
        "The Administrator screens every investor, beneficial owner and signatory against sanctions lists and politically exposed person lists, and repeats the screening at least once a year.",
        "The Administrator takes up to ten business days to complete its review after it has received a complete set of documents.",
    ]:
        P("• " + t, indent=1)

    h1(d, "3. Documents by Investor Type")
    table(d, [
        ["Investor type", "Identity and structure documents", "Beneficial owners and controllers", "Additional requirements"],
        ["Natural person", "Passport or national identity card; proof of residential address", "Not applicable", "Tax identification number; occupation and employer"],
        ["Joint holders", "The documents for a natural person, for each holder", "Not applicable", "Statement of the relationship between the holders"],
        ["Corporation or limited liability company", "Certificate of incorporation or formation; constitutional documents; good standing certificate", "Register of owners; identification of each owner of twenty-five percent or more; register of directors", "List of authorized signatories with identification and specimen signatures"],
        ["Partnership", "Partnership agreement or certificate of registration", "Identification of each partner that owns twenty-five percent or more and of each general partner", "List of authorized signatories"],
        ["Revocable trust", "Trust instrument or certification of trust", "Identification of each settlor, each trustee and each person with the power to revoke", "Evidence of the trustee’s authority; tax identification number"],
        ["Irrevocable trust", "Trust instrument or certification of trust", "Identification of each trustee, each settlor, the protector and each beneficiary entitled to ten percent or more", "Evidence of the trustee’s authority; tax identification number"],
        ["Governmental plan or public body", "Statute, charter or enabling resolution", "Not applicable unless the Administrator requests it", "Letter confirming authority to invest; list of authorized signatories"],
        ["Regulated financial institution or listed company", "Evidence of the license or registration, or of the exchange listing", "Not applicable unless the Administrator requests it", "Regulator’s register extract; list of authorized signatories"],
        ["Entity formed outside the United States", "Certificate of formation or registration, or the equivalent extract from the company register in its jurisdiction", "Names and identification of beneficial owners, as required by the subscription agreement", "Certified translation if not in English; evidence of registered address"],
    ])

    h1(d, "4. Source of Funds")
    P("An investor whose capital commitment is $1,000,000 or more must give the Administrator evidence of the source of the funds that it will use to fund its commitment. The evidence must be dated within the twelve months before the investor delivers it. An investor whose commitment is below $1,000,000 does not need to deliver this evidence unless the Administrator requests it on the basis of a risk assessment.")
    P("The Administrator accepts any of the following as evidence of source of funds: audited financial statements; a recent bank or custody statement that shows sufficient funds; a signed letter from the investor’s accountant or auditor; the documents relating to a sale, inheritance or other event that gave rise to the funds; and any other document that the Administrator considers reliable. The Administrator may ask for source of wealth information from an investor that it regards as higher risk.")
    P("An investor that is a regulated financial institution, a governmental plan or a publicly listed company may satisfy this requirement by giving the evidence of its status that is listed in Section 3, if the Administrator accepts it as sufficient for the investor’s risk profile. An investor that increases its commitment above the threshold after admission must give the evidence within ten business days of the increase.")

    h1(d, "5. Risk Assessment")
    P("The Administrator assigns each investor a risk rating of low, medium or high, taking into account the investor’s type, the jurisdiction in which it is formed or resident, the nature of its business, the source of its funds, and the results of sanctions and politically exposed person screening. Investors that are rated high risk are subject to enhanced due diligence, which may include additional identification, an interview, adverse media searches, and approval by the Administrator’s money laundering reporting officer.")
    P("Jurisdictions that are subject to a call for action by an international standard-setting body, or that are subject to comprehensive sanctions, are not accepted. The Administrator will notify the General Partner if an investor is located in, or has beneficial owners resident in, a jurisdiction that the Administrator regards as high risk.")

    h1(d, "6. Ongoing Monitoring and Changes")
    P("Each investor must notify the Administrator within thirty days of any change in the information that it has provided, including a change of address, of signatory, of beneficial owner or of tax status. The Administrator reviews the documents of each investor periodically, at least every three years for low risk investors and at least every year for high risk investors, and may ask for updated documents.")
    P("The Administrator may refuse to process a payment, suspend an investor’s rights, or freeze an investor’s account if it is required to do so by law or if it suspects money laundering or sanctions evasion. The Administrator may be required to report suspicious activity to the authorities and may be prohibited from telling the investor that a report has been made.")

    h1(d, "7. Entities Formed Outside the United States")
    P("An investor that is formed or organized outside the United States must give the Administrator the names and identification of its beneficial owners at the time of subscription. This applies in every jurisdiction that the Fund accepts, including the United Kingdom, the European Economic Area, Switzerland, Japan, Australia and Singapore. The Administrator accepts the equivalent of a certificate of formation that is issued by the company register of the investor’s jurisdiction, provided that it is dated within three months and shows the registered address and the directors.")
    P("The Administrator may ask a non-United States investor for a statement of its tax residence for the purposes of the Common Reporting Standard, and for the tax form that corresponds to its status. The Administrator does not review the content of tax forms for eligibility and refers any question about eligibility to the investor’s own advisers.")
    h1(d, "8. Contacts")
    P("Investors should send their documents to subscriptions@meridale.example.com. Questions may be directed to the Administrator’s investor services team by telephone at +1 212 555 0188. The Administrator will not accept documents by any other channel and will never ask an investor to send documents or money to a personal email address or account.")
    d.save(path)
