"""LPA definitions and key terms (reference document). Fictional text."""
from common import *


def make_lpa(path):
    title = "Northgate Infrastructure Fund III, L.P. — Partnership Agreement: Definitions and Key Terms"
    d = new_doc(title)
    P = lambda t, **k: para(d, t, **k)
    d.add_heading("Northgate Infrastructure Fund III, L.P.", level=0)
    d.add_heading("Amended and Restated Agreement of Limited Partnership", level=0)
    P("Extract: Article I (Definitions) and key operating articles. Dated as of September 15, 2026. Fictional sample document prepared for software testing; the Fund is fictitious.", italic=True)
    P("This Amended and Restated Agreement of Limited Partnership (this “Agreement”) of Northgate Infrastructure Fund III, L.P., a Delaware limited partnership, is made as of September 15, 2026, by Northgate Infrastructure Partners III GP, LLC, a Delaware limited liability company, as general partner, and the persons admitted as limited partners in accordance with its terms.")

    h1(d, "Article I. Definitions")
    P("Section 1.1 Defined Terms. As used in this Agreement, the following terms have the meanings set out below.")
    defs = [
        ("Affiliate", "with respect to any person, any other person that directly or indirectly controls, is controlled by, or is under common control with that person."),
        ("Benefit Plan Investor", "a “benefit plan investor” within the meaning of Section 3(42) of ERISA, being (a) an employee benefit plan that is subject to Title I of ERISA, (b) a plan to which Section 4975 of the Code applies, and (c) any entity whose underlying assets include plan assets by reason of a plan’s investment in the entity, but excluding governmental plans and non-United States plans that are not subject to such laws."),
        ("Business Day", "any day other than a Saturday, a Sunday or a day on which commercial banks in Boston, Massachusetts or New York, New York are authorized or required to close."),
        ("Capital Commitment", "with respect to a Limited Partner, the aggregate amount that the Limited Partner has agreed to contribute to the Fund, as stated in its Subscription Documents and accepted by the General Partner, as reduced or increased in accordance with this Agreement."),
        ("Capital Contribution", "with respect to a Partner, the amount of cash that the Partner has contributed to the Fund in respect of its Capital Commitment, including amounts withheld or applied under this Agreement on the Partner’s behalf."),
        ("Carried Interest", "the amounts distributable to the General Partner or its designee under Section 5.1(c) and Section 5.1(d), in respect of the Fund’s profits."),
        ("Clawback Amount", "the amount, if any, that the General Partner is required to return to the Fund under Section 5.4."),
        ("Closing Date", "each date on which a Limited Partner is admitted to the Fund or an existing Limited Partner increases its Capital Commitment, the first such date being the Initial Closing Date."),
        ("Code", "the United States Internal Revenue Code of 1986, as amended."),
        ("Defaulting Partner", "a Limited Partner that has failed to make a Capital Contribution when due and has not cured the failure within the period stated in Section 3.4."),
        ("Distribution Waterfall", "the order of distributions set out in Section 5.1."),
        ("ERISA", "the United States Employee Retirement Income Security Act of 1974, as amended."),
        ("Final Closing Date", "the date that is twelve months after the Initial Closing Date, or any earlier date that the General Partner designates by notice to the Limited Partners."),
        ("Fund", "Northgate Infrastructure Fund III, L.P., a Delaware limited partnership."),
        ("General Partner", "Northgate Infrastructure Partners III GP, LLC, a Delaware limited liability company, and any successor general partner admitted in accordance with this Agreement."),
        ("Initial Closing Date", "September 15, 2026, being the date of the first admission of Limited Partners other than the General Partner’s organizational limited partner."),
        ("Interests", "the limited partnership interests in the Fund held by the Limited Partners, as described in this Agreement."),
        ("Investment Period", "the period beginning on the Initial Closing Date and ending on the fifth anniversary of the Final Closing Date, unless terminated earlier under Section 3.6."),
        ("Limited Partner", "each person admitted to the Fund as a limited partner in accordance with this Agreement and not withdrawn or removed."),
        ("Management Fee", "the fee payable by the Fund to the Manager under Section 4.1."),
        ("Manager", "Northgate Capital Management, LLC, a Delaware limited liability company, and any successor investment manager appointed in accordance with this Agreement."),
        ("Most Favored Nation Election", "the right of a Limited Partner to elect the benefit of the terms of a Side Letter, as provided in Section 8.3."),
        ("Net Invested Capital", "the aggregate Capital Contributions used to fund investments that have not been disposed of or written off, reduced by any permanent write-down."),
        ("Partner", "the General Partner or any Limited Partner."),
        ("Plan Assets", "the assets of a Benefit Plan Investor and any assets of the Fund that are treated as the assets of a plan under the plan asset regulation of the United States Department of Labor, as modified by Section 3(42) of ERISA."),
        ("Preferred Return", "with respect to each Partner, an amount that accrues on its unreturned Capital Contributions at the rate of eight percent per annum, compounded annually, from the date each Capital Contribution is made until it is returned."),
        ("Qualified Purchaser", "a “qualified purchaser” as defined in Section 2(a)(51) of the Investment Company Act and the rules under it."),
        ("Side Letter", "a written agreement between the Fund or the General Partner and a Limited Partner that supplements or modifies the terms of this Agreement or of that Limited Partner’s Subscription Documents as they apply to the Limited Partner."),
        ("Subscription Documents", "the subscription agreement and related documents under which a person subscribes for Interests."),
        ("Term", "the period described in Section 9.1."),
        ("Transfer", "any direct or indirect sale, assignment, pledge, hypothecation, gift, exchange or other disposition of all or any part of an Interest or of any right or economic interest in it, whether voluntary or by operation of law."),
        ("Unfunded Commitment", "with respect to a Limited Partner, its Capital Commitment less its Capital Contributions that have not been returned and may be recalled."),
    ]
    for t, b in defs:
        P("“%s” means %s" % (t, b), indent=1)
    P("Section 1.2 Construction. The words “include” and “including” mean including without limitation. References to Articles and Sections are to Articles and Sections of this Agreement. Terms defined in the singular include the plural.")

    h1(d, "Article II. Admission and Capital Commitments")
    h2(d, "Section 2.1 Admission of Limited Partners")
    P("The General Partner may admit additional Limited Partners on any Closing Date up to the Final Closing Date, and may increase the Capital Commitment of an existing Limited Partner, in each case on the terms of this Agreement and the Subscription Documents. The aggregate Capital Commitments of the Limited Partners shall not exceed $1,000,000,000, and the target size of the Fund is $750,000,000.")
    h2(d, "Section 2.2 Minimum Capital Commitment")
    P("The minimum Capital Commitment of a Limited Partner is $5,000,000, which the General Partner may waive or reduce in its discretion. A waiver for one Limited Partner does not require a waiver for any other, and a Limited Partner whose Capital Commitment is below the minimum is not entitled to any right that is conferred only on Limited Partners that meet the minimum.")
    h2(d, "Section 2.3 General Partner Commitment")
    P("The General Partner and its Affiliates shall together make a Capital Commitment equal to two percent of the aggregate Capital Commitments of all Partners. The General Partner may satisfy part of its commitment by a waiver of the Management Fee in accordance with Section 4.3.")
    h2(d, "Section 2.4 Eligibility")
    P("The General Partner shall admit only persons that are accredited investors within the meaning of Regulation D under the Securities Act of 1933 and Qualified Purchasers, or that are otherwise permitted to invest in a manner that will not require the Fund to register under the Investment Company Act of 1940. Each Limited Partner shall make the representations in its Subscription Documents and shall update them if they cease to be accurate.")

    h1(d, "Article III. Capital Contributions")
    h2(d, "Section 3.1 Capital Calls")
    P("The General Partner may call Capital Contributions from the Limited Partners, pro rata in proportion to their Unfunded Commitments, by written notice delivered at least ten Business Days before the date on which the contribution is due. The notice shall state the amount, the purpose and the due date.")
    h2(d, "Section 3.2 Permitted Uses")
    P("Capital Contributions may be called to fund investments, to pay the Management Fee and the expenses of the Fund, to repay borrowings, to satisfy indemnification obligations, and to establish reasonable reserves. During the Investment Period the General Partner may call Capital Contributions for any of those purposes; after the Investment Period it may do so only for follow-on investments, expenses and obligations that arose before the end of the Investment Period.")
    h2(d, "Section 3.3 Subsequent Closings")
    P("A Limited Partner admitted on a Closing Date after the Initial Closing Date shall contribute an amount equal to its share of all Capital Contributions made before its admission, together with interest at the rate of the prime rate plus two percent per annum from the dates on which those contributions were made. Amounts so contributed shall be distributed to the earlier Limited Partners pro rata, and shall be added back to their Unfunded Commitments.")
    h2(d, "Section 3.4 Default")
    P("If a Limited Partner fails to make a Capital Contribution when due and does not cure the failure within five Business Days after notice from the General Partner, it becomes a Defaulting Partner. The General Partner may then, in its discretion, do one or more of the following: charge interest on the overdue amount at the rate of the prime rate plus five percent per annum; prohibit the Defaulting Partner from participating in further investments; reduce its Interest by up to fifty percent; apply distributions to the overdue amount; require it to sell its Interest to other Partners or a third party at a discount of up to fifty percent of fair value; and suspend or forfeit its voting rights.")
    P("A Defaulting Partner remains liable for its Unfunded Commitment, the interest and the costs of enforcement. The other Limited Partners may be required to make additional Capital Contributions, up to the limit of their Unfunded Commitments, to cover the shortfall caused by a Defaulting Partner.")
    h2(d, "Section 3.5 Excuse Rights")
    P("A Limited Partner may be excused from an investment if it delivers a written notice and, if the General Partner requests, an opinion of counsel stating that its participation would violate applicable law or would have a material adverse effect on it. A Limited Partner that is excused remains obligated to fund the rest of its Capital Commitment.")
    h2(d, "Section 3.6 End of the Investment Period")
    P("The Investment Period ends on the fifth anniversary of the Final Closing Date. The General Partner may terminate the Investment Period earlier if it determines that substantially all Capital Commitments have been invested or committed, or on the occurrence of a key person event, as described in the PPM.")

    h1(d, "Article IV. Management Fee and Expenses")
    h2(d, "Section 4.1 Management Fee")
    P("The Fund shall pay the Manager a Management Fee, quarterly in advance. During the Investment Period, the Management Fee is at the annual rate of 1.75 percent of the aggregate Capital Commitments of the Limited Partners. After the Investment Period, the Management Fee is at the annual rate of 1.25 percent of the Net Invested Capital.")
    h2(d, "Section 4.2 Fees Before the Final Closing Date")
    P("The Management Fee for a Limited Partner admitted after the Initial Closing Date is calculated as if the Limited Partner had been admitted on the Initial Closing Date, and the Limited Partner shall pay the fee for the earlier period together with interest under Section 3.3.")
    h2(d, "Section 4.3 Fee Offsets and Waivers")
    P("The Management Fee is reduced by one hundred percent of any transaction, monitoring, directors’ and similar fees that the Manager or its Affiliates receive from portfolio companies and that are not attributable to co-investors. The General Partner may elect to waive part of the Management Fee in exchange for an equivalent Capital Contribution by the General Partner.")
    h2(d, "Section 4.4 Expenses")
    P("The Fund shall bear its organizational expenses up to a cap of $3,000,000, and all expenses of its operations, including legal, tax, audit, administration, insurance, travel and due diligence expenses, and the costs of enforcing its rights. The Manager bears its own overhead, including salaries and rent.")

    h1(d, "Article V. Distributions")
    h2(d, "Section 5.1 Distribution Waterfall")
    P("Distributions of proceeds from investments, other than temporary investments, shall be made on a whole-fund basis, so that all Capital Contributions are returned before any Carried Interest is distributed. The Fund shall distribute proceeds, after the payment of expenses and reserves, in accordance with the Distribution Waterfall, which applies in the following order:")
    P("(a) first, one hundred percent to the Partners, pro rata in proportion to their Capital Contributions, until each Partner has received cumulative distributions equal to its Capital Contributions;", indent=1)
    P("(b) second, one hundred percent to the Partners, pro rata, until each Partner has received its Preferred Return;", indent=1)
    P("(c) third, one hundred percent to the General Partner until the General Partner has received twenty percent of the sum of the Preferred Return distributed under clause (b) and the amounts distributed to the General Partner under this clause (c); and", indent=1)
    P("(d) thereafter, eighty percent to the Partners pro rata and twenty percent to the General Partner.", indent=1)
    h2(d, "Section 5.2 Timing")
    P("The General Partner shall distribute proceeds as soon as practicable after receipt, and in any event within ninety days after the end of the quarter in which the Fund receives them, except that it may retain amounts for expenses, reserves and follow-on investments.")
    h2(d, "Section 5.3 Withholding and Tax Distributions")
    P("The Fund may withhold from any distribution any amount that it is required to withhold under applicable law, and any amount so withheld is treated as distributed to the relevant Partner. The General Partner may make tax distributions to the General Partner in respect of the Carried Interest, which are treated as advances against later distributions.")
    h2(d, "Section 5.4 Clawback")
    P("If, on the liquidation of the Fund, the General Partner has received Carried Interest in an amount greater than twenty percent of the Fund’s cumulative profits, the General Partner shall return the excess, up to the Carried Interest received net of taxes, as the Clawback Amount. The obligation is several, is guaranteed by the principals of the General Partner in proportion to their interests, and survives the dissolution of the Fund.")

    h1(d, "Article VI. Transfers and Withdrawal")
    h2(d, "Section 6.1 Restrictions on Transfer")
    P("A Limited Partner shall not Transfer any Interest without the prior written consent of the General Partner, which the General Partner may withhold in its sole discretion. The transferee shall be a person that satisfies the eligibility requirements of Section 2.4, shall agree in writing to be bound by this Agreement, and shall provide the information and documents that the General Partner requires.")
    h2(d, "Section 6.2 Prohibited Transfers")
    P("No Transfer shall be permitted if it would cause the Fund to be treated as a publicly traded partnership under the Code, to be required to register under the Investment Company Act of 1940, or to hold Plan Assets, or if it would violate any securities law. Any purported Transfer in violation of this Article is void.")
    h2(d, "Section 6.3 Withdrawal")
    P("A Limited Partner may not withdraw from the Fund, except that the General Partner may require the withdrawal of a Limited Partner whose continued participation would cause a violation of law or would cause the Fund to hold Plan Assets, or that is a Defaulting Partner.")

    h1(d, "Article VII. ERISA Matters")
    h2(d, "Section 7.1 Plan Asset Limitation")
    P("The General Partner shall use reasonable efforts to ensure that Benefit Plan Investors hold less than twenty-five percent of the total value of each class of Interests, determined under Section 3(42) of ERISA by disregarding the Interests held by the General Partner, the Manager and their Affiliates, other than Benefit Plan Investors. If Benefit Plan Investors would hold twenty-five percent or more of any class, the General Partner shall take any of the actions described in Section 7.2.")
    h2(d, "Section 7.2 Remedies")
    P("The General Partner may refuse to admit a Benefit Plan Investor, reduce its Capital Commitment, restrict a Transfer to or by a Benefit Plan Investor, or require a Benefit Plan Investor to withdraw, in each case to the extent necessary to prevent the Fund from holding Plan Assets. Alternatively, the General Partner may restructure the Fund so that it qualifies as a venture capital operating company or another exempt vehicle.")
    h2(d, "Section 7.3 Representations")
    P("Each Limited Partner shall notify the General Partner whether it is a Benefit Plan Investor and, if it is, the percentage of its assets that are Plan Assets, and shall notify the General Partner of any change. A Limited Partner that is a Benefit Plan Investor shall make the additional ERISA representations that the General Partner requires.")

    h1(d, "Article VIII. Governance and Investor Rights")
    h2(d, "Section 8.1 Removal and Key Persons")
    P("The General Partner may be removed for cause by Limited Partners holding at least a majority in interest of the Capital Commitments, and without cause by Limited Partners holding at least seventy-five percent in interest. A key person event occurs if Eleanor Voss or Daniel Okafor ceases to devote substantially all of his or her business time to the Fund and the Manager’s other funds, and the Investment Period is then suspended unless the Limited Partners vote to continue it.")
    h2(d, "Section 8.2 Advisory Committee")
    P("The General Partner shall establish an advisory committee of representatives of Limited Partners, which shall review conflicts of interest, valuations and any transaction between the Fund and the General Partner or the Manager or their Affiliates. The committee has no power to manage the Fund.")
    h2(d, "Section 8.3 Side Letters and Most Favored Nation")
    P("The General Partner may enter into a Side Letter with any Limited Partner. The General Partner shall give each Limited Partner whose Capital Commitment is equal to or larger than that of the Limited Partner that is party to the Side Letter a copy of its terms within thirty days after the Final Closing Date, and each such Limited Partner may make a Most Favored Nation Election within thirty days to receive the benefit of the same terms, other than terms that relate to the legal or regulatory status of the Limited Partner, to rights to appoint a member of the advisory committee, or to the particular tax or regulatory needs of the Limited Partner.")
    h2(d, "Section 8.4 Reports and Information")
    P("The General Partner shall provide each Limited Partner with audited annual financial statements within one hundred and twenty days after the end of each fiscal year, unaudited quarterly reports within sixty days after the end of each of the first three quarters, and the tax information that each Limited Partner needs to prepare its tax returns.")

    h1(d, "Article IX. Term and Dissolution")
    h2(d, "Section 9.1 Term")
    P("The Term of the Fund begins on the Initial Closing Date and continues for ten years after the Final Closing Date, unless the Fund is dissolved earlier. The General Partner may extend the Term for up to two successive periods of one year each, the first with the consent of the advisory committee and the second with the consent of Limited Partners holding a majority in interest.")
    h2(d, "Section 9.2 Dissolution and Winding Up")
    P("The Fund is dissolved at the end of the Term, on the removal of the General Partner without the election of a successor, on the written election of Limited Partners holding at least seventy-five percent in interest, or on any event that requires dissolution under Delaware law. The General Partner, or a liquidator that it appoints, shall wind up the affairs of the Fund, sell or distribute its assets, and distribute the proceeds in accordance with Section 5.1.")

    h1(d, "Article X. Liability, Indemnification and General Provisions")
    h2(d, "Section 10.1 Limited Liability of Limited Partners")
    P("Except as required by the Delaware Revised Uniform Limited Partnership Act or by Section 3.4 and Section 5.3, no Limited Partner is liable for the debts, liabilities or obligations of the Fund beyond its Unfunded Commitment. A Limited Partner does not take part in the control of the business of the Fund merely by exercising its rights under this Agreement, serving on the advisory committee, or voting on a matter on which this Agreement permits the Limited Partners to vote.")
    P("If a Limited Partner receives a distribution that is later required to be returned under Delaware law or under Section 5.4, the Limited Partner shall return the distribution to the extent required, but not in excess of the amount of distributions that it has received in the three years before the demand.")
    h2(d, "Section 10.2 Exculpation and Indemnification")
    P("None of the General Partner, the Manager, their Affiliates, or their respective partners, members, officers, directors, employees and agents, nor any member of the advisory committee (each, an “Indemnified Person”), is liable to the Fund or to any Limited Partner for any act or omission in good faith that it reasonably believed to be in the interests of the Fund, except for fraud, bad faith, willful misconduct, gross negligence or a material breach of this Agreement. The Fund shall indemnify each Indemnified Person against losses, claims and expenses, including reasonable legal fees, that arise from the performance of its duties, subject to the same exceptions.")
    P("The Fund shall advance expenses to an Indemnified Person on receipt of an undertaking to repay them if it is later determined that the Indemnified Person is not entitled to indemnification. The indemnification obligations of the Fund are satisfied first from the assets of the Fund and any insurance, and then, to the extent permitted by Section 10.1, from the Unfunded Commitments of the Limited Partners.")
    h2(d, "Section 10.3 Amendments")
    P("This Agreement may be amended by the General Partner with the consent of Limited Partners holding a majority in interest of the Capital Commitments, except that no amendment may increase the Capital Commitment of a Limited Partner, change the Distribution Waterfall in a manner that is adverse to a Limited Partner, or reduce the vote that is required for any matter, without the consent of each Limited Partner that is affected. The General Partner may amend this Agreement without the consent of any Limited Partner to cure an ambiguity, to correct an error, to admit Limited Partners in accordance with its terms, or to comply with law.")
    h2(d, "Section 10.4 Confidentiality and Reports to Public Bodies")
    P("Each Limited Partner shall keep confidential all non-public information about the Fund, the Manager and the investments of the Fund. A Limited Partner that is a governmental plan or other public body may disclose information to the extent that it is required by public records laws, after giving the General Partner notice where permitted, and the General Partner may withhold from that Limited Partner any information that it reasonably believes would be subject to disclosure and would harm the Fund or a portfolio company.")
    h2(d, "Section 10.5 Governing Law")
    P("This Agreement is governed by the laws of the State of Delaware, without regard to conflict of law principles. Each Partner submits to the exclusive jurisdiction of the state and federal courts located in the State of Delaware for any action arising out of this Agreement, and waives any right to a trial by jury in any such action.")
    h2(d, "Section 10.6 Power of Attorney")
    P("Each Limited Partner irrevocably appoints the General Partner as its attorney-in-fact to sign this Agreement, any amendment made in accordance with its terms, any filing required by law, and any instrument that is needed to give effect to an admission, a Transfer, a default or the dissolution of the Fund. The power of attorney is coupled with an interest and survives the incapacity, dissolution or bankruptcy of the Limited Partner and any Transfer of its Interest.")
    P("Executed as of the date written above by the General Partner on its own behalf and on behalf of the Limited Partners under the power of attorney contained in their Subscription Documents.", italic=True)
    d.save(path)
