"""Subscription agreement template, part B: Sections 7-14. Fictional text."""
from common import *

CHK = "☐"


def fmt(s, c):
    return s.format(**c)


def build_b(d, c, fn):
    III = c["III"]
    P = lambda t, **k: para(d, fmt(t, c), **k)
    T = lambda rows, **k: table(d, [[fmt(x, c) for x in r] for r in rows], **k)

    # ---------- Section 7 ----------
    h1(d, "7. Anti-Money Laundering")
    h2(d, "7.1 Compliance with AML Laws")
    P("The Investor acknowledges that the Fund, the General Partner, the Manager and the Administrator are required to comply with laws and regulations designed to prevent money laundering, terrorist financing and the financing of the proliferation of weapons (together, “AML Laws”), and that the Fund may be required to obtain, verify and retain information about the Investor, its beneficial owners and the source of its funds before admitting the Investor and from time to time afterwards.")
    P("The Investor represents that the funds it will use to make its Capital Commitment and each Capital Contribution are not derived from, and will not be used to promote, any criminal activity, and that the Investor is not subject to any investigation or proceeding relating to money laundering, corruption or fraud.")
    h2(d, "7.2 Verification Procedures")
    P("The Investor shall provide the Administrator promptly with all documents and information that the Administrator requests to satisfy the Administrator’s procedures under AML Laws, including the documents listed in Annex D for the Investor’s type. Documents that are not in English must be accompanied by a certified translation, and copies of identification documents must be certified by a lawyer, notary or other person acceptable to the Administrator.")
    P("The Administrator may take up to ten business days after receiving a complete set of documents to complete its review. The Investor’s admission to the Fund will not occur until the review is complete, and the General Partner will have no liability to the Investor for any delay caused by the Investor’s failure to provide complete information.")
    h2(d, "7.3 Reliance on Third Parties")
    P("The Investor consents to the Administrator relying on verification performed by a regulated financial institution, a lawyer or an administrator that is subject to AML Laws in a jurisdiction that the Administrator regards as having equivalent requirements. The Investor remains responsible for the accuracy of the information given by any such person on its behalf.")
    h2(d, "7.4 Refusal, Reporting and Freezing")
    P("The Fund, the General Partner or the Administrator may refuse to accept a subscription, may suspend or block distributions and withdrawals, and may compulsorily redeem the Investor’s {I}, if they believe it is necessary to comply with AML Laws. The Investor acknowledges that the Fund and its service providers may be required to report suspicious activity to the competent authorities and may be prohibited from telling the Investor that a report has been made.")

    if III:
        h1(d, "7A. Source of Funds Verification")
        h2(d, "7A.1 Commitment Size Test")
        P("If the Investor’s Capital Commitment equals or exceeds $1,000,000 (the “Verification Threshold”), the Investor shall deliver to the Administrator, in addition to the documents required by Section 7.2, evidence of the source of the funds from which the Investor will fund its Capital Commitment. An Investor whose Capital Commitment is below the Verification Threshold is not required to deliver this evidence unless the Administrator requests it on the basis of a risk assessment.")
        h2(d, "7A.2 Acceptable Evidence")
        P("Acceptable evidence of the source of funds includes audited financial statements, a recent bank or custody statement showing sufficient funds, a signed letter from the Investor’s accountant or auditor, the documents relating to a sale or inheritance that gave rise to the funds, or any other evidence that the Administrator considers reliable. The evidence must be dated within the twelve months before the Investor delivers it.")
        P("An Investor that is a regulated financial institution, a governmental plan or a publicly listed company may satisfy this Section by delivering the evidence of its status that is described in Annex D, if the Administrator accepts it as sufficient for the Investor’s risk profile.")
        h2(d, "7A.3 Timing and Consequences")
        P("The Investor shall deliver the evidence required by this Section no later than the date on which it delivers the other Subscription Documents. If the Investor’s Capital Commitment is increased so that it equals or exceeds the Verification Threshold after admission, the Investor shall deliver the evidence within ten business days of the increase. The Administrator will not admit an Investor, and the General Partner may suspend the rights of an Investor, if the Investor does not comply with the requirements of Section 7A.")

    # ---------- Section 8 ----------
    h1(d, "8. Tax Matters")
    h2(d, "8.1 Tax Forms")
    P("The Investor shall deliver to the Administrator, with its Subscription Documents, a properly completed and signed Internal Revenue Service Form W-9 if the Investor is a United States person, or the appropriate Internal Revenue Service Form W-8 if the Investor is not a United States person, as described in Annex C. The Investor shall deliver a replacement form whenever the form on file expires or becomes inaccurate, and in any case on request.")
    P("An Investor that fails to deliver a required tax form may be subject to backup withholding at the applicable rate, and the Fund may treat the Investor as a non-United States person for the purpose of withholding on distributions until a valid form is received. The Investor shall bear any tax, interest or penalty that results from a failure to deliver a valid form.")
    h2(d, "8.2 FATCA and CRS")
    P("The Investor shall provide the information and certifications that the Fund requires to comply with the provisions of the Code commonly known as FATCA and with the Common Reporting Standard developed by the Organisation for Economic Co-operation and Development and any similar regime (together, “CRS”). The Investor consents to the Fund disclosing that information to the Internal Revenue Service and to other competent authorities, and acknowledges that those authorities may share it with the tax authorities of other jurisdictions.")
    P("The Investor shall notify the Administrator within thirty days of any change in circumstances that makes any of its FATCA or CRS information incorrect, and shall provide a new self-certification promptly.")
    h2(d, "8.3 Withholding")
    P("The Fund may withhold and pay over to the relevant authority any tax that it is required by law to withhold on amounts payable to the Investor. Amounts so withheld will be treated as having been distributed to the Investor. If the Fund is liable for any tax that is attributable to the Investor, the Investor shall indemnify the Fund for that tax on demand, and the Fund may recover it by reducing distributions.")
    h2(d, "8.4 Partnership Audit Procedures")
    P("The Investor acknowledges that the Fund is treated as a partnership for United States federal income tax purposes and that the General Partner may make any election available to it under the partnership audit provisions of the Code. The Investor agrees to provide any information that the General Partner requests to implement such an election, and to pay its share of any imputed underpayment, whether or not the Investor was a partner in the reviewed year.")
    h2(d, "8.5 No Tax Advice")
    P("The Investor has relied only on its own tax advisers in deciding to invest in the Fund. Nothing in the PPM or in this Agreement is tax advice, and none of the Fund, the General Partner, the Manager, Hartwell & Crane LLP or the Administrator makes any representation about the tax consequences of an investment in the Fund.{f}".format(f="") + fn.mark("Tax opinions, where given, are addressed to the Fund and may not be relied upon by Investors."))
    fn.flush()

    # ---------- Section 9 ----------
    h1(d, "9. ERISA and Benefit Plan Investors")
    h2(d, "9.1 Benefit Plan Status")
    P("The Investor shall indicate in Item 6 of Annex A whether it is, or is acting on behalf of, a Benefit Plan Investor. If the Investor is a Benefit Plan Investor, complete Annex F. The additional representations that a Benefit Plan Investor must make are set out in Annex F (ERISA Representations).")
    P("The Investor shall notify the General Partner immediately if its status as a Benefit Plan Investor, or the percentage of its assets that constitute plan assets, changes at any time after it has delivered this Agreement. A change in status that would cause the Fund’s assets to be treated as plan assets may result in the compulsory redemption of the Investor’s {I}.")
    h2(d, "9.2 Plan Asset Limitation")
    P("The Investor understands that the General Partner intends to limit investment by Benefit Plan Investors to less than twenty-five percent of the total value of each class of equity interests in the Fund, so that the assets of the Fund are not treated as plan assets for the purposes of ERISA and the Code. For this purpose the value of interests held by the General Partner, the Manager and their affiliates, other than Benefit Plan Investors, is disregarded.")
    P("The General Partner may reject a subscription, reduce the Capital Commitment of a Benefit Plan Investor, or require the withdrawal of a Benefit Plan Investor, to the extent that it considers necessary to maintain that limitation. The Investor will not be entitled to compensation for any such action.")
    h2(d, "9.3 Fiduciary Matters")
    P("If the Investor is a Benefit Plan Investor, the person that has made the decision to invest on its behalf is independent of the Fund, the General Partner and the Manager, is a fiduciary within the meaning of ERISA with respect to the investment, and has made its own determination that the investment is prudent and consistent with the plan’s governing documents. None of the Fund, the General Partner or the Manager has acted as a fiduciary to the Investor in connection with that decision.")
    fn.flush()

    # ---------- Section 10 ----------
    h1(d, "10. Representations, Warranties and Covenants")
    h2(d, "10.1 Authority and Capacity")
    P("The Investor has full power and authority to enter into and perform this Agreement, and this Agreement has been duly authorized, executed and delivered by the Investor and is its valid and binding obligation, enforceable in accordance with its terms, subject to bankruptcy, insolvency and similar laws affecting creditors’ rights and to general principles of equity. If the Investor is a natural person, the Investor is of legal age and has legal capacity to enter into this Agreement.")
    h2(d, "10.2 No Conflict")
    P("The execution, delivery and performance of this Agreement by the Investor do not and will not conflict with, or result in a breach of, the Investor’s organizational documents, any law or regulation applicable to it, any order of any court or governmental authority, or any agreement or instrument to which it is a party or by which it is bound. No consent, approval or filing is required in connection with its subscription, other than those that have been obtained or made.")
    h2(d, "10.3 Litigation and Disqualification")
    P("There is no action, suit or proceeding pending or, to the Investor’s knowledge, threatened against the Investor that could affect its ability to perform its obligations under this Agreement. Neither the Investor nor, if the Investor is an entity, any person who controls it, has been the subject of any event that would be a disqualifying event under Rule 506(d) of Regulation D under the Securities Act, and the Investor will notify the General Partner promptly if that changes.")
    if III:
        h2(d, "10.4 Sanctions")
        P("Neither the Investor nor any of its beneficial owners, directors, trustees or controlling persons is a person that is the subject or target of economic or financial sanctions or trade embargoes administered or enforced by the United States Department of the Treasury’s Office of Foreign Assets Control, the United Nations Security Council, the European Union, the United Kingdom or any other relevant authority (together, “Sanctions Laws”), and no such person is located, organized or resident in a country or territory that is the subject of comprehensive Sanctions Laws.")
        P("The Investor shall not use the proceeds of any distribution from the Fund, or make any payment to the Fund, in violation of Sanctions Laws. The Investor shall notify the General Partner immediately if any representation in this Section ceases to be true, and acknowledges that the Fund may block or freeze its interest and may compulsorily redeem its {I} if the Fund determines that it is necessary to comply with Sanctions Laws.")
    fn.flush()

    # ---------- Section 11 ----------
    h1(d, "11. Accredited Investor Status")
    h2(d, "11.1 Representation")
    P("The Investor represents that it is an “accredited investor” as defined in Rule 501(a) of Regulation D under the Securities Act, because it falls within at least one of the categories that the Investor has indicated in Item 3 of Annex A. The Investor understands that the General Partner is relying on this representation to establish that the offering is exempt from registration.")
    P("The Investor acknowledges that the categories of accredited investor include, among others, natural persons with a net worth that exceeds $1,000,000, excluding the value of the primary residence, or income that exceeds $200,000 in each of the two most recent years ($300,000 jointly with a spouse or spousal equivalent); trusts with total assets above $5,000,000 that were not formed to acquire {I}; and entities with total assets above $5,000,000 or all of whose equity owners are accredited investors.")
    h2(d, "11.2 Verification")
    P("The Investor shall provide such evidence of its accredited investor status as the General Partner or the Administrator reasonably requests, which may include tax returns, financial statements, bank or brokerage statements or a letter from a registered broker-dealer, investment adviser, lawyer or certified public accountant. The Investor shall notify the General Partner immediately if it ceases to be an accredited investor at any time before its admission.")
    h2(d, "11.3 Entities Formed to Invest")
    P("If the Investor is an entity that was formed or recapitalized for the specific purpose of acquiring {I}, each of its equity owners must be an accredited investor, and the Investor shall provide the information required by Annex A about each such owner. The Investor shall not permit any person who is not an accredited investor to acquire a beneficial interest in its {I}.")
    fn.flush()

    # ---------- Section 12 ----------
    h1(d, "12. Qualified Purchaser Status")
    h2(d, "12.1 Representation")
    if III:
        P("The Investor represents that it is a Qualified Purchaser because it falls within one of paragraphs 1 through 4 of this Section 11, as indicated in Item 4 of Annex A. Each category is described below.")
    else:
        P("The Investor represents that it is a Qualified Purchaser because it falls within one of paragraphs 1 through 4 of this Section 11, as indicated in Item 4 of Annex A. Each category is described below.")
    P("1. A natural person who owns not less than $5,000,000 in investments, as defined in Rule 2a51-1 under the Investment Company Act.", indent=1)
    P("2. A company that owns not less than $5,000,000 in investments and that is owned directly or indirectly by or for two or more natural persons who are related as siblings, spouses or former spouses, or direct lineal descendants by birth or adoption, or the estate or a foundation, charitable organization or trust established by such persons.", indent=1)
    P("3. A trust that was not formed for the specific purpose of acquiring {I}, as to which the trustee or other person authorized to make decisions with respect to the trust, and each settlor or other person who has contributed assets to the trust, is a person described in paragraph 1, 2 or 4.", indent=1)
    P("4. A person, acting for its own account or the accounts of other Qualified Purchasers, that in the aggregate owns and invests on a discretionary basis not less than $25,000,000 in investments.", indent=1)
    h2(d, "12.2 Look-Through and Valuation")
    P("The Investor acknowledges that “investments” is a defined term in the rules under the Investment Company Act and that certain assets, including real estate used for personal purposes and certain commodity interests, are excluded or valued in a special way. The Investor has determined its investments as of a date within thirty days before the date of its subscription and will notify the General Partner if the amount falls below the applicable threshold before admission.")
    h2(d, "12.3 Entities")
    P("If the Investor is a private investment company that relies on Section 3(c)(1) or Section 3(c)(7) of the Investment Company Act, or an entity that was formed to invest in the Fund, the Investor represents that its beneficial owners have not been permitted to decide individually whether to participate, or the extent of their participation, in the Investor’s investment in the Fund, and that each of them is a Qualified Purchaser.")
    fn.flush()

    # ---------- Section 13 ----------
    h1(d, "13. Transfers, Indemnification and Power of Attorney")
    h2(d, "13.1 Restrictions on Transfer")
    P("The Investor shall not Transfer all or any part of its {I} except in accordance with the Partnership Agreement and with the prior written consent of the General Partner, which the General Partner may withhold in its sole discretion. Any Transfer or purported Transfer that does not comply with this Section and the Partnership Agreement is void and will not be recorded by the Fund.")
    P("Any request for consent to a Transfer shall be accompanied by a duly completed Eligible Transferee Certificate, an opinion of counsel if the General Partner requests one, and the information that the Administrator needs to complete its AML Laws procedures for the proposed transferee. The Investor shall bear all costs of a Transfer, including the costs of the Fund, the General Partner and the Administrator.")
    P("The Investor acknowledges that the General Partner may refuse to consent to any Transfer that would cause the Fund to be treated as a publicly traded partnership for the purposes of the Code, would require the Fund to register under the Investment Company Act, or would cause the assets of the Fund to be treated as plan assets for the purposes of ERISA.")
    h2(d, "13.2 Indemnification")
    P("The Investor shall indemnify and hold harmless the Fund, the General Partner, the Manager, the Administrator and each of their respective partners, members, officers, directors, employees and agents from and against any loss, liability, claim, damage or expense, including reasonable legal fees, that arises out of any misrepresentation or breach of warranty or covenant by the Investor in the Subscription Documents, or out of any failure of the Investor to comply with this Agreement.")
    P("The Investor’s indemnity under this Section is in addition to any liability that the Investor may have under the Partnership Agreement and survives the Investor’s withdrawal from the Fund and the termination of the Fund. No person indemnified under this Section is required to proceed first against any other person before enforcing the indemnity.")
    h2(d, "13.3 Power of Attorney")
    P("The Investor irrevocably constitutes and appoints the General Partner, with full power of substitution, as its true and lawful attorney-in-fact, in its name, place and stead, to execute, acknowledge, swear to, file and record (a) the Partnership Agreement and any amendment to it that is made in accordance with its terms, (b) any certificate of limited partnership or other filing that is required by Delaware law or the law of any other jurisdiction in which the Fund conducts business, (c) any instrument that is required to give effect to the admission of an additional Limited Partner, a Transfer or the withdrawal or default of a Limited Partner, and (d) any document that the General Partner considers necessary to dissolve and wind up the Fund.")
    P("The power of attorney granted in this Section is coupled with an interest, is irrevocable, and survives the death, disability, dissolution, bankruptcy or incapacity of the Investor. It survives a Transfer of the Investor’s {I} to the extent necessary to allow the General Partner to give effect to the Transfer. The General Partner may not use the power of attorney to increase the Investor’s Capital Commitment or to change the Investor’s liability without its consent.")
    h2(d, "13.4 Confidentiality")
    P("The Investor shall keep confidential the PPM, the Partnership Agreement, this Agreement and all information about the Fund, the Manager and the Fund’s investments that is not publicly available, and shall use it only to evaluate and monitor its investment in the Fund. The Investor may disclose that information to its directors, officers, employees, advisers and Custodian who need to know it and who are bound by a duty of confidentiality, and as required by law, after notice to the General Partner where permitted.")
    fn.flush()

    # ---------- Section 14 ----------
    h1(d, "14. Governing Law and Miscellaneous")
    h2(d, "14.1 Governing Law")
    P("This Agreement, and any claim, controversy or dispute that arises out of or relates to it, is governed by and will be construed in accordance with the laws of the State of Delaware, without regard to conflict of law principles that would require the application of the law of another jurisdiction.")
    h2(d, "14.2 Jurisdiction and Waiver of Jury Trial")
    P("Each party irrevocably submits to the exclusive jurisdiction of the state and federal courts located in the State of Delaware for any action arising out of or relating to this Agreement, and waives any objection to venue in those courts. Each party waives, to the fullest extent permitted by law, any right to a trial by jury in any such action.")
    h2(d, "14.3 Entire Agreement; Side Letters")
    P("The Subscription Documents, the Partnership Agreement and any Side Letter entered into with the Investor constitute the entire agreement between the Investor and the Fund about the subject matter of this Agreement and supersede all earlier negotiations, understandings and agreements. The Investor acknowledges that the Fund may enter into Side Letters with other Investors, including the Kestrel Side Letter, that grant them rights or benefits that the Investor does not have, subject to the rights of the Investor under the provisions of the Partnership Agreement that govern most favored nation elections.")
    P("In the event of any conflict between this Agreement and the Partnership Agreement, the Partnership Agreement prevails, and in the event of a conflict between a Side Letter and either of them, the Side Letter prevails as to the Investor or Investors that are party to it.")
    h2(d, "14.4 Amendments and Waivers")
    P("This Agreement may be amended or waived only by a writing signed by the Investor and the General Partner, except that the General Partner may amend the Annexes, other than Annex E, to update administrative information, if the amendment does not increase the Investor’s obligations. No failure or delay in exercising any right is a waiver of that right.")
    h2(d, "14.5 Severability")
    P("If any provision of this Agreement is held to be invalid, illegal or unenforceable in any respect, the remaining provisions are not affected, and the parties will negotiate in good faith to replace the invalid provision with a valid provision that comes closest to the original intention.")
    h2(d, "14.6 Counterparts and Electronic Signature")
    P("This Agreement may be executed in counterparts, each of which is an original and all of which together are one instrument. Signatures delivered by electronic means, including by a facsimile, portable document format or an electronic signature platform, are as effective as original signatures.")
    h2(d, "14.7 Notices")
    P("Notices to the Fund must be in writing and sent to the General Partner at {ADDR}, Boston, MA 02110, with a copy to the Administrator, and notices to the Investor must be sent to the address or email address given in Annex A. A notice is effective on delivery if delivered by hand or by a courier, and on transmission if sent by email without a bounce-back message, if sent on a business day before 5:00 p.m. in the place of receipt, and otherwise on the next business day.")
    h2(d, "14.8 Survival")
    P("The representations, warranties, covenants and indemnities of the Investor in this Agreement survive the acceptance of its subscription, the admission of the Investor to the Fund, any Transfer of its {I}, and the withdrawal of the Investor or the termination of the Fund.")
    fn.flush()
