"""Subscription agreement template, part A: cover, Sections 1-6. Fictional text."""
from common import *

CHK = "☐"


def fmt(s, c):
    return s.format(**c)


def build_a(d, c, fn):
    III = c["III"]
    P = lambda t, **k: para(d, fmt(t, c), **k)
    T = lambda rows, **k: table(d, [[fmt(x, c) for x in r] for r in rows], **k)

    # ---------- cover ----------
    para(d, "CONFIDENTIAL", bold=True)
    d.add_heading(fmt("{FUND}", c), level=0)
    d.add_heading("Subscription Agreement", level=0)
    P("Fictional sample document. Prepared for software testing only. {FUND}, is a fictitious Delaware limited partnership and no offering is made by this document.", italic=True)
    P("Each prospective investor should read this document together with the offering memorandum and the limited partnership agreement before completing the annexes. Please deliver the completed annexes and the supporting documents listed in Annex D as set out in Section 1.4.")
    P("Parties and advisers: {FUND}; {GP} (general partner); Northgate Capital Management, LLC, {ADDR}, Boston, MA 02110 (manager); Hartwell & Crane LLP, New York (legal counsel); Meridale Fund Services Ltd. (administrator); Ashby Kerr LLP (auditor).")
    P("Questions from prospective investors may be sent to investor.relations@example.com or made by telephone to +1 617 555 0140.")

    # ---------- Section 1 ----------
    h1(d, "1. Subscription for {I}".format(**c))
    h2(d, "1.1 Defined Terms")
    P("This subscription agreement is entered into by the undersigned investor with {FUND}, a Delaware limited partnership acting through {GP}, a Delaware limited liability company and the general partner of the partnership. In this document the following terms have the meanings set out below.")
    defs = [
        ("Administrator", "Meridale Fund Services Ltd., or any successor appointed by the General Partner to administer the Fund, including to perform investor onboarding, anti-money laundering and know-your-customer procedures."),
        ("Agreement", "this subscription agreement, including the Annexes that are attached to it and form part of it."),
        ("Code", "the United States Internal Revenue Code of 1986, as amended, and the Treasury Regulations issued under it."),
        ("Custodian", "the bank, trust company or other institution that holds the Investor’s assets on its behalf, if the Investor has appointed one and identifies it in Section 4."),
        ("ERISA", "the United States Employee Retirement Income Security Act of 1974, as amended, and the regulations issued under it."),
        ("Fund", "{FUND}, a limited partnership organized under the laws of the State of Delaware."),
        ("General Partner", "{GP}, a limited liability company organized under the laws of the State of Delaware, in its capacity as general partner of the Fund."),
        ("Investment Company Act", "the United States Investment Company Act of 1940, as amended."),
        ("{I}", "the limited partnership interests in the Fund offered by the PPM and this Agreement."),
        ("Investor", "the person identified as the investor on the signature page of this Agreement."),
        ("Manager", "Northgate Capital Management, LLC, a Delaware limited liability company, which acts as investment manager of the Fund."),
        ("Partnership Agreement", "the {LPA_TITLE} of the Fund, dated as of {LPA_DATE}, as it may be amended, restated or supplemented from time to time."),
        ("PPM", "the Confidential Private Placement Memorandum of the Fund dated {PPM_DATE}, as it may be supplemented or amended."),
        ("Securities Act", "the United States Securities Act of 1933, as amended, and the rules issued under it."),
        ("Subscription Documents", "this Agreement, the Annexes completed by the Investor and all certifications, forms and other documents that the Investor delivers to the Fund in connection with its subscription."),
    ]
    for term, body in defs:
        P("“%s” means %s" % (fmt(term, c), body), indent=1)
    P("Capitalized terms used but not defined herein have the meanings given to them in the Partnership Agreement.")
    P("References to Sections and Annexes are to sections of and annexes to this Agreement unless stated otherwise. Headings are for convenience only and do not affect interpretation. The words “including” and “includes” mean including without limitation.")

    h2(d, "1.2 Subscription and Minimum Commitment")
    P("Subject to the terms of this Agreement, the Investor irrevocably subscribes for {I} in the Fund and agrees to make a Capital Commitment in the amount stated on the signature page of this Agreement. The minimum Capital Commitment is {MIN}, which the General Partner may waive or reduce in its sole discretion, whether for one Investor or for several, and whether before or after the first Closing Date.")
    P("The Investor understands that the Fund has a target size of $750,000,000 and a hard cap of $1,000,000,000 of aggregate Capital Commitments, and that the General Partner has no obligation to accept any subscription in whole or in part. The Investor’s Capital Commitment will be drawn down by the Fund in accordance with Section 3 and the Partnership Agreement.")
    P("The Investor agrees to be bound by the Partnership Agreement as a limited partner of the Fund upon acceptance of this subscription by the General Partner, and appoints the General Partner as its attorney-in-fact for the purposes described in Section 13.3. The Investor acknowledges that the Partnership Agreement governs the rights of the Limited Partners in respect of distributions, voting, withdrawal and Transfer, and that this Agreement does not alter those rights.")

    h2(d, "1.3 No Registration; Offering Basis")
    P("The Investor acknowledges that the offered Units will not be registered under the Securities Act or under the securities laws of any state or other jurisdiction, and that the offering is being made in reliance on exemptions that depend on the accuracy of the representations made by the Investor in this Agreement. The Fund will not be registered as an investment company under the Investment Company Act.")
    P("The Investor has received and carefully read the PPM and the Partnership Agreement and has had the opportunity to ask questions of, and receive answers from, representatives of the General Partner and the Manager concerning the terms of the offering. No person has been authorized to give any information or to make any representation about the Fund that is not contained in the PPM, and the Investor has not relied on any such information or representation.")

    h2(d, "1.4 Delivery of Subscription Documents")
    P("The Investor shall complete Annex A, sign the signature pages in Annex E and deliver them, together with the documents required by Annex C and Annex D, to the Administrator at subscriptions@meridale.example.com. Original signature pages are not required unless the General Partner so requests; electronic signatures delivered through a platform approved by the Administrator are acceptable.")
    P("If the Investor holds its {I} through a Custodian, the Investor shall send a copy of the executed signature pages to the Custodian indicated in Part B of Section 6. The Investor remains responsible for the timely delivery of the Subscription Documents and for the accuracy of the information in them, whether or not a Custodian is involved.")
    P("The Investor shall fund its first Capital Contribution only after receiving a notice from the General Partner under Section 3.2, and only by wire transfer to the account identified in Annex B. The Fund and the Administrator will not be responsible for any payment sent to an account other than the account identified in Annex B.")

    # ---------- Section 2 ----------
    h1(d, "2. Acceptance; Minimum Commitment; Closings")
    h2(d, "2.1 Acceptance and Rejection")
    P("This subscription is not binding on the Fund until it is accepted by the General Partner by countersigning the signature page in Annex E. The General Partner may accept or reject this subscription in whole or in part for any reason or for no reason. Subscriptions below the minimum Capital Commitment of $2,500,000 will not be accepted unless the General Partner has waived the minimum in writing.")
    P("If the General Partner rejects this subscription in whole, the Fund will return any funds received from the Investor, without interest or deduction, within ten business days. If the General Partner accepts this subscription in part, the Investor’s Capital Commitment will be reduced to the accepted amount and the Fund will return any excess funds on the same basis.")
    P("Acceptance by the General Partner will be evidenced by a countersigned copy of the signature page delivered to the Investor, and the Investor will be admitted to the Fund as a Limited Partner on the Closing Date on which its subscription is accepted. Delivery of the countersigned signature page by electronic means is effective acceptance.")
    h2(d, "2.2 Closings")
    P("The first closing of the Fund is expected to occur on {FIRST}. The General Partner may hold one or more subsequent closings after the first Closing Date, and the Investor may be admitted at any such closing. A final closing will be held no later than [insert Final Closing Date].")
    P("An Investor admitted at a subsequent closing will contribute to the Fund the amounts that it would have contributed had it been admitted at the first closing, together with interest on those amounts at the rate stated in the Partnership Agreement, and the Fund will make equalizing distributions or adjustments to the earlier Investors as the Partnership Agreement requires.")
    h2(d, "2.3 Classes of {I}".format(**c))
    P("The Fund may offer {I} in more than one class, with different fee and expense terms, to satisfy the legal, tax or regulatory needs of particular Investors. The class applicable to the Investor will be stated on the signature page of this Agreement. [NTD: Hartwell & Crane to confirm the Class S minimum with tax counsel before filing.]")
    P("The rights of each class are set out in the Partnership Agreement. The Investor acknowledges that the General Partner may reclassify {I} of an Investor between classes in the circumstances described in the Partnership Agreement and that doing so does not constitute an amendment of this Agreement.")
    h2(d, "2.4 Conditions to Admission")
    P("The Investor’s admission to the Fund is conditional on (a) the General Partner’s receipt of all Subscription Documents in the form required, (b) completion of the Administrator’s anti-money laundering and know-your-customer procedures to the satisfaction of the Administrator, (c) the accuracy of the Investor’s representations and warranties at the time of admission, and (d) any other condition that the General Partner reasonably imposes for legal or regulatory reasons. The General Partner may waive any of these conditions, other than condition (b), in its sole discretion.")

    # ---------- Section 3 ----------
    h1(d, "3. Capital Contributions and Default")
    h2(d, "3.1 Capital Contributions")
    P("The Investor shall make Capital Contributions to the Fund from time to time up to the amount of its Capital Commitment, as called by the General Partner under the Partnership Agreement. Capital Contributions may be called to pay Management Fees, Fund expenses, and the cost of investments, and for any other purpose permitted by the Partnership Agreement.")
    P("The Investor’s Capital Commitment is a continuing obligation and will not be reduced by any distribution made to the Investor, except to the extent that the Partnership Agreement permits distributions to be recalled. The Investor waives any right of set-off, counterclaim or defense against its obligation to make Capital Contributions when due.")
    h2(d, "3.2 Notice and Funding")
    P("The General Partner will give the Investor written notice of each capital call at least ten business days before the due date, stating the amount called, the purpose of the call, the due date and the wire instructions. The Investor shall fund each capital call in immediately available funds in United States dollars to the account stated in the notice, which will be the account identified in Annex B unless the General Partner notifies the Investor of a change in accordance with Section 14.7.")
    P("The Investor acknowledges that wire instructions are a frequent target of fraud. The Investor shall confirm any change to the wire instructions by telephone with a representative of the Administrator at a number that the Investor has verified independently, and shall not rely on an email message alone.")
    h2(d, "3.3 Default")
    P("If the Investor fails to fund any Capital Contribution when due and the failure continues for five business days after notice, the Investor will be a Defaulting Partner. The remedies available against a Defaulting Partner are set out in the Partnership Agreement and include the imposition of interest, the forfeiture or reduction of the Defaulting Partner’s interest in the Fund, the sale of its {I} at a discount, and the suspension of its voting rights.")
    P("The Investor acknowledges that these remedies are reasonable in light of the harm that a default would cause to the Fund and to the other Limited Partners, and that they are in addition to, and not in substitution for, any other right or remedy of the Fund at law or in equity. The Investor agrees to pay the costs of enforcing the Fund’s rights, including reasonable legal fees." + fn.mark("The Investor’s liability for a default is not limited to the amount of the call that was missed; the Partnership Agreement allows the General Partner to apply the remedies to the whole of the Investor’s remaining Capital Commitment."))
    h2(d, "3.4 Excuse and Exclusion")
    P("The Investor may be excused from participating in a particular investment only in the circumstances described in the Partnership Agreement, and only if the Investor has delivered the written notice and supporting legal opinion, if any, that the Partnership Agreement requires. An Investor that is excused from an investment will remain obligated to fund the rest of its Capital Commitment.")
    fn.flush()

    # ---------- Section 4 ----------
    h1(d, "4. Investor and Custodian Information")
    h3(d, "Part A – Investor Details")
    h2(d, "4.1 Investor Identification")
    P("The Investor shall provide in Annex A its full legal name, its tax identification number, its principal address and the name, title and contact details of each individual authorized to give instructions on its behalf. The Investor shall provide evidence of the authority of each such individual if the Administrator requests it.")
    P("The Investor represents that the name, address and identification details that it provides are true and complete, and that it will notify the Administrator promptly of any change. The Investor consents to the Fund, the General Partner, the Manager and the Administrator holding and using this information to administer the Fund and to comply with applicable law.")
    h2(d, "4.2 Beneficial Owners")
    if III:
        P("Each Investor that is an entity formed or organized outside the United States shall provide the names of its beneficial owners.")
    else:
        P("Each Investor that is an entity shall provide the names of its beneficial owners.")
    P("For this purpose a beneficial owner is any individual who, directly or indirectly, owns or controls twenty-five percent or more of the equity or voting rights of the Investor, and any individual who exercises control over the Investor by other means. The Investor shall also identify any person on whose behalf it is acting as nominee or agent, and shall deliver the identification documents for each beneficial owner that are listed in Annex D.")
    P("If the Investor is a publicly listed company, a regulated financial institution, a governmental entity or a similar entity, it may instead provide the evidence of its status that is described in Annex D, and the Administrator will determine whether further information about its beneficial owners is required.")
    h2(d, "4.3 Jurisdiction of Formation or Residence")
    P("The Investor shall indicate the jurisdiction in which it is formed, organized or resident by checking one box below. The General Partner will accept subscriptions only from Investors in the jurisdictions listed, unless it consents in writing to another jurisdiction after receiving advice of counsel.")
    rows = [["Check one", "Jurisdiction", "Additional information"],
            [CHK, "United States", "State of formation or residence: ____________"],
            [CHK, "Canada", "Province: ____________"],
            [CHK, "United Kingdom", "Country within the United Kingdom: ____________"],
            [CHK, "European Economic Area", "Member state: ____________"],
            [CHK, "Switzerland", "Canton: ____________"],
            [CHK, "Japan", "Prefecture: ____________"],
            [CHK, "Australia", "State or territory: ____________"]]
    if III:
        rows.append([CHK, "Singapore", "Registered office address: ____________"])
    rows.append([CHK, "Other (requires General Partner consent)", "Jurisdiction: ____________"])
    T(rows)
    P("An Investor that is not formed or resident in the United States acknowledges that it is responsible for complying with the securities, tax and exchange control laws of its own jurisdiction, and that neither the Fund nor the General Partner has taken any action to permit an offering of {I} in any jurisdiction other than the United States.")
    h3(d, "Part B – Custodian Information")
    h2(d, "4.4 Custodian")
    P("If the Investor has appointed a Custodian, the Investor shall provide in Annex A the name, address and account details of the Custodian and the name of a contact at the Custodian. The Investor authorizes the Fund, the General Partner and the Administrator to communicate with the Custodian about the Investor’s subscription, capital calls and distributions.")
    P("The Investor remains liable for all of its obligations under this Agreement and the Partnership Agreement even if the Custodian fails to act on the Investor’s instructions. Notice given to the Custodian will constitute notice to the Investor only if the Investor has so agreed in writing.")
    h2(d, "4.5 Changes in Information")
    P("The Investor shall notify the Administrator in writing within thirty days of any change in the information given in this Section or in Annex A. Until the Administrator confirms receipt of the notice, the Fund may continue to rely on the information previously given, and the Investor will bear any loss that results from a delay in giving notice.")

    # ---------- Section 5 ----------
    h1(d, "5. Investment Representations")
    h2(d, "5.1 Investment Intent")
    P("The Investor is acquiring {I} for its own account, for investment purposes only, and not with a view to resale or distribution in violation of the Securities Act. The Investor has no contract, undertaking or arrangement with any person to sell, transfer or grant participations in any {I} and has no present intention to enter into such an arrangement.")
    h2(d, "5.2 Sophistication and Ability to Bear Risk")
    P("The Investor has such knowledge and experience in financial and business matters that it is capable of evaluating the merits and risks of an investment in the Fund. The Investor is able to bear the economic risk of the investment, including a complete loss, and has adequate means of providing for its current needs and contingencies and no need for liquidity in the investment.")
    P("The Investor understands that investments in infrastructure assets are illiquid, are subject to construction, operating, regulatory, financing and counterparty risk, and that the Fund’s returns are not guaranteed. The Investor has reviewed the risk factors in the PPM and has consulted its own legal, tax and financial advisers as it considers necessary.")
    h2(d, "5.3 Access to Information")
    P("The Investor has had access to all information that it considers necessary to make an informed decision to invest in the Fund, and has had the opportunity to verify the accuracy of that information. The Investor understands that the Manager’s projections and target returns are forward-looking, are based on assumptions that may prove incorrect, and are not a promise of future performance.")
    h2(d, "5.4 Restricted Securities and Legends")
    P("The Investor understands that the {I} are restricted securities, that there is no public market for them and none is expected to develop, and that they may not be resold or transferred except in compliance with the Securities Act, applicable state securities laws and the Partnership Agreement. The Investor consents to the placement of a restrictive legend in the records of the Fund and to the issuance of stop-transfer instructions to the Administrator.")
    h2(d, "5.5 No Reliance")
    P("The Investor is not relying on the Fund, the General Partner, the Manager, the Administrator, Hartwell & Crane LLP, Ashby Kerr LLP or any of their affiliates for legal, tax or investment advice. Hartwell & Crane LLP acts as counsel to the Fund, the General Partner and the Manager only and does not represent the Investor or any other Limited Partner in connection with the Fund, unless it has agreed in writing to do so.")

    # ---------- Section 6 ----------
    h1(d, "6. Investor Classification")
    h3(d, "Part A – Investor Type and Tax Status")
    h2(d, "6.1 Investor Type")
    P("The Investor shall indicate its type by checking one box below. The type determines the information and documents that the Investor must deliver under Annex C and Annex D.")
    rows = [["Check one", "Investor type"],
            [CHK, "Natural person (individual)"],
            [CHK, "Joint tenants or tenants in common"],
            [CHK, "Corporation"],
            [CHK, "Limited liability company"],
            [CHK, "Partnership"]]
    if III:
        rows += [[CHK, "Revocable trust (grantor trust)"], [CHK, "Irrevocable trust"]]
    else:
        rows += [[CHK, "Trust"]]
    rows += [[CHK, "Governmental plan"], [CHK, "Employee benefit plan or other Benefit Plan Investor"], [CHK, "Other entity (please describe)"]]
    T(rows)
    h2(d, "6.2 Tax Status")
    if III:
        P("Tax status of the Investor (select all that apply):")
    else:
        P("Tax status of the Investor (check one):")
    T([["Mark", "Tax status"],
       [CHK, "United States person subject to federal income tax"],
       [CHK, "Tax-exempt organization described in Section 501(c) of the Code"],
       [CHK, "Governmental plan or entity exempt from federal income tax"],
       [CHK, "Non-United States person"],
       [CHK, "Disregarded entity or flow-through entity (identify owner in Annex A)"]])
    P("The Investor’s tax status determines the tax form that it must deliver under Section 8 and Annex C, and may affect the withholding that the Fund applies to distributions. The Investor shall notify the Administrator promptly if its tax status changes." + fn.mark("A tax-exempt Investor should consult its own advisers about the possible effect of unrelated business taxable income and of any debt financing that the Fund may use."))
    h3(d, "Part B – Trusts and Public Plan Investors")
    h2(d, "6.3 Trusts")
    P("A trust Investor shall identify each trustee, each settlor and, in the case of a trust that may be revoked by its settlor, each person who has the power to revoke it. A trust Investor shall deliver a copy of the trust instrument, or a certification of trust, showing that the trustee has power to subscribe for {I} and to make the Capital Commitment.")
    P("A trustee who signs this Agreement represents that it has authority under the trust instrument and applicable law to do so, that the trust has not been revoked or terminated, and that the trust was not formed for the specific purpose of acquiring {I}. The trustee shall notify the Administrator promptly if any of these facts changes.")
    h2(d, "6.4 Governmental and Public Plan Investors")
    P("An Investor that is a governmental plan or other public body acknowledges that the Fund may be required by law to disclose certain information about the Investor’s investment, and that the Partnership Agreement and the letter agreement between the Fund and Kestrel State Teachers’ Retirement System (the “Kestrel Side Letter”) address the treatment of confidential information for such Investors. An Investor that is entitled to the benefit of the Kestrel Side Letter shall identify the relevant provisions in Annex A.")
    P("A governmental plan Investor represents that it is not subject to Title I of ERISA or Section 4975 of the Code, that it has the legal authority to invest in the Fund under the laws of its jurisdiction, and that its investment policy permits an investment in an infrastructure fund of the kind described in the PPM.")
    fn.flush()
