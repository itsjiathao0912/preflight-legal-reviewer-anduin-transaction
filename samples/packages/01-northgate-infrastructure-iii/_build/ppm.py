"""PPM summary of terms (reference document). Fictional text."""
from common import *


def make_ppm(path):
    title = "Northgate Infrastructure Fund III, L.P. — PPM: Summary of Terms"
    d = new_doc(title)
    P = lambda t, **k: para(d, t, **k)
    d.add_heading("Northgate Infrastructure Fund III, L.P.", level=0)
    d.add_heading("Confidential Private Placement Memorandum — Summary of Terms", level=0)
    P("June 2026. Fictional sample document prepared for software testing. The Fund is fictitious and nothing in this document is an offer or a solicitation.", italic=True)
    P("This summary is qualified in its entirety by the Partnership Agreement and the subscription agreement of the Fund. If this summary conflicts with the Partnership Agreement, the Partnership Agreement prevails.")

    h1(d, "1. The Opportunity")
    P("Northgate Infrastructure Fund III, L.P. (the Fund) is a Delaware limited partnership that will invest in essential infrastructure assets in North America and selected markets in Europe and Asia-Pacific. The Fund is the third in a series of closed-end funds managed by Northgate Capital Management, LLC (the Manager), following Northgate Infrastructure Fund II, L.P., which held its first closing in September 2024.")
    P("The Fund targets investments in regulated utilities, contracted renewable generation, transport and logistics assets, digital infrastructure and the midstream sector. The Manager seeks assets with long-term contracted or regulated revenues, inflation protection and the opportunity to create value through operational improvement, expansion and the decarbonization of existing operations.")
    P("The Manager expects the Fund to build a portfolio of twelve to sixteen investments, with a typical equity investment of $40,000,000 to $90,000,000. The Fund may invest alongside co-investors and may use asset-level and fund-level borrowing, subject to the limits described below.")

    h1(d, "2. The Manager and the General Partner")
    P("Northgate Capital Management, LLC, 200 Harborview Drive, Suite 1400, Boston, MA 02110, is the investment manager of the Fund. The general partner of the Fund is Northgate Infrastructure Partners III GP, LLC, a Delaware limited liability company. The Manager is led by Eleanor Voss, Managing Partner, and Daniel Okafor, Chief Investment Officer, who are the key persons of the Fund.")
    P("The Manager has a team of investment professionals with experience in infrastructure investing, project finance, operations and regulation. The Manager has an investment committee that approves each investment, a valuation committee that reviews quarterly valuations, and an environmental, social and governance committee that reviews each investment against the Manager’s policy.")

    h1(d, "3. Summary of Key Terms")
    P("The table below summarizes the principal terms of the offering.")
    table(d, [
        ["Term", "Summary"],
        ["Fund", "Northgate Infrastructure Fund III, L.P., a Delaware limited partnership"],
        ["General Partner", "Northgate Infrastructure Partners III GP, LLC"],
        ["Manager", "Northgate Capital Management, LLC"],
        ["Target size", "$750,000,000"],
        ["Hard cap", "$1,000,000,000"],
        ["Minimum commitment", "$5,000,000, which the General Partner may waive or reduce in its discretion"],
        ["General Partner commitment", "Two percent of aggregate commitments"],
        ["Initial closing", "September 15, 2026"],
        ["Final closing", "Within twelve months after the initial closing"],
        ["Investment period", "Five years after the final closing"],
        ["Term", "Ten years after the final closing, with two one-year extensions"],
        ["Management fee", "1.75 percent of commitments during the investment period; 1.25 percent of net invested capital afterwards"],
        ["Preferred return", "Eight percent per annum, compounded annually"],
        ["Carried interest", "Twenty percent, after a one hundred percent catch-up"],
        ["Distribution method", "Whole-fund (European) waterfall with a clawback"],
        ["Administrator", "Meridale Fund Services Ltd."],
        ["Auditor", "Ashby Kerr LLP"],
        ["Fund counsel", "Hartwell & Crane LLP, New York"],
    ])

    h1(d, "4. Subscriptions and Closings")
    P("Interests are offered only to investors that are accredited investors and Qualified Purchasers. The minimum commitment of each investor is $5,000,000, although the General Partner may accept lower commitments. Investors may subscribe by completing the subscription agreement, including its annexes, and delivering the documents required by the Administrator for anti-money laundering and tax purposes.")
    P("The General Partner expects to hold the initial closing on September 15, 2026, and may hold further closings until the date that is twelve months after the initial closing. An investor admitted at a later closing will contribute the amounts that it would have contributed if it had been admitted at the initial closing, together with interest at the rate stated in the Partnership Agreement, and will bear its share of the management fee from the initial closing.")
    P("Investors in a number of jurisdictions are eligible to subscribe, subject to local law. The General Partner has asked counsel to confirm that the offering may be made to investors in Singapore, and expects that investors there will be admitted on the same terms as other non-United States investors, subject to local securities and tax requirements.")

    h1(d, "5. Fees and Expenses")
    P("The Fund will pay the Manager a management fee, quarterly in advance, at the annual rate of 1.75 percent of aggregate commitments during the five-year investment period and, after the investment period, at the annual rate of 1.25 percent of net invested capital. The fee is reduced by the amount of any transaction, monitoring, directors’ or similar fee that the Manager or its affiliates receive from portfolio companies.")
    P("The Fund bears its organizational expenses up to $3,000,000 and all expenses of its operations, including legal, tax, audit, administration, insurance and due diligence expenses. Investors in different classes may bear different fees and expenses, as described in the Partnership Agreement and in the investor’s subscription agreement.")

    h1(d, "6. Distributions")
    P("Distributions will be made on a whole-fund basis in the following order: first, to all partners until they have received their contributed capital; second, to all partners until they have received a preferred return of eight percent per annum, compounded annually; third, one hundred percent to the General Partner until it has received twenty percent of the sum of the preferred return and the catch-up amounts; and thereafter, eighty percent to the partners and twenty percent to the General Partner.")
    P("If, on the liquidation of the Fund, the General Partner has received more than twenty percent of the Fund’s cumulative profits, it must return the excess, net of taxes, to the Fund. The clawback obligation is guaranteed by the principals of the General Partner and survives dissolution.")

    h1(d, "7. Term and Investment Period")
    P("The term of the Fund is ten years from the final closing, and the General Partner may extend it for two further periods of one year each. The first extension requires the consent of the advisory committee and the second requires the consent of investors holding a majority in interest. The investment period ends on the fifth anniversary of the final closing, and afterwards the Fund may call capital only for follow-on investments, expenses and pre-existing obligations.")

    h1(d, "8. Investment Strategy and Restrictions")
    P("The Fund will not invest more than twenty percent of aggregate commitments in a single investment, more than twenty-five percent in assets outside North America, or more than ten percent in assets that are in construction stage and have no committed offtake. The Fund will not invest in the production of coal or in assets that are subject to comprehensive economic sanctions.")
    P("The Fund may borrow to bridge capital calls, to a maximum of fifteen percent of aggregate commitments and for a period of no more than 180 days for each borrowing. Asset-level debt is not subject to this limit but is reviewed by the investment committee.")

    h1(d, "9. Principal Risk Factors")
    P("An investment in the Fund involves a high degree of risk, and investors could lose all of their investment. The following summary is not complete, and prospective investors should read the full risk factors in the Confidential Private Placement Memorandum.")
    for t in [
        "Illiquidity. Interests have no public market and may not be transferred without the consent of the General Partner. Investors should be prepared to hold their interests for the full term of the Fund.",
        "Construction and operating risk. Infrastructure assets may be affected by construction delay, cost overrun, equipment failure, accidents, and the loss of key contracts or licenses.",
        "Regulatory and political risk. Regulated assets are subject to changes in tariff, concession and permit conditions, and investments outside the United States are subject to political, currency and expropriation risk.",
        "Interest rate and financing risk. The value of investments may fall if interest rates rise or if lenders do not refinance maturing debt on acceptable terms.",
        "Concentration. The Fund will hold a limited number of investments, and the failure of one may have a material effect on the Fund’s returns.",
        "Reliance on key persons. The Fund depends on the services of Eleanor Voss and Daniel Okafor, and the loss of either could affect the Fund’s performance.",
        "Conflicts of interest. The Manager manages other funds that may invest in similar assets, and conflicts may arise in the allocation of investments and of expenses.",
    ]:
        P(t, indent=1)

    h1(d, "10. Investor Eligibility, ERISA and Tax")
    P("Each investor must be an accredited investor and a Qualified Purchaser and must complete the investor questionnaire in the subscription agreement. The General Partner intends to limit the participation of benefit plan investors to less than twenty-five percent of each class of Interests so that the assets of the Fund are not treated as plan assets for the purposes of ERISA. Benefit plan investors must make additional representations that are described in the subscription documents.")
    P("The Fund is expected to be treated as a partnership for United States federal income tax purposes. United States investors will receive a Schedule K-1 for each year. Non-United States investors may be subject to withholding and may be treated as engaged in a United States trade or business through the Fund’s investments in certain assets, and should consult their own advisers. Each investor must deliver the tax form that corresponds to its tax status, as described in the subscription agreement.")

    h1(d, "11. Anti-Money Laundering and Sanctions")
    P("The Administrator, Meridale Fund Services Ltd., performs anti-money laundering and know-your-customer procedures on behalf of the Fund. Each investor must provide the documents that correspond to its type, and an investor whose commitment is $1,000,000 or more must also provide evidence of the source of its funds. The Fund will not admit any investor that is the subject of sanctions or that is located in a comprehensively sanctioned jurisdiction.")

    h1(d, "12. Reports and Governance")
    P("The General Partner will provide audited annual financial statements within 120 days after each fiscal year-end and unaudited quarterly reports within 60 days after each of the first three quarters. An advisory committee of investor representatives will review conflicts of interest and valuations. Investors holding a majority in interest may remove the General Partner for cause, and investors holding seventy-five percent in interest may remove it without cause.")

    h1(d, "13. Side Letters")
    P("The General Partner may enter into side letters with investors that, among other things, address legal, tax or regulatory matters particular to that investor, provide for reporting, and give most favored nation rights. Certain investors, including governmental plans, may receive side letters that address disclosure under public records laws and environmental, social and governance reporting. The General Partner will offer the terms of side letters to investors with commitments equal to or larger than that of the investor that is party to the side letter, as described in the Partnership Agreement.")

    h1(d, "14. Valuation and Co-Investment")
    P("The Manager will value each investment quarterly in accordance with fair value principles, and the valuation committee will review the valuations before they are reported to investors. The auditor will review the valuations as part of its annual audit. The advisory committee will be consulted on any valuation that the Manager proposes to change materially between quarters.")
    P("The Manager may offer co-investment opportunities to investors and to third parties when an investment is larger than the Fund wishes to hold. The Manager allocates co-investment opportunities in its discretion, taking into account the size of each investor’s commitment, its stated interest and any restrictions that apply to it. Co-investors generally bear their own share of the expenses of the transaction, but do not bear the management fee or the carried interest unless they agree to do so.")
    h1(d, "15. Key Person and Suspension Events")
    P("A key person event occurs if Eleanor Voss or Daniel Okafor ceases to devote substantially all of his or her business time to the Fund and to other funds managed by the Manager. After a key person event, the investment period is suspended, and the Fund may not make new investments, other than those that were committed before the event, unless investors holding a majority in interest vote to continue the investment period within 180 days.")
    P("The general partner and the Manager have agreed that no successor fund will begin to make investments until the earlier of the date on which at least seventy-five percent of the Fund’s commitments have been invested, committed or reserved for follow-on investments, and the end of the investment period.")
    h1(d, "16. Legal Matters and Service Providers")
    P("Hartwell & Crane LLP, New York, has acted as counsel to the Fund, the General Partner and the Manager in connection with the offering, and does not represent any investor. Ashby Kerr LLP is the independent auditor of the Fund. Meridale Fund Services Ltd. is the administrator of the Fund and will maintain the books and records, process capital calls and distributions, and perform anti-money laundering and know-your-customer procedures.")
    P("Prospective investors should consult their own legal, tax and financial advisers about the offering. Questions about the offering may be sent to investor.relations@example.com or made by telephone to +1 617 555 0140. This document and the other offering materials are fictional and were prepared only to test software.")
    P("End of summary.", italic=True)
    d.save(path)
