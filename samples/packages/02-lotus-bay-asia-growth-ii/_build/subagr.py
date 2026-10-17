"""Offshore Subscription Agreement generator (v2 = current, v1 = prior draft baseline)."""
from common import Doc

FUND = "Lotus Bay Asia Growth Fund II, L.P."
GP = "Lotus Bay GP II Ltd."
MGR = "Lotus Bay Capital Pte. Ltd."
ADMIN = "Harbourline Fund Administration (Cayman) Ltd."


def variant(v):
    if v == 2:
        return dict(v=2, min="US$3,000,000", esc="30%", dp=13, gov=14,
                    title="Subscription Agreement (Offshore) – Version 2",
                    stamp="Version 2 – October 2026", pep=7, us=6)
    return dict(v=1, min="US$5,000,000", esc="25%", dp=14, gov=13,
                title="Subscription Agreement (Offshore) – Draft Version 1",
                stamp="Draft Version 1 – August 2026", pep=None, us=5)


class Counter:
    def __init__(self, sec):
        self.sec = sec
        self.n = 0

    def __call__(self):
        self.n += 1
        return f"{self.sec}.{self.n}"


def cover(d, V):
    d.p("")
    d.p(FUND.upper(), bold=True, align="center")
    d.p("A Cayman Islands exempted limited partnership", italic=True, align="center")
    d.p("SUBSCRIPTION AGREEMENT", bold=True, align="center")
    d.p("Offshore Investors (non-US Persons)", align="center")
    d.p(V["stamp"], bold=True, align="center")
    d.p("Interests are offered only in the jurisdictions and to the categories of investor described in Section 5.2. "
        "This Agreement does not constitute an offer to any person to whom, or in any jurisdiction in which, such an offer is unlawful.",
        italic=True, align="center")
    d.p(f"General Partner: {GP}  |  Manager: {MGR}  |  Administrator: {ADMIN}", align="center")
    d.page_break()
    d.p("This Subscription Agreement (this “Agreement”) is made between the person named as investor on the Signature Page "
        f"(the “Investor”) and {GP}, an exempted company incorporated in the Cayman Islands, acting as general partner "
        f"(the “General Partner”) of {FUND}, an exempted limited partnership registered in the Cayman Islands (the “Fund”).")
    d.h2("Recitals")
    d.sub("(A)", f"The Fund has been formed to make growth equity and structured investments in operating companies in Asia. The Fund is managed by {MGR} "
          "(the “Manager”), a Singapore company that holds a capital markets services licence (licence no. CMS-100777) issued by the "
          "securities regulator of Singapore.")
    d.sub("(B)", f"A parallel vehicle, Lotus Bay Asia Growth Fund II (US Feeder), L.P., a Delaware limited partnership (the “US Feeder”), has been formed to "
          "accept subscriptions from US taxable and US tax-exempt investors and will invest alongside the Fund on a pro rata basis.")
    d.sub("(C)", "The Investor wishes to subscribe for an interest in the Fund on the terms of this Agreement, the Private Placement Memorandum and the Partnership Agreement.")
    d.p("The parties therefore agree as follows.")


def sec1(d, V):
    d.h1("Section 1. Definitions and Interpretation")
    d.clause("1.1", "Definitions", "In this Agreement, unless the context otherwise requires:")
    defs = [
        ("Administrator", f"means {ADMIN}, or any successor administrator appointed by the General Partner."),
        ("Affiliate", "means, in relation to a person, any other person that directly or indirectly controls, is controlled by, or is under common control with that person."),
        ("AML Laws", "means the anti-money laundering, counter-terrorist financing and proliferation financing laws and regulations of the Cayman Islands, and of any other jurisdiction applicable to the Fund, the General Partner, the Manager or the Administrator, in each case as amended from time to time."),
        ("Applicable Law", "means all laws, regulations, rules, orders and binding regulatory guidance applicable to a person or to the matter in question."),
        ("Business Day", "means a day other than a Saturday, a Sunday or a day on which banks are generally closed in the Cayman Islands or Singapore."),
        ("Closing", "means any closing at which the General Partner admits one or more investors to the Fund, and “Closing Date” means the date on which a Closing takes place."),
        ("Confidential Information", "has the meaning given in Section 12.1."),
        ("Data Protection Law", f"means the data protection legislation of the Cayman Islands and any other data protection law that applies to the processing of personal data under this Agreement (see Section {V['dp']})."),
        ("Eligible Investor", "means an investor that satisfies the requirements of Section 5.1 and Section 5.2 for its jurisdiction of residence."),
        ("Interest", "means the limited partnership interest in the Fund for which the Investor subscribes under this Agreement."),
        ("Memorandum", "means the Private Placement Memorandum of the Fund dated October 2026, as supplemented from time to time."),
        ("Minimum Commitment", "has the meaning given in Section 2.3."),
        ("Partnership Agreement", "means the amended and restated exempted limited partnership agreement of the Fund to be entered into on or before the initial Closing, as amended from time to time."),
        ("PEP", "means a politically exposed person, being a natural person who is or has been entrusted with a prominent public function, and any immediate family member or close associate of such a person."),
        ("Sanctions", "means economic or financial sanctions, trade embargoes or restrictive measures administered or enforced by the United Nations, the Cayman Islands, Singapore, the European Union, the United Kingdom or the United States."),
        ("Side Letter", "means any letter agreement entered into between the General Partner (on behalf of the Fund) and an investor that supplements or modifies the terms applicable to that investor."),
        ("Signature Page", "means the signature page of this Agreement set out in Annex E."),
        ("Subscription Amount", "means the amount that the Investor agrees to commit to the Fund, as stated on the Signature Page."),
        ("Tax Forms", "means the US Internal Revenue Service forms and other tax certifications described in Section 7.1."),
        ("Transfer", "means any direct or indirect sale, assignment, pledge, encumbrance, declaration of trust or other disposal of all or any part of an Interest or of any economic or other right attached to it."),
        ("US Feeder Subscription Agreement", "means the subscription agreement used by investors that subscribe for interests in the US Feeder."),
        ("US Person", "means a “United States person” as defined in the US Internal Revenue Code of 1986, as amended, and any person that is a “U.S. person” for the purposes of Regulation S under the US Securities Act of 1933."),
    ]
    for t, x in defs:
        d.p(f"**“{t}”** {x}", indent=1.0)
    d.clause("1.2", "Terms Defined Elsewhere",
             "Capitalized terms used but not defined herein have the meanings given to them in the Partnership Agreement. If there is any conflict between this Agreement and the "
             "Partnership Agreement, the Partnership Agreement prevails, except where this Agreement expressly provides otherwise for the purposes of the Investor’s subscription.")
    d.clause("1.3", "Interpretation",
             "Headings are for convenience only and do not affect interpretation. References to Sections and Annexes are to sections of, and annexes to, this Agreement unless stated otherwise. "
             "" + ("The words “including” and “in particular” are illustrative and do not limit the words that precede them." if V["v"] == 2 else "The words “including” and “in particular” are not words of limitation.") + " A reference to a statute or regulation includes that "
             "statute or regulation as amended, extended or re-enacted. The singular includes the plural and the reverse. References to a person include individuals, bodies corporate, "
             "partnerships, trusts, pension funds and other entities, whether or not they have separate legal personality.<<fn:The Annexes form part of this Agreement for all purposes.>>")
    d.clause("1.4", "Language",
             "This Agreement is made in English. Any translation is provided for convenience only. If a translation conflicts with the English text, the English text prevails.")


def sec2(d, V):
    d.h1("Section 2. Subscription and Commitment")
    d.clause("2.1", "Subscription",
             "Subject to the terms of this Agreement, the Investor irrevocably subscribes for an Interest in the Fund in an amount equal to the Subscription Amount. "
             "Upon acceptance by the General Partner under Section 2.2, the Subscription Amount constitutes the Investor’s Capital Commitment to the Fund.")
    d.clause("2.2", "Acceptance",
             "The General Partner may accept or reject this subscription in whole or in part in its sole discretion. A subscription is accepted only when the General Partner "
             "countersigns the Signature Page and the Investor is entered in the register of limited partners of the Fund. Until then, the Investor has no rights as a partner of the Fund. "
             "The General Partner shall notify the Investor of acceptance or rejection within ten Business Days after the Closing Date.")
    min_text = (f"The minimum Capital Commitment for each Investor is {V['min']} (the “Minimum Commitment”). The General Partner may, in its sole discretion, accept a "
                "Capital Commitment below the Minimum Commitment, and any such acceptance must be recorded by the General Partner in a written waiver delivered to the Investor and the Administrator.")
    if V["v"] == 2:
        min_text += " For Investors resident in Singapore, the minimum Capital Commitment is S$3,000,000."
    d.clause("2.3", "Minimum Commitment", min_text)
    d.clause("2.4", "Fund Size",
             "The General Partner is targeting aggregate Capital Commitments to the Fund and the US Feeder of US$400,000,000 and has set a hard cap of US$500,000,000. "
             "The General Partner shall not accept subscriptions that would cause aggregate Capital Commitments to exceed the hard cap, and may scale back subscriptions on a pro rata basis "
             "or otherwise as it determines in good faith.")
    d.clause("2.5", "Currency",
             "All Capital Commitments, Drawdown Notices, payments and distributions are denominated and payable in United States dollars (“US$”). "
             "The Investor bears all costs of currency conversion, and no payment is made in satisfaction of any obligation under this Agreement until the Fund has received the full amount in cleared US$ funds.")
    d.clause("2.6", "US Feeder",
             "This Agreement may not be signed by a US Person. A US Person that wishes to invest must complete the US Feeder Subscription Agreement and subscribe through the US Feeder. "
             "The General Partner may allocate investments, expenses and liabilities between the Fund and the US Feeder in the manner provided in the Partnership Agreement.")
    d.clause("2.7", "Side Letters",
             "The General Partner may enter into any Side Letter with an Investor or a prospective investor. The terms of a Side Letter apply only to the investor that is party to it and "
             "prevail over this Agreement to the extent of any inconsistency. The General Partner shall make available to each Investor, on request, a summary of the Side Letter terms "
             "that the Partnership Agreement requires to be disclosed to the Investor. The Investor acknowledges that other investors may receive terms that it does not receive.")
    d.clause("2.8", "Investment Period and Term",
             "The Investor acknowledges that the Fund has a term of ten years from the initial Closing, subject to extension as provided in the Partnership Agreement, and that "
             "the investment period is expected to last four years from the initial Closing. The Investor acknowledges that the Interest is illiquid for the whole of that term.")


def sec3(d, V):
    d.h1("Section 3. Closing and Delivery of Documents")
    d.clause("3.1", "Closings",
             "The General Partner expects to hold the initial Closing on or about 15 December 2026 and to hold further Closings until the date twelve months after the initial Closing. "
             "The General Partner may hold a Closing on any Business Day and may change these dates by notice to Investors. An investor admitted at a later Closing is treated as admitted at the "
             "initial Closing and bears an equalisation payment calculated in accordance with the Partnership Agreement.")
    d.clause("3.2", "Delivery of Documents",
             "Each Investor shall deliver to the Administrator, at least ten Business Days before the Closing Date at which it proposes to be admitted: (a) the completed and signed Signature Page; "
             "(b) the completed investor questionnaire in Annex A; (c) the completed FATCA and CRS self-certification in Annex B; (d) the applicable Tax Forms; and (e) the constitutional, "
             "identification and authority documents that the Administrator requests. All Investors must deliver the documents listed in Annex C. Documents that are not in English must be "
             "accompanied by a certified English translation.")
    d.clause("3.3", "Conditions to Acceptance",
             "The General Partner is not obliged to accept a subscription until: (a) it has received every document required by Section 3.2 in a form satisfactory to the Administrator; "
             "(b) the Administrator has completed its due diligence under Section 6; (c) the General Partner is satisfied that acceptance would not breach Applicable Law or cause the Fund "
             "to become subject to registration or regulation that it does not currently face; and (d) the Investor has transferred its initial payment, if any is requested.")
    d.clause("3.4", "Rejection and Return of Funds",
             "If the General Partner rejects a subscription, or rejects part of it, the Fund shall return the corresponding amount, without interest and after deduction of any bank charges, "
             "within ten Business Days after the date of rejection. The Investor has no claim against the Fund, the General Partner, the Manager or the Administrator by reason of rejection.")
    d.clause("3.5", "Equalisation and Admission",
             "An Investor admitted after the initial Closing shall contribute the amount necessary to place it in the same position as if it had been admitted at the initial Closing, together with "
             "interest at the rate specified in the Partnership Agreement. The Administrator shall confirm the amount in writing before the Closing Date.")
    d.clause("3.6", "Changes Before Closing",
             "The Investor shall notify the Administrator immediately if any statement or information given in this Agreement or its Annexes ceases to be true, accurate or complete before the Closing Date. "
             "Failure to do so is a breach of this Agreement.")


def sec4(d, V):
    d.h1("Section 4. Capital Contributions and Drawdowns")
    d.clause("4.1", "Drawdowns",
             "The Investor shall contribute to the Fund the amounts called by the General Partner in each Drawdown Notice, up to the unfunded portion of its Capital Commitment. "
             "A Drawdown Notice shall be given at least ten Business Days before the date for payment and shall state the amount called, the purpose of the call and the payment date. "
             "The General Partner may call capital to fund investments, management fees, expenses and liabilities of the Fund and to repay borrowings.")
    d.clause("4.2", "Payment Mechanics",
             "The Investor shall pay each amount called by wire transfer of immediately available US$ funds to the Fund’s collection account described in Annex D. "
             "Payment shall be made without set-off, counterclaim, deduction or withholding. The Administrator shall send written confirmation of each payment received.")
    d.clause("4.3", "Management Fee",
             "The Investor acknowledges that, as described in the Memorandum and the Partnership Agreement, the Fund pays the Manager a management fee of 2.0% per annum of aggregate "
             "Capital Commitments during the four-year investment period and, after the investment period, 1.5% per annum of invested capital. The management fee is borne by the investors "
             "in proportion to their Capital Commitments.<<fn:The Memorandum contains a worked example of the management fee calculation.>>")
    d.clause("4.4", "Distributions and Carried Interest Escrow",
             "The Investor acknowledges that distributions are made on an American (deal-by-deal) basis in accordance with the Partnership Agreement, with an 8% preferred return, "
             f"a 100% catch-up and carried interest of 20%, and that {V['esc']} of the carried interest otherwise distributable to the General Partner or its Affiliates is retained "
             "in the Carried Interest Escrow until the conditions in the Partnership Agreement are met. The Investor acknowledges that the American waterfall may result in "
             "carried interest being paid on early realisations that are later reduced by losses on other investments.")
    d.clause("4.5", "Late Payment",
             "If the Investor fails to pay any amount by the date specified in a Drawdown Notice, the unpaid amount bears interest from the due date until payment in full at a rate of 12% per annum, "
             "compounded monthly. The General Partner may also exercise the remedies in Section 11.")
    d.clause("4.6", "Reserves and Recycling",
             "The General Partner may retain or recall distributions to the extent permitted by the Partnership Agreement for the purposes of reserves, follow-on investments and the payment of expenses. "
             "Amounts so retained or recalled increase the unfunded portion of the Investor’s Capital Commitment in the manner provided in the Partnership Agreement.")
    d.clause("4.7", "Limit on Obligations",
             "The Investor’s obligation to contribute capital is limited to its Capital Commitment, except as expressly provided in the Partnership Agreement in respect of "
             "the return of distributions, indemnification and the obligations of a Defaulting Limited Partner.")


def sec5(d, V):
    d.h1("Section 5. Investor Representations, Warranties and Eligibility" if V["v"] == 2 else "Section 5. Investor Representations and Eligibility")
    d.clause("5.1", "Eligible Investor Status",
             "Each Investor represents and warrants that it is an Eligible Investor under the laws of its place of residence. Each Investor resident in Singapore represents that it is an "
             "accredited investor or a professional investor, and the General Partner and the Fund may treat those two expressions as interchangeable for the purposes of this Agreement. "
             "The Investor shall give the General Partner prompt written notice if it ceases to be an Eligible Investor.<<fn:Status is assessed at the date of signature and at each Closing Date.>>")
    d.clause("5.2", "Eligible Jurisdictions",
             "The Fund offers Interests only to the categories of investor, and only in the jurisdictions, listed in the table below. No Interest is offered to a person in any other jurisdiction.")
    rows = [["Jurisdiction of residence", "Category of investor", "Evidence of status"],
            ["Singapore", "As described in Section 5.1", "Annex A, Part 2"],
            ["Hong Kong", "Professional investor", "Annex A, Part 3"],
            ["Japan", "Qualified institutional investor", "Annex A, Part 4"]]
    if V["v"] == 2:
        rows.append(["Vietnam", "Professional securities investor holding the required foreign-investment approval", "Annex A, Part 5"])
    rows.append(["United States", "Through the US Feeder only; not under this Agreement", f"Annex A, Part {V['us']}"])
    d.table(rows, widths=[4.0, 7.0, 4.5])
    n = Counter(5)
    n(); n()
    d.clause(n(), "Hong Kong Investors",
             "An Investor resident in Hong Kong represents that it is a professional investor within the meaning of the securities legislation of Hong Kong, that it has not been "
             "offered the Interest by means of any document other than the Memorandum, and that it will not offer or sell the Interest to any person who is not a professional investor.")
    d.clause(n(), "Japanese Investors",
             "An Investor resident in Japan represents that it is a qualified institutional investor within the meaning of the financial instruments legislation of Japan, "
             "that it has been informed that the offer has not been and will not be registered under that legislation, and that it will not resell the Interest in Japan except in a "
             "manner permitted by that legislation.")
    if V["v"] == 2:
        d.clause(n(), "Vietnamese Investors",
                 "An Investor resident in Vietnam represents that it is a professional securities investor under the securities laws of Vietnam and that it has obtained, and will maintain for the term of "
                 "the Fund, every foreign-investment approval, registration and licence that Vietnamese law requires for its investment in the Fund. The Investor shall deliver a copy of the approval "
                 "letter issued by the competent Vietnamese authority before the Closing Date.")
    d.clause(n(), "US Persons",
             "The Interests have not been and will not be registered under the US Securities Act of 1933. The Investor represents that it is not a US Person, that it is not acquiring the Interest "
             "for the account or benefit of a US Person, and that it will not Transfer the Interest to a US Person.")
    d.clause(n(), "Authority and Capacity",
             "The Investor represents that it has full power and authority to enter into and perform this Agreement; that, if it is an entity, it is duly organised and validly existing; "
             "that this Agreement has been duly authorised, signed and delivered by it and is its legal, valid and binding obligation; and that its entry into this Agreement does not "
             "conflict with its constitutional documents, any Applicable Law or any agreement by which it is bound.")
    d.clause(n(), "Investment Experience and Reliance",
             "The Investor represents that it has received and read the Memorandum and the Partnership Agreement; that it has such knowledge and experience in financial and business "
             "matters that it can evaluate the merits and risks of an investment in the Fund; that it has consulted its own legal, tax and financial advisers to the extent it considers necessary; "
             "and that it relies only on the Memorandum, the Partnership Agreement and this Agreement, and not on any other statement made by the General Partner, the Manager or the Administrator.")
    d.clause(n(), "Own Account and Beneficial Ownership",
             "The Investor represents that it subscribes for the Interest as principal for its own account and not as nominee or agent, except as disclosed in writing to the General Partner "
             "before the Closing Date, and that it has disclosed the identity of each person who ultimately owns or controls it. The Investor shall notify the Administrator promptly of any change in that information.")
    d.clause(n(), "Illiquidity and Risk",
             "The Investor acknowledges that an investment in the Fund involves a high degree of risk; that there is no market for the Interest and none is expected to develop; "
             "that it may be unable to Transfer the Interest or to liquidate its investment; that it can bear the economic risk of the investment for the full term of the Fund; and that it "
             "can afford a complete loss of its Subscription Amount.")
    d.clause(n(), "Accuracy of Information and Indemnity",
             "The Investor represents that all information it has provided in this Agreement and its Annexes is true, accurate and complete, and that the General Partner, the Manager and the "
             "Administrator may rely on it. The Investor shall indemnify the Fund, the General Partner, the Manager and the Administrator against all losses, liabilities, costs and expenses "
             "(including reasonable legal fees) arising from any breach of a representation or warranty in this Section 5.")
    d.clause(n(), "Securities Law Acknowledgements",
             "The Investor acknowledges that the Interests are offered in reliance on exemptions from registration or prospectus requirements, that those exemptions depend on the accuracy of "
             "the Investor’s representations, and that no securities regulator has reviewed or approved the Memorandum.")


def sec6(d, V):
    d.h1("Section 6. Anti-Money Laundering and Sanctions")
    d.clause("6.1", "Compliance with AML Laws",
             "The Investor acknowledges that the Fund, the General Partner and the Administrator are subject to the AML Laws, that the Administrator performs customer due diligence on behalf of "
             "the Fund, and that the Fund may be required to obtain, verify and retain information about the Investor and each person who owns or controls it.")
    d.clause("6.2", "Cayman AML Schedule",
             "To enable the Administrator to perform its due diligence, each Investor shall complete the Cayman AML Schedule set out in Annex C and deliver it to the Administrator "
             "together with certified copies of the identification and verification documents listed in it.")
    if V["v"] == 2:
        d.clause("6.3", "Politically Exposed Persons",
                 f"Each Investor shall complete the PEP questionnaire in Annex A, Part {V['pep']}, in respect of itself, each of its directors and authorised signatories, and each beneficial owner of 10% or more of its equity. "
                 "If any such person is a PEP, the Administrator may require enhanced due diligence, including additional evidence of the source of wealth and source of funds, "
                 "and the General Partner may require senior management approval before accepting the subscription.")
    else:
        d.clause("6.3", "Politically Exposed Persons",
                 "Each Investor shall inform the Administrator promptly if it, any of its directors or authorised signatories, or any beneficial owner of 10% or more of its equity is a PEP. "
                 "If so, the Administrator may require enhanced due diligence, including additional evidence of the source of wealth and source of funds, "
                 "and the General Partner may require senior management approval before accepting the subscription.")
    d.clause("6.4", "Source of Funds",
             "The Investor represents that the funds used to pay the Subscription Amount and each amount called under a Drawdown Notice are not derived from, and will not be used for, "
             "any unlawful activity; that they will be paid from a bank account held in the Investor’s own name at a bank in a jurisdiction that applies AML standards equivalent to those of the Cayman Islands; "
             "and that no payment will be made by or on behalf of any third party without the prior written consent of the Administrator.")
    d.clause("6.5", "Sanctions",
             "The Investor represents that neither it nor any of its directors, officers, controlling persons or beneficial owners is the subject or target of Sanctions, is located, organised or resident "
             "in a country or territory that is the subject of comprehensive Sanctions, or is owned or controlled by any such person. The Investor shall notify the Administrator immediately if "
             "this representation ceases to be true.")
    d.clause("6.6", "Action by the General Partner",
             "The General Partner and the Administrator may refuse or delay acceptance of a subscription, suspend payments of distributions or redemption proceeds, or compulsorily withdraw an Investor from the Fund "
             "if they suspect, or are advised, that the Investor is in breach of this Section 6 or that doing so is necessary to comply with the AML Laws or Sanctions. They may also disclose "
             "information about the Investor to any authority as the AML Laws require. The Investor waives any claim against them arising from any such action taken in good faith.")
    d.clause("6.7", "Ongoing Obligations",
             "The Investor shall provide promptly any additional information or documents the Administrator requests at any time for the purposes of ongoing monitoring, and shall update the "
             "information previously given whenever it changes, including any change in its directors, authorised signatories, controlling persons or ownership.")
    d.clause("6.8", "Intermediaries",
             "If the Investor is acting through an intermediary or introducer, the Investor shall procure that the intermediary gives the Administrator a written certification that it has performed "
             "customer due diligence on the Investor to a standard equivalent to the AML Laws and will provide copies of the supporting records on request.")


def sec7(d, V):
    d.h1("Section 7. Tax Matters; FATCA and CRS")
    d.clause("7.1", "Tax Forms",
             "Each Investor shall deliver the Tax Form that applies to it, namely: Form W-8BEN for an individual that is not a US Person; Form W-8BEN-E for an entity that is not a US Person; "
             "and, for a US Person that invests through the US Feeder, Form W-9. The Tax Form Selection Guide issued by the Administrator explains which form applies to each category of investor. "
             "Each Tax Form must be signed, dated and current at the Closing Date.<<fn:The Administrator reviews each Tax Form for completeness only and does not give tax advice.>>")
    d.clause("7.2", "FATCA and CRS Self-Certification",
             "Each Investor shall complete the self-certification in Annex B. The Investor acknowledges that the Fund is a reporting financial institution under the US Foreign Account Tax Compliance Act (“FATCA”) "
             "and the OECD Common Reporting Standard (“CRS”) as implemented in the Cayman Islands, and that the Fund must report information about the Investor and its controlling persons to the "
             "Cayman Islands tax authority, which may exchange it with the tax authorities of other jurisdictions.")
    d.clause("7.3", "Changes in Circumstances",
             "The Investor shall notify the Administrator within thirty days after any change in circumstances that makes a Tax Form or its Annex B self-certification incorrect or incomplete, "
             "and shall deliver a replacement within that period. Until a replacement is delivered, the General Partner may treat the Investor as a non-participating or recalcitrant account holder.")
    d.clause("7.4", "Withholding",
             "The Fund may deduct and withhold from any payment to the Investor any amount that Applicable Law requires it to withhold. Amounts withheld and paid to the competent authority are treated "
             "as having been distributed to the Investor. If the Fund is required to pay tax by reason of the Investor’s status or failure to provide information, the General Partner may require the Investor to reimburse the Fund.")
    d.clause("7.5", "Consent to Disclosure",
             "The Investor consents to the disclosure by the Fund, the General Partner, the Manager and the Administrator of any information about the Investor that FATCA, CRS or any "
             "intergovernmental agreement requires or that a tax authority requests, and waives any confidentiality or data protection restriction that would prevent that disclosure to the extent permitted by Applicable Law.")
    d.clause("7.6", "Cayman Islands Tax Position",
             "The Investor acknowledges the summary of Cayman Islands tax matters in the Memorandum, including that the Cayman Islands currently imposes no income, capital gains or withholding tax on the Fund "
             "or on distributions to non-resident investors. The Investor is responsible for the tax consequences of its investment in its own jurisdiction.")
    d.clause("7.7", "US Tax-Exempt Investors",
             "The Investor acknowledges that US tax-exempt investors invest through the US Feeder and may elect to hold their interest through a blocker entity to limit exposure to unrelated business taxable income. "
             "Nothing in this Agreement is tax advice.")
    d.clause("7.8", "Indemnity",
             "The Investor shall indemnify the Fund and the General Partner against any tax, interest, penalty or cost imposed on either of them as a result of the Investor’s failure to comply with this Section 7.")


def sec8(d, V):
    d.h1("Section 8. Power of Attorney")
    d.clause("8.1", "Appointment",
             "The Investor irrevocably appoints the General Partner, and each of its authorised signatories, as its attorney-in-fact with full power of substitution, in its name and on its behalf, to: "
             "(a) sign, execute, deliver, file and record the Partnership Agreement, and any amendment to it that is made in accordance with its terms; (b) sign and file any certificate, notice, "
             "instrument or document that is required by Applicable Law to constitute or continue the Fund or to admit the Investor as a limited partner; and (c) sign any counterpart of this Agreement that the General Partner requires to give effect to its terms.")
    d.clause("8.2", "Limits",
             "The power of attorney in Section 8.1 does not authorise the General Partner to increase the Investor’s Capital Commitment, to increase its liability beyond that stated in the Partnership Agreement, "
             "or to make any amendment that requires the consent of the Investor under the Partnership Agreement without that consent having been obtained.")
    d.clause("8.3", "Duration",
             "The power of attorney is coupled with an interest and is irrevocable. It survives the dissolution, insolvency, incapacity or bankruptcy of the Investor and extends to the Investor’s successors and permitted assigns. "
             "It terminates, as to a transferee, when that transferee is admitted to the Fund in place of the Investor.")
    d.clause("8.4", "Ratification and Further Assurance",
             "The Investor ratifies and confirms everything the General Partner lawfully does under the power of attorney and shall, on request, sign any further document that is reasonably necessary to give effect to it.")
    d.clause("8.5", "Governing Law of the Power of Attorney" if V["v"] == 2 else "Governing Law",
             "The power of attorney in this Section 8 is governed by the laws of the Cayman Islands and is intended to take effect as a deed.")


def sec9(d, V):
    d.h1("Section 9. Regulatory Matters and Exemptions")
    d.clause("9.1", "No Public Offer",
             "The offer of Interests is a private placement. The Memorandum and this Agreement have been provided to the Investor personally and may not be distributed to any other person. "
             "The Investor shall not make any public offer of the Interest or advertise the Fund.")
    d.clause("9.2", "Singapore",
             "The Interests are offered in Singapore in reliance on the exemptions in the securities legislation of Singapore for offers made to categories of investor that are described in Section 5.1. "
             "The Memorandum has not been registered as a prospectus with the securities regulator of Singapore, and the Investor shall not circulate or distribute it to any person in Singapore other than as permitted by that legislation.")
    d.clause("9.3", "Hong Kong",
             "No advertisement, invitation or document relating to the Interests has been issued, and none will be issued, in Hong Kong other than to professional investors. "
             "The Fund is not authorised by the securities regulator of Hong Kong, and the Memorandum has not been registered with the Registrar of Companies in Hong Kong.")
    d.clause("9.4", "Japan",
             "The Interests are offered in Japan only to qualified institutional investors in a private placement exempt from registration. Any Transfer of the Interest in Japan is permitted only to another qualified institutional investor and only in accordance with the conditions of that exemption.")
    d.clause("9.5", "Regulated Financial Institutions",
             "Investors that are regulated financial institutions in a FATF member jurisdiction are not required to deliver any documents under Annex C. "
             "The Administrator may nonetheless request any information or document that it considers necessary to satisfy the AML Laws, and the Investor shall provide it promptly.")
    if V["v"] == 2:
        d.clause("9.6", "Vietnam",
                 "The Interests are offered in Vietnam only to professional securities investors in a private placement. The Memorandum has not been registered with, and has not been approved by, any Vietnamese authority. "
                 "The Investor shall comply with all Vietnamese foreign-exchange and foreign-investment requirements applicable to remittances to and from the Fund.")
        d.clause("9.7", "Other Jurisdictions",
                 "No action has been taken in any jurisdiction other than those listed in Section 5.2 that would permit a public offering of the Interests or the possession or distribution of the Memorandum. "
                 "The Investor shall comply with all Applicable Law of any jurisdiction in which it receives the Memorandum or makes this subscription.")
    else:
        d.clause("9.6", "Other Jurisdictions",
                 "No action has been taken in any jurisdiction other than those listed in Section 5.2 that would permit a public offering of the Interests or the possession or distribution of the Memorandum. "
                 "The Investor shall comply with all Applicable Law of any jurisdiction in which it receives the Memorandum or makes this subscription.")


def sec10(d, V):
    d.h1("Section 10. Transfer Restrictions")
    d.clause("10.1", "General Prohibition",
             "The Investor shall not Transfer all or any part of its Interest without the prior written consent of the General Partner and, in every case, compliance with the Partnership Agreement and this Section 10. "
             "A purported Transfer in breach of this Section 10 is void and the Fund shall not recognise it.")
    d.clause("10.2", "Consent to Transfers",
             "Subject to Section 10.1 and the Partnership Agreement, the General Partner shall not unreasonably withhold consent to a Transfer to an Affiliate of the Investor that is itself an Eligible Investor, "
             "provided that the transferor remains liable for any unfunded portion of the Capital Commitment unless the General Partner releases it in writing.")
    d.clause("10.3", "Conditions to Any Transfer",
             "Before any Transfer is effective: (a) the transferee shall sign a subscription agreement and a deed of adherence to the Partnership Agreement in a form satisfactory to the General Partner; "
             "(b) the transferee shall deliver all documents that Section 3.2 and Section 6 would require of an Investor; (c) the Transfer shall not breach any Applicable Law or cause the Fund to be required to register under any securities, "
             "investment company or similar law; (d) the Transfer shall not cause a material adverse tax or regulatory consequence for the Fund or any other investor; and (e) the transferor shall pay all costs of the Transfer, including the reasonable legal fees of the Fund.")
    typo = "shall unreasonably withhold" if V["v"] == 2 else "shall not unreasonably withhold"
    d.clause("10.4", "Regulatory Transfers",
             "In the case of a Transfer required by a change in law applicable to an Investor that is a pension fund or an insurance company, "
             f"the General Partner {typo} consent to that Transfer, and may refuse consent only if the transferee does not satisfy the requirements of Section 6.")
    d.clause("10.5", "Legends and Restrictions on Resale",
             "The Investor acknowledges that the Interests are subject to the transfer restrictions in the Partnership Agreement and in this Agreement, and that the register of limited partners will record these restrictions. "
             "The Investor shall not Transfer the Interest to any person who is not an Eligible Investor in the jurisdiction in which the transferee is resident.")
    d.clause("10.6", "No Withdrawal",
             "The Investor has no right to withdraw from the Fund or to redeem all or any part of its Interest, other than as expressly provided in the Partnership Agreement.")
    d.clause("10.7", "Pledges and Financing",
             "The Investor shall not pledge or grant any security over its Interest or over its right to receive distributions without the prior written consent of the General Partner. "
             "Any such pledge made with consent remains subject to the Partnership Agreement, and the pledgee has no rights as a partner of the Fund.")
    d.clause("10.8", "Notice of Transfer",
             "An Investor that proposes a Transfer shall give the General Partner at least thirty days’ written notice identifying the proposed transferee, the consideration and the date on which the Transfer is intended to complete.")


def sec11(d, V):
    d.h1("Section 11. Default, Excuse and Remedies")
    d.clause("11.1", "Failure to Fund",
             "If the Investor fails to pay any amount called under a Drawdown Notice by the due date, and the failure continues for ten Business Days after notice from the General Partner, the General Partner may "
             "declare the Investor a Defaulting Limited Partner by written notice. From that date the consequences set out in the Partnership Agreement apply to the Investor.")
    d.clause("11.2", "Remedies",
             "Without limiting the Partnership Agreement, the General Partner may, in respect of a Defaulting Limited Partner: (a) suspend its voting and information rights; (b) apply distributions otherwise payable to it "
             "against amounts owed; (c) reduce its capital account by an amount determined under the Partnership Agreement; (d) require it to sell its Interest at a discount to a person nominated by the General Partner; "
             "and (e) pursue any other remedy available at law, including recovery of the unpaid amount and interest under Section 4.5.")
    d.clause("11.3", "Excused Investors",
             "An Investor may notify the General Partner within five Business Days after receiving a Drawdown Notice that its participation in a particular investment would breach Applicable Law, "
             "or the investment restrictions that bind it. If the General Partner accepts that notice, the Investor is an Excused Investor in respect of that investment, and the amount called for it is "
             "reduced accordingly. Excuse rights granted in a Side Letter are in addition to this Section 11.3 and are subject to the Partnership Agreement.")
    d.clause("11.4", "Carried Interest Escrow and Clawback",
             "The Investor acknowledges that the General Partner is obliged under the Partnership Agreement to retain "
             + (f"{V['esc']}" if V["v"] == 1 else "[●]%") +
             " of the carried interest distributed to it or its Affiliates in the Carried Interest Escrow as security for any clawback obligation, and that amounts held in the "
             "Carried Interest Escrow are released only in accordance with the Partnership Agreement.")
    d.clause("11.5", "Key Person Event",
             "The Investor acknowledges that the Partnership Agreement provides that, on a Key Person Event, the investment period is automatically suspended unless investors approve its continuation within the period stated in the Partnership Agreement. "
             "The Memorandum identifies the individuals who are key persons at the date of this Agreement.")
    d.clause("11.6", "Limited Liability",
             "Subject to the Partnership Agreement and the exempted limited partnership law of the Cayman Islands, the liability of the Investor for the debts and obligations of the Fund is limited to its Capital Commitment. "
             "The Investor does not take part in the conduct of the business of the Fund within the meaning of that law by signing this Agreement or exercising any right under the Partnership Agreement.")


def sec12(d, V):
    d.h1("Section 12. Confidentiality and Reporting")
    d.clause("12.1", "Confidential Information",
             "“Confidential Information” means the Memorandum, the Partnership Agreement, any Side Letter, any report, valuation or notice given to the Investor, "
             "and any information about the Fund, its investments, its investors or the General Partner and the Manager that is not public. The Investor shall keep Confidential Information strictly confidential, "
             "shall use it only to evaluate and monitor its investment, and shall not disclose it to any person except as permitted by Section 12.2.")
    d.clause("12.2", "Permitted Disclosure",
             "The Investor may disclose Confidential Information: (a) to its directors, employees, auditors and professional advisers who need to know it and who are bound by duties of confidentiality; "
             "(b) to the extent required by Applicable Law, a court or a regulator, after giving the General Partner prior notice where lawful; and (c) in the case of a public pension fund, "
             "university or similar entity, to the extent required by a public records or freedom of information law, provided that the Investor gives prompt notice and uses reasonable efforts to protect the information.")
    d.clause("12.3", "Reports",
             "The General Partner shall deliver to each Investor: (a) within one hundred and twenty days after each financial year-end, annual financial statements of the Fund audited by Pell & Quayside or other independent auditors; "
             "(b) within sixty days after the end of each quarter, an unaudited report on the Fund and its investments; and (c) each Drawdown Notice and distribution notice. "
             "Reports are delivered in English through the Administrator’s investor portal unless a Side Letter provides otherwise.")
    d.clause("12.4", "Advertising and Publicity" if V["v"] == 2 else "Publicity",
             "The Investor shall not use the name of the Fund, the General Partner, the Manager or the Administrator in any publicity without the prior written consent of the General Partner.")
    d.clause("12.5", "Investor Portal",
             "The Administrator provides a secure online portal for reports and notices. The Investor is responsible for keeping its login credentials secure and shall notify the Administrator immediately of any unauthorised access.")


def sec_dp(d, V):
    n = V["dp"]
    d.h1(f"Section {n}. Data Protection")
    d.clause(f"{n}.1", "Controllers and Processors",
             f"For the purposes of the Data Protection Law, the Fund and the General Partner are joint data controllers of the personal data that the Investor, its directors, employees, authorised signatories, controlling persons and beneficial owners provide in connection with this Agreement. "
             f"The Manager and the Administrator process that personal data on behalf of the Fund and the General Partner as data processors.")
    d.clause(f"{n}.2", "Categories of Data",
             "The personal data processed includes names, contact details, dates of birth, nationality, residential addresses, identification document numbers, tax identification numbers, source of wealth and funds information, "
             "bank details, PEP and Sanctions screening results, and records of communications with the Investor.")
    d.clause(f"{n}.3", "Purposes and Legal Bases",
             "The personal data is processed to perform this Agreement and the Partnership Agreement; to comply with the AML Laws, FATCA, CRS and other legal obligations; to manage the Fund and the relationship with the Investor; "
             "to establish, exercise or defend legal claims; and for the legitimate interests of the Fund and the General Partner in operating the Fund. The Investor acknowledges the privacy notice in the Memorandum.")
    d.clause(f"{n}.4", "Recipients and International Transfers",
             "The personal data may be disclosed to the Manager and its Affiliates in Singapore, to the Administrator, to the auditors and legal advisers of the Fund, to banks and custodians, and to competent authorities in the Cayman Islands and elsewhere. "
             "Some of those recipients are located in jurisdictions that do not have data protection laws equivalent to those of the Cayman Islands. The General Partner shall ensure that appropriate safeguards are in place for any such transfer.")
    d.clause(f"{n}.5", "Retention",
             "The personal data is kept for as long as the Investor holds an Interest and, afterwards, for at least five years after the end of the business relationship, or longer where Applicable Law requires.")
    d.clause(f"{n}.6", "Rights of Individuals",
             "Individuals have the right to access their personal data, to have inaccurate data corrected, to object to or restrict certain processing, to request erasure where permitted, and to complain to the supervisory authority. "
             "Requests may be sent to the General Partner at the address in Section 15.3.")
    d.clause(f"{n}.7", "Investor Undertakings",
             "The Investor represents that it is authorised to provide personal data about individuals connected with it and shall inform each such individual of the processing described in this Section "
             f"{n} before the data is provided.<<fn:The Memorandum contains a template notice that the Investor may give to individuals.>>")
    d.clause(f"{n}.8", "Security and Breach Notification",
             "The Fund, the General Partner, the Manager and the Administrator shall maintain appropriate technical and organisational measures to protect personal data, and shall notify the Investor without undue delay, and in any event within seventy-two hours, "
             "after becoming aware of a breach of security that is likely to result in a risk to the rights of the individuals concerned.")


def sec_gov(d, V):
    n = V["gov"]
    d.h1(f"Section {n}. Governing Law and Dispute Resolution")
    d.clause(f"{n}.1", "Governing Law",
             "This Agreement, and any non-contractual obligation arising out of or in connection with it, is governed by and shall be construed in accordance with the laws of the Cayman Islands.")
    d.clause(f"{n}.2", "Jurisdiction",
             "The courts of the Cayman Islands have exclusive jurisdiction to settle any dispute arising out of or in connection with this Agreement, including any dispute regarding its existence, validity or termination. "
             "The Investor irrevocably submits to that jurisdiction and waives any objection to proceedings in those courts on the ground of venue or forum non conveniens.")
    d.clause(f"{n}.3", "Service of Process",
             "The Investor irrevocably appoints the Administrator as its agent for service of process in the Cayman Islands, and agrees that service on that agent is good service on the Investor. "
             "The General Partner may also serve process in any other manner permitted by Applicable Law.")
    d.clause(f"{n}.4", "Sovereign Immunity",
             "If the Investor is, or is owned or controlled by, a government, state agency or public institution, it waives to the fullest extent permitted by law all immunity from suit, jurisdiction, attachment and execution in relation to this Agreement.")
    d.clause(f"{n}.5", "Third Party Rights",
             "Except for the General Partner, the Manager and the Administrator, who may enforce the indemnities in this Agreement, no person other than the parties has any right to enforce any term of this Agreement.")
    d.clause(f"{n}.6", "Equitable Relief",
             "The Investor acknowledges that damages may not be an adequate remedy for a breach of Section 10 or Section 12 and that the General Partner is entitled to seek injunctive relief.")


def sec15(d, V):
    d.h1("Section 15. Miscellaneous")
    d.clause("15.1", "Entire Agreement",
             "This Agreement, the Annexes, the Partnership Agreement and any Side Letter constitute the entire agreement between the parties relating to the Investor’s subscription and supersede all prior discussions, "
             "term sheets and understandings. Nothing in this Section 15.1 limits any liability for fraud.")
    d.clause("15.2", "Amendment and Waiver",
             "This Agreement may be amended only by a written instrument signed by the Investor and the General Partner. No failure or delay in exercising any right is a waiver of it, and no single or partial exercise precludes any further exercise.")
    d.clause("15.3", "Notices",
             "Notices to the General Partner shall be sent to Lotus Bay GP II Ltd., c/o Lotus Bay Capital Pte. Ltd., 8 Marina View, #40-01, Singapore 018960, marked for the attention of Investor Relations, with a copy by email to investor.relations@lotusbay.example.com. "
             "Notices to the Administrator shall be sent to lb2-investors@harbourline.example.com. Notices to the Investor shall be sent to the address on the Signature Page. A notice sent by email is deemed received on the next Business Day, "
             "and a notice sent by courier is deemed received on the third Business Day after dispatch.")
    d.clause("15.4", "Counterparts and Electronic Signature",
             "This Agreement may be signed in counterparts, each of which is an original, and all of which together constitute one agreement. " + ("Signature by a recognised electronic signature platform is effective as signature by hand." if V["v"] == 2 else "An electronic signature has the same effect as a signature by hand.") + "")
    d.clause("15.5", "Severability",
             "If any provision of this Agreement is held to be invalid, illegal or unenforceable, the remaining provisions remain in full force and the parties shall negotiate in good faith a valid provision that achieves, as nearly as possible, the same effect.")
    d.clause("15.6", "Survival and Assignment",
             "The representations, warranties, indemnities and confidentiality obligations in this Agreement survive the Closing, the Transfer of the Interest and the termination of the Fund. "
             "The Investor may not assign any right or delegate any obligation under this Agreement except through a Transfer made in accordance with Section 10.")
    d.clause("15.7", "Costs",
             "Each party bears its own costs in connection with the negotiation and signature of this Agreement. The costs of the Administrator’s due diligence on the Investor are borne by the Fund, except where the Investor is the subject of a rejection or a Transfer, in which case they are borne by the Investor.")
    d.clause("15.8", "Further Assurance",
             "Each party shall sign all documents and do all things reasonably required to give effect to this Agreement, and the Investor shall promptly provide any information that the General Partner or the Administrator reasonably requests to comply with Applicable Law.")


def annex_a(d, V):
    d.page_break()
    d.h1("Annex A. Investor Questionnaire")
    d.p("Each Investor shall complete Part 1 and each other Part that applies to its jurisdiction of residence. Tick the boxes that apply. "
        "The General Partner and the Administrator rely on the answers when deciding whether to accept the subscription.")
    d.h2("Part 1. Investor Type and Identification")
    d.p("Tick one box to indicate the type of Investor.")
    d.checks(["Individual", "Corporation", "Trust", "Pension", "Insurance Company"], title="Type of Investor")
    d.table([["Item", "Response"],
             ["Full legal name of Investor", "______________________________"],
             ["Country of residence or incorporation", "______________________________"],
             ["Registered address", "______________________________"],
             ["Tax identification number", "______________________________"],
             ["Contact person and email", "______________________________"]], widths=[7.0, 8.5])
    d.p("If the Investor is a trust, also state the name of each trustee and the settlor in the space above. If the Investor is not an individual, "
        "attach an organisation chart showing every person who owns or controls 10% or more of the Investor.")
    part = 2
    d.h2(f"Part {part}. Singapore Investors"); part += 1
    d.p("Complete this Part if the Investor is resident in Singapore. The category that applies to the Investor is described in Section 5.1.")
    d.checks(["I confirm that I am resident in Singapore and that I am an Eligible Investor of the category described in Section 5.1.",
              "I attach evidence of my status that is dated within the last three months.",
              "I confirm that I have not been treated by any adviser as a retail investor in relation to this investment."])
    d.h2(f"Part {part}. Hong Kong Investors"); part += 1
    d.p("Complete this Part if the Investor is resident in Hong Kong. Tick the category of professional investor that applies.")
    d.checks(["A trust corporation that is entrusted with total assets of at least the amount prescribed by the Hong Kong rules.",
              "An individual with a portfolio of at least the amount prescribed by the Hong Kong rules.",
              "A corporation or partnership with a portfolio, or total assets, of at least the amount prescribed by the Hong Kong rules.",
              "A regulated financial institution, insurer, collective investment scheme or pension scheme within the meaning of the Hong Kong rules."])
    d.p("The Investor confirms that it has been informed of the consequences of being treated as a professional investor and consents to that treatment.")
    d.h2(f"Part {part}. Japanese Investors"); part += 1
    d.p("Complete this Part if the Investor is resident in Japan.")
    d.checks(["A financial instruments business operator, bank, insurance company or similar institution that is a qualified institutional investor.",
              "A pension fund or similar institution that is a qualified institutional investor by reason of the size of its assets.",
              "Another entity that has been notified to the Japanese authorities as a qualified institutional investor."])
    if V["v"] == 2:
        d.h2(f"Part {part}. Vietnamese Investors"); part += 1
        d.p("Complete this Part if the Investor is resident in Vietnam.")
        d.checks(["I confirm that I am a professional securities investor under the securities laws of Vietnam.",
                  "I attach a copy of the foreign-investment approval letter issued by the competent Vietnamese authority.",
                  "I confirm that the outward remittance of the Subscription Amount has been approved by the Vietnamese authorities."])
        d.table([["Item", "Response"], ["Approval letter reference number", "______________________"], ["Date of approval letter", "______________________"]], widths=[7.0, 8.5])
    d.h2(f"Part {part}. United States"); part += 1
    d.p("An Investor that is a US Person may not use this Agreement and shall subscribe through the US Feeder using the US Feeder Subscription Agreement.")
    d.checks(["I confirm that I am not a US Person and that I am not subscribing for the account or benefit of a US Person."])
    if V["v"] == 2:
        d.h2(f"Part {part}. Politically Exposed Persons Questionnaire")
        d.p("Answer every question for the Investor, each of its directors and authorised signatories, and each beneficial owner of 10% or more of its equity.")
        d.table([["No.", "Question", "Yes", "No"],
                 ["1", "Is the Investor, or any person described above, a politically exposed person?", "☐", "☐"],
                 ["2", "Is any such person an immediate family member of a politically exposed person?", "☐", "☐"],
                 ["3", "Is any such person a close associate of a politically exposed person?", "☐", "☐"],
                 ["4", "If the answer to question 1, 2 or 3 is Yes, give the name, the public function, the country and the dates held.", "", ""]],
                widths=[1.2, 11.0, 1.6, 1.6])
        d.p("If the answer to question 1, 2 and 3 is No, the Investor should leave question 4 blank. The Investor shall tell the Administrator within ten Business Days if any answer changes.")
    d.p("Signature of authorised signatory: ______________________   Date: ______________")


def annex_b(d, V):
    d.page_break()
    d.h1("Annex B. FATCA and CRS Self-Certification")
    d.p("This self-certification is used by the Fund to comply with FATCA and CRS. It is not a Tax Form. Complete every Part that applies. If the Investor is unsure of its classification, it should consult its tax adviser.<<fn:Capitalised acronyms in this Annex have the meaning commonly given to them in FATCA and CRS guidance.>>")
    d.h2("Part 1. Identification of the Account Holder")
    d.table([["Item", "Response"],
             ["Name of Account Holder", "______________________________"],
             ["Country of incorporation or residence", "______________________________"],
             ["Permanent residence or business address", "______________________________"],
             ["Mailing address (if different)", "______________________________"],
             ["Date of birth (individuals only)", "______________________________"]], widths=[7.0, 8.5])
    d.h2("Part 2. FATCA Classification")
    d.p("Tick one box.")
    d.checks(["Individual that is not a US Person",
              "Participating foreign financial institution",
              "Registered deemed-compliant foreign financial institution",
              "Exempt beneficial owner (including a pension fund or government entity)",
              "Active non-financial foreign entity",
              "Passive non-financial foreign entity (complete Part 4)",
              "Investment entity managed by another financial institution"], title="FATCA status")
    d.h2("Part 3. CRS Tax Residence")
    d.p("List every country in which the Account Holder is resident for tax purposes. If a tax identification number is not issued, state the reason.")
    d.table([["Country of tax residence", "Tax identification number", "Reason if no number"],
             ["", "", ""], ["", "", ""], ["", "", ""]], widths=[5.5, 5.5, 5.0])
    d.h2("Part 4. Controlling Persons of a Passive Entity")
    d.p("If the Account Holder ticked “Passive non-financial foreign entity” in Part 2, list each controlling person. A controlling person is a natural person who exercises control over the Account Holder, "
        "and in the case of a trust includes the settlor, the trustees, the protector and each beneficiary.")
    d.table([["Name", "Country of residence", "Tax identification number", "Role"],
             ["", "", "", ""], ["", "", "", ""]], widths=[4.5, 3.5, 4.0, 4.0])
    d.h2("Part 5. Declaration")
    d.p("I declare that the information in this self-certification is, to the best of my knowledge, correct and complete. I undertake to inform the Administrator within thirty days if any information changes, "
        "and I acknowledge that the Fund may report the information to the Cayman Islands tax authority.")
    d.p("Signature: ______________________   Name: ______________________   Capacity: ______________   Date: ____________")


def annex_d(d, V):
    d.page_break()
    d.h1("Annex D. Wire Instructions")
    d.p("Payments under Section 4.2 shall be sent to the following collection account. These details are fictional and are provided for test purposes only. "
        "Before sending any funds, the Investor should confirm these details by calling the Administrator on +65 6555 0142 at a number obtained independently of this document.")
    d.table([["Field", "Detail"],
             ["Beneficiary", "Lotus Bay Asia Growth Fund II, L.P. – Subscription Collection"],
             ["Beneficiary bank", "Fictional Reserve Trust Bank N.A. (not a real bank)"],
             ["SWIFT code", "FRTBUS99XXX"],
             ["ABA Routing No.: 000000018", "Intermediary routing for USD payments"],
             ["Account Number: 9990001234567", "USD collection account"],
             ["Reference", "LB2 followed by the name of the Investor"]], widths=[7.0, 8.5])
    d.p("The Administrator will never change these instructions by email alone. Any change must be confirmed by telephone and in writing signed by two authorised signatories of the General Partner.")


def annex_e(d, V):
    d.page_break()
    d.h1("Annex E. Signature Pages")
    d.h2("Part 1. Signature Page of the Investor")
    d.p("The Investor, by signing below, subscribes for an Interest in the Fund on the terms of this Agreement, and makes the representations and warranties in it, and grants the power of attorney in Section 8.")
    d.table([["Item", "Response"],
             ["Subscription Amount (US$)", "______________________________"],
             ["Name of Investor", "______________________________"],
             ["Address for notices", "______________________________"],
             ["Email for notices", "______________________________"],
             ["Authorised signatory name and title", "______________________________"]], widths=[7.0, 8.5])
    d.p("Signed for and on behalf of the Investor:")
    d.p("______________________________   Date: ______________")
    d.p("Witness (individual Investors only):")
    d.p("Name: ______________________   Signature: ______________________")
    d.h2("Part 2. Acceptance by the General Partner")
    d.p(f"Accepted on behalf of {FUND} by {GP}, as General Partner, for a Capital Commitment of US$ ______________ on the Closing Date of ______________.")
    d.p("______________________________   Authorised signatory   Date: ______________")


def build(V, path):
    d = Doc(V["title"])
    cover(d, V)
    for f in (sec1, sec2, sec3, sec4, sec5, sec6, sec7, sec8, sec9, sec10, sec11, sec12):
        f(d, V)
    if V["v"] == 2:
        sec_dp(d, V); sec_gov(d, V)
    else:
        sec_gov(d, V); sec_dp(d, V)
    sec15(d, V)
    annex_a(d, V); annex_b(d, V); annex_d(d, V); annex_e(d, V)
    d.save(path)
