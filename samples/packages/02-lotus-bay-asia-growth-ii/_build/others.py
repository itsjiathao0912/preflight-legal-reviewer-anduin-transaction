"""Questionnaire, PPM summary, Sakura side letter and Harbourline W-8 guide generators."""
from common import Doc

FUND = "Lotus Bay Asia Growth Fund II, L.P."
GP = "Lotus Bay GP II Ltd."
MGR = "Lotus Bay Capital Pte. Ltd."
ADMIN = "Harbourline Fund Administration (Cayman) Ltd."


def questionnaire(path):
    d = Doc("Investor Questionnaire (Standalone) – Lotus Bay Asia Growth Fund II, L.P.")
    d.p(FUND.upper(), bold=True, align="center")
    d.p("INVESTOR QUESTIONNAIRE", bold=True, align="center")
    d.p("Standalone form for offshore investors – October 2026", align="center")
    d.h1("Part A. Instructions and Investor Type")
    d.p(f"This questionnaire is delivered to {ADMIN} (the “Administrator”) with the Subscription Agreement for {FUND} (the “Fund”). "
        "It collects the information that the General Partner needs to decide whether an investor is eligible to invest, which tax forms apply and what anti-money laundering checks are required. "
        "Please print clearly, answer every question that applies to you and attach supporting documents where asked.")
    d.p("The questionnaire is divided into Parts. Parts A and G to J apply to every investor. Parts B to E apply according to the type of investor, and Part F applies according to the country of residence. "
        "A table at the end of this Part shows which Parts to complete.")
    d.p("How the answers are used. The Administrator compares the answers with the Subscription Agreement and the documents you attach. An answer that is missing, unclear or inconsistent with another document will delay your admission, because the Administrator must resolve it before the General Partner can accept your subscription. "
        "The General Partner may rely on your answers without further inquiry, and you must tell the Administrator promptly if any answer ceases to be correct before the closing date.")
    d.p("Tick one box to show the type of investor.")
    d.checks(["Individual", "Corporation", "Trust", "Pension", "Insurance Company", "Fund of funds", "Other (describe in the box below)"], title="Type of investor")
    d.table([["Item", "Response"],
             ["Full legal name of investor", "______________________________"],
             ["Country of residence or incorporation", "______________________________"],
             ["If you ticked Other, describe your structure", "______________________________"]], widths=[7.0, 8.5])
    d.table([["If you ticked", "Complete"],
             ["Individual", "Part B, then Part F, then Parts G to J"],
             ["Corporation or Trust", "Part C, then Part F, then Parts G to J"],
             ["Pension or Insurance Company", "Part D, then Part F, then Parts G to J"],
             ["Fund of funds", "Part E, then Part F, then Parts G to J"],
             ["Other", "Part C, then Part F, then Parts G to J, and contact the Administrator before submitting"]], widths=[6.0, 9.5])
    d.p("Investors that are US Persons may not use this questionnaire and should complete the questionnaire in the US Feeder subscription package.")

    d.h1("Part B. Individual Investors")
    d.p("Complete this Part if you ticked Individual in Part A.")
    d.table([["Question", "Response"],
             ["Full name and any former names", "______________________________"],
             ["Date and place of birth", "______________________________"],
             ["Nationality and country of tax residence", "______________________________"],
             ["Residential address (not a post office box)", "______________________________"],
             ["Occupation and name of employer", "______________________________"],
             ["Passport number and country of issue", "______________________________"]], widths=[7.0, 8.5])
    d.table([["Additional question", "Response"],
             ["Do you hold or have you held any public office or senior role in a state-owned company?", "\u2610 Yes   \u2610 No"],
             ["Are you investing for your own account and with your own money?", "\u2610 Yes   \u2610 No"],
             ["Do you act as nominee, trustee or attorney for any other person in making this investment?", "\u2610 Yes   \u2610 No"]], widths=[10.5, 5.0])
    d.p("If you answered No to the second question or Yes to the third, attach the details of the person for whom you act and the authority under which you act. Part G asks about public office in greater detail, and your answers to Part G take precedence over the first question above.")
    d.p("Source of wealth. Tick every box that applies and give a short explanation in the space provided.")
    d.checks(["Salary, bonus or business income", "Sale of a business or shares", "Inheritance or gift", "Investment income or property sales", "Pension or retirement savings"])
    d.p("Explanation: ____________________________________________________________")
    d.p("Please attach a certified copy of your passport and a recent proof of address, such as a utility bill or bank statement dated within the last three months.<<fn:Documents that are not in English should be accompanied by a certified English translation.>>")

    d.h1("Part C. Corporations, Trusts and Other Entities")
    d.p("Complete this Part if you ticked Corporation, Trust or Other in Part A.")
    d.table([["Question", "Response"],
             ["Full legal name and registered number", "______________________________"],
             ["Date and place of incorporation or establishment", "______________________________"],
             ["Registered office address", "______________________________"],
             ["Principal place of business", "______________________________"],
             ["Regulator and licence number, if regulated", "______________________________"],
             ["Is the entity listed on a stock exchange? If so, name the exchange", "______________________________"]], widths=[7.0, 8.5])
    d.h2("Beneficial owners and controlling persons")
    d.p("List each natural person who owns or controls 10% or more of the entity, and each director and authorised signatory.")
    d.table([["Name", "Role", "Percentage held", "Country of residence"], ["", "", "", ""], ["", "", "", ""], ["", "", "", ""]], widths=[5.0, 4.0, 3.0, 3.5])
    d.h2("Additional questions for trusts")
    d.p("If you ticked Trust in Part A, give the name of each trustee, the settlor, the protector and each beneficiary who is entitled to 10% or more of the trust property, and state whether the trust is revocable. "
        "Attach a certified copy of the trust deed or a certificate of trust. If the trustee is a regulated corporate trustee, you may attach evidence of its licence instead of identification documents for its directors.")
    d.h2("Ownership, regulation and sanctions")
    d.table([["Question", "Response"],
             ["Is the entity part of a group? If so, name the ultimate parent", "______________________________"],
             ["Does the entity have bearer shares or nominee shareholders?", "\u2610 Yes   \u2610 No"],
             ["Is the entity, its parent or any beneficial owner located in a country subject to comprehensive sanctions?", "\u2610 Yes   \u2610 No"],
             ["Has the entity, or any of its directors, been the subject of a regulatory enforcement action in the last five years?", "\u2610 Yes   \u2610 No"]], widths=[9.5, 6.0])
    d.p("If you answered Yes to any question in the table, attach a written explanation. An entity with bearer shares or nominee shareholders shall also provide a declaration, signed by an authorised signatory, that identifies the persons who ultimately own the shares. "
        "The Administrator screens the entity, its directors and its beneficial owners against sanctions lists before accepting a subscription and at regular intervals afterwards.")
    d.p("Attach the constitutional documents, a certificate of good standing dated within three months, a list of directors and authorised signatories with specimen signatures, and a board resolution or equivalent authorising the investment.")

    d.h1("Part D. Pension Funds and Insurance Companies")
    d.p("Complete this Part if you ticked Pension or Insurance Company in Part A.")
    d.table([["Question", "Response"],
             ["Name of supervisory authority", "______________________________"],
             ["Licence or registration number", "______________________________"],
             ["Total assets under management (US$)", "______________________________"],
             ["Is the investor subject to statutory limits on alternative investments?", "☐ Yes   ☐ No"],
             ["Is the investor wholly or partly owned by a government or public body?", "☐ Yes   ☐ No"]], widths=[9.0, 6.5])
    d.p("If you answered Yes to the question on statutory limits, state the limit and the percentage of the investor’s assets that this investment represents, and attach any regulatory approval required. "
        "If you answered Yes to the question on public ownership, state the owner and whether the investor is subject to public records or freedom of information laws. "
        "An insurance company shall also state whether the investment will be held in a general account or in a separate account for policyholders.")
    d.p("An investor that is a public institution shall also give the name of the government department or body that supervises it, state whether it is exempt from taxation in its home country, and say whether its governing law restricts the investor from agreeing to the jurisdiction of a foreign court. "
        "If it is so restricted, the investor should say so before signing, so that the General Partner can consider the point with its legal advisers.")
    d.p("Pension funds shall state whether they are a defined benefit or a defined contribution plan, the jurisdiction of the plan and the name of the trustee or governing board.")

    d.h1("Part E. Funds of Funds")
    d.p("Complete this Part if you ticked Fund of funds in Part A.")
    d.table([["Question", "Response"],
             ["Name and jurisdiction of the fund of funds", "______________________________"],
             ["Name of the manager or adviser and its regulator", "______________________________"],
             ["Number of underlying investors", "______________________________"],
             ["Is any underlying investor expected to hold 10% or more of the fund of funds?", "☐ Yes   ☐ No"]], widths=[9.0, 6.5])
    d.p("The Administrator may ask for look-through information on the underlying investors. A fund of funds that is regulated in a FATF member jurisdiction may instead provide a written confirmation from its manager that customer due diligence has been performed on every underlying investor.")

    d.h1("Part F. Professional Investor Tests by Country")
    d.p("Complete the section for your country of residence. The tests below are summaries for the purposes of this questionnaire only. They do not replace the law of the relevant country, and the Fund may ask for further evidence.")
    d.p("Evidence of status. An individual shall attach a recent statement of assets, a bank or custodian letter or a tax assessment. An entity shall attach its latest audited accounts or a certificate signed by an authorised officer. "
        "A regulated institution may attach a copy of its licence. Evidence must be dated within the last three months, or within the last financial year in the case of audited accounts. "
        "An investor that cannot meet any test for its country should not sign the Subscription Agreement.")
    d.h2("Singapore")
    d.p("An investor resident in Singapore must meet one of the following accredited investor tests.")
    d.checks(["Individual: net personal assets exceeding S$2,000,000, of which the value of the primary residence is not counted above S$1,000,000.",
              "Individual: financial assets, net of liabilities, exceeding S$1,000,000.",
              "Individual: income of at least S$300,000 in the last twelve months.",
              "Corporation: net assets exceeding S$10,000,000.",
              "Trust: the trustee is itself an accredited investor and the trust holds assets of at least S$10,000,000.",
              "None of the above applies to me."])
    d.p("If you ticked the last box, you are not eligible to invest and should not continue.")
    d.h2("Hong Kong")
    d.p("An investor resident in Hong Kong must be a professional investor.")
    d.checks(["Individual with a portfolio of at least HK$8,000,000.",
              "Corporation with a portfolio of at least HK$8,000,000 or total assets of at least HK$40,000,000.",
              "Trust corporation entrusted with total assets of at least HK$40,000,000.",
              "Regulated financial institution, insurer, scheme or pension fund within the meaning of the Hong Kong rules.",
              "None of the above applies to me."])
    d.h2("Japan")
    d.p("An investor resident in Japan must be a qualified institutional investor.")
    d.checks(["Financial instruments business operator, bank, insurance company or similar institution.",
              "Pension fund or similar institution with assets of the size the Japanese rules require.",
              "Company that has notified the Japanese authorities that it holds securities of the amount the rules prescribe.",
              "None of the above applies to me."])
    d.h2("Vietnam")
    d.p("An investor resident in Vietnam must be a professional securities investor and must hold the required foreign-investment approval.")
    d.checks(["Securities company, fund management company, bank, insurer or similar licensed institution.",
              "Corporation with equity of at least VND 100,000,000,000.",
              "Individual with a securities portfolio of at least VND 2,000,000,000 and at least two years of experience.",
              "I hold a foreign-investment approval letter and attach a copy.",
              "None of the above applies to me."])
    d.h2("United States")
    d.p("An investor that is a US Person must subscribe through the US Feeder and may not complete this questionnaire. Tick the box below to confirm that you are not a US Person.")
    d.checks(["I am not a US Person and I am not acting for the account or benefit of a US Person."])

    d.h1("Part G. Politically Exposed Persons")
    d.p("Answer every question for the investor, each of its directors and authorised signatories, and each beneficial owner of 10% or more of its equity.")
    d.p("Guidance. A politically exposed person is a natural person who holds or has held a prominent public function in any country, together with the immediate family members and close associates of that person. "
        "The category is not limited to the country in which the investor is resident. The prominent public functions include heads of state and government, senior politicians, senior government, judicial or military officials, senior executives of state-owned corporations, "
        "and important officials of political parties. Middle-ranking and junior officials are not covered. A person remains in the category for at least twelve months after leaving office, and the Administrator may extend that period where the risk justifies it. "
        "Being a politically exposed person does not mean that an investment will be refused, but it does mean that the Administrator will ask for additional information about the source of wealth and the source of funds.")
    d.table([["No.", "Question", "Yes", "No"],
             ["1", "Does any such person hold, or has any such person held in the last twelve months, a prominent public function, such as a head of state, minister, member of parliament, senior judge, senior military officer, ambassador or senior executive of a state-owned enterprise?", "☐", "☐"],
             ["2", "Is any such person an immediate family member of a person described in question 1, including a spouse, parent, child or sibling?", "☐", "☐"],
             ["3", "Is any such person a close associate of a person described in question 1, such as a joint beneficial owner or a business partner?", "☐", "☐"],
             ["4", "If the answer to question 1, 2 or 3 is Yes, give the name, the public function, the country and the dates held, and describe the relationship.", "", ""],
             ["5", "Has any such person been the subject of a criminal investigation, a regulatory sanction or an adverse media report in the last five years?", "☐", "☐"]],
            widths=[1.2, 10.4, 1.6, 1.6])
    d.p("If the answer to question 1, 2 and 3 is No, leave question 4 blank. If the answer to question 5 is Yes, attach a short explanation. The Administrator may require enhanced due diligence for any person identified in this Part.")

    d.h1("Part H. Source of Funds and Tax Information")
    d.table([["Question", "Response"],
             ["Source of the funds to be invested", "______________________________"],
             ["Name of the bank from which funds will be sent", "______________________________"],
             ["Is the bank account held in the investor\u2019s own name?", "\u2610 Yes   \u2610 No"],
             ["Expected date of first payment", "______________________________"]], widths=[9.0, 6.5])
    d.p("If the bank account is not held in the investor\u2019s own name, the Administrator will not accept payment from it unless it has given prior written consent. "
        "The investor should explain in the space below how the funds were generated and, where they come from a sale of assets, the date and the buyer. The Administrator may ask for a bank statement, a sale contract or audited accounts as evidence.")
    d.p("Explanation: ____________________________________________________________")
    d.h2("Tax residence")
    d.p("State every country in which the investor is resident for tax purposes and the tax identification number issued by each country. The Fund uses this information to meet its reporting duties under FATCA and CRS. "
        "The detailed self-certification is a separate annex to the Subscription Agreement and this Part does not replace it.")
    d.table([["Country of tax residence", "Tax identification number", "Tax form to be delivered"],
             ["", "", "\u2610 W-8BEN   \u2610 W-8BEN-E"], ["", "", "\u2610 W-8BEN   \u2610 W-8BEN-E"]], widths=[5.5, 5.5, 4.5])
    d.p("An individual delivers Form W-8BEN. An entity, including a pension fund, an insurer, a trust and a fund of funds, delivers Form W-8BEN-E. The Tax Form Selection Guide issued by the Administrator explains the choice. "
        "The investor shall notify the Administrator within thirty days if its tax residence or tax status changes.")

    d.h1("Part I. Authorised Signatories and Communications")
    d.p("List every person who is authorised to give instructions to the Administrator on behalf of the investor, and the preferred way of communicating with them.")
    d.table([["Name", "Title", "Email", "Telephone", "Specimen signature"],
             ["", "", "", "", ""], ["", "", "", "", ""], ["", "", "", "", ""]], widths=[3.5, 3.0, 4.0, 2.5, 2.5])
    d.p("Preferred language for reports and notices. The Fund sends reports in English. An investor that has agreed a different language in a side letter should state it here so that the Administrator can record it.")
    d.checks(["English only", "English with a translation, as agreed in a side letter"])
    d.p("Delivery of notices. The investor agrees that notices, drawdown notices and reports may be delivered by email and through the Administrator\u2019s investor portal. "
        "The investor will tell the Administrator promptly if a nominated email address ceases to be valid or if a signatory leaves its employment. "
        "The Administrator will act on instructions received from an authorised signatory and will not be liable for acting in good faith on an instruction that appears to be genuine.")
    d.p("The investor acknowledges that personal data about its signatories and connected individuals will be processed in accordance with the privacy notice in the Private Placement Memorandum, and confirms that it has told those individuals about the processing.")

    d.h1("Part J. Declaration")
    d.p("Declaration. I confirm that the information in this questionnaire is true, accurate and complete; that I am authorised to give it on behalf of the investor; and that I will notify the Administrator within ten Business Days of any change. "
        "I consent to the processing of the personal data in this questionnaire in accordance with the privacy notice in the Private Placement Memorandum.")
    d.p("Signature: ______________________   Name: ______________________   Title: ______________   Date: ____________")
    d.save(path)


def ppm(path):
    d = Doc("Private Placement Memorandum – Summary of Principal Terms – Lotus Bay Asia Growth Fund II, L.P.")
    d.p(FUND.upper(), bold=True, align="center")
    d.p("PRIVATE PLACEMENT MEMORANDUM – SUMMARY OF PRINCIPAL TERMS", bold=True, align="center")
    d.p("October 2026. This summary is qualified in its entirety by the full Private Placement Memorandum and the Partnership Agreement.", italic=True, align="center")
    d.h1("Section 1. The Offering")
    d.p(f"{FUND} (the “Fund”) is offering limited partnership interests to eligible investors in Singapore, Hong Kong, Japan and Vietnam, and, through a parallel vehicle, to US investors. "
        "The Fund is a master fund organised as a Cayman Islands exempted limited partnership. The target size of the Fund and its parallel vehicle is US$400,000,000 and the hard cap is US$500,000,000. "
        "The minimum commitment is US$3,000,000, although the General Partner may accept a lower commitment in its discretion. All amounts are denominated in United States dollars.")
    d.p("The initial closing is expected on or about 15 December 2026. Further closings may be held until twelve months after the initial closing. Investors admitted at later closings contribute an equalisation payment so that they are treated as if admitted at the initial closing.")
    d.h1("Section 2. Structure")
    d.p("The Fund invests through a master-feeder-style structure that has three groups of investors.")
    d.table([["Vehicle", "Jurisdiction", "Investors"],
             [FUND, "Cayman Islands exempted limited partnership", "Direct offshore investors subscribing under the offshore subscription agreement"],
             ["Lotus Bay Asia Growth Fund II (US Feeder), L.P.", "Delaware limited partnership", "US taxable and US tax-exempt investors, which may hold through a blocker entity"],
             [GP, "Cayman Islands exempted company", "General partner of the Fund; the Manager advises it"]], widths=[5.5, 4.5, 5.5])
    d.p("The US Feeder invests all of its capital in the Fund, so that every investment is held by the Fund, and the US Feeder and the Fund share investments, expenses and liabilities pro rata to their commitments. "
        "Investors in the US Feeder have no direct rights against the Fund except as provided in the US Feeder’s partnership agreement.")
    d.h1("Section 3. Investment Strategy")
    d.p(f"The Fund, advised by {MGR} (the “Manager”), aims to generate long-term capital appreciation by making growth equity and structured investments in privately held companies in Southeast and East Asia. "
        "The Manager targets companies with enterprise values of between US$50,000,000 and US$500,000,000 that operate in consumer, healthcare, logistics, financial technology and energy transition sectors. "
        "The Fund expects to make between twelve and eighteen investments and to commit no more than 15% of aggregate commitments to a single investment, subject to the exceptions in the Partnership Agreement.")
    d.p("Vietnam, Indonesia, Singapore, the Philippines and Thailand are expected to account for most of the Fund’s investments. The Fund may invest up to 20% of commitments in Japan, South Korea and India. "
        "The Fund does not invest in tobacco, controversial weapons, gambling or thermal coal. The Manager applies an environmental, social and governance policy that is summarised in the full Private Placement Memorandum.")
    d.h1("Section 4. Management and Key Persons")
    d.p(f"The Manager is {MGR}, 8 Marina View, #40-01, Singapore 018960, a capital markets services licence holder in Singapore (licence no. CMS-100777). The principal members of the investment team are:")
    d.table([["Name", "Role", "Responsibility"],
             ["Wei Ling Tan", "Managing Partner", "Chairs the investment committee; leads fundraising and portfolio governance"],
             ["Rahul Iyer", "Partner", "Leads investments in South Asia and Southeast Asia technology sectors"],
             ["Nguyen Minh Chau", "Vietnam Head", "Leads origination and execution in Vietnam; sits on the investment committee"]], widths=[4.0, 4.0, 7.5])
    d.p("The three individuals above are the key persons. A key person event occurs if fewer than two of the key persons are actively involved in the business of the Manager and the Fund. "
        "On a key person event, the investment period is automatically suspended, and investors may vote to reinstate it within 90 days.<<fn:The precise definition is contained in the Partnership Agreement.>>")
    d.h1("Section 5. Fees and Expenses")
    d.p("**Management fee.** The Fund pays the Manager a management fee of 2.0% per annum of aggregate commitments during the investment period of four years from the initial closing. After the investment period, the fee is 1.5% per annum of invested capital. "
        "The fee is payable quarterly in advance. Fees paid to the Manager by portfolio companies are offset against the management fee in the proportion stated in the Partnership Agreement.")
    d.p("**Organisational expenses.** The Fund bears organisational and offering expenses up to US$2,500,000. Any excess is borne by the Manager. The Fund also bears the operating expenses of the Fund, including administration, audit, legal, tax and valuation costs, and costs of unconsummated transactions, subject to the limits described in the Partnership Agreement.")
    d.p("**Placement fees.** The Manager is responsible for any placement fee payable to a third-party placement agent and does not charge it to the Fund.")
    d.h1("Section 6. Distributions and Carried Interest")
    d.p("Distributions are made on an American (deal-by-deal) basis. Proceeds from each realisation are distributed first to the investors until they have received the return of the capital contributed for that investment and for realised losses and write-downs on other investments, together with the fees and expenses allocated to it; "
        "second, to the investors until they have received a preferred return of 8% per annum, compounded annually; third, 100% to the General Partner until it has received 20% of the aggregate of the preferred return and the catch-up; and fourth, 80% to the investors and 20% to the General Partner.")
    d.p("Because the waterfall is applied deal by deal, the General Partner may receive carried interest before investors have received the return of all of their capital. To mitigate that risk, 30% of each carried interest distribution is retained in an escrow account (the carried interest escrow) as security for the General Partner’s clawback obligation. "
        "Amounts in the escrow are released at the end of the Fund or earlier if the conditions in the Partnership Agreement are satisfied. The General Partner is also subject to a clawback obligation, limited to the after-tax amount of carried interest received.")
    d.h1("Section 7. Term")
    d.p("The Fund has a term of ten years from the initial closing, which the General Partner may extend for up to two further periods of one year each with the consent of the advisory committee. The investment period lasts four years from the initial closing and may be suspended or terminated early as described in Section 4. "
        "After the investment period, the Fund may make follow-on investments of up to 15% of commitments.")
    d.h1("Section 8. Subscription Procedure")
    d.p("A prospective investor completes the offshore subscription agreement and its annexes, namely the investor questionnaire, the FATCA and CRS self-certification, the wire instructions and the signature pages, and delivers them to the Administrator with the applicable tax form and the due diligence documents. "
        "Documents must reach the Administrator at least ten business days before the closing date. Capital is called by drawdown notice on ten business days’ notice. An investor that defaults is subject to the remedies in the Partnership Agreement.")
    d.p("The Fund will not accept subscriptions from US Persons directly. US Persons must subscribe through the US Feeder. Investors in Japan must be qualified institutional investors, investors in Hong Kong must be professional investors, and investors in Vietnam must hold the required foreign-investment approval. Investors in Singapore must satisfy the eligibility requirements described in the subscription agreement.")
    d.h1("Section 9. Risk Factors")
    d.p("An investment in the Fund is speculative and involves a high degree of risk. Investors should be able to bear the loss of their entire investment. The principal risks are summarised below, and are described in full in the Private Placement Memorandum.")
    for t, x in [
        ("Illiquidity", "There is no market for the interests, transfers require the consent of the General Partner, and investors have no right to withdraw."),
        ("Emerging markets", "Investments in Vietnam and other emerging markets are exposed to political, currency, legal and regulatory risk, including restrictions on foreign ownership and on the remittance of funds."),
        ("Concentration", "The Fund will hold a limited number of investments, and the failure of one may materially affect returns."),
        ("Key persons", "The Fund depends on the services of the key persons, and the loss of their services may harm performance."),
        ("Deal-by-deal waterfall", "The General Partner may receive carried interest before all capital is returned, and the escrow and clawback may not fully protect investors."),
        ("Conflicts of interest", "The Manager and its Affiliates may manage other funds, and may face conflicts in allocating investments and time."),
        ("Currency", "The Fund is denominated in United States dollars but its investments are made in other currencies, and the Fund does not expect to hedge all exposures."),
        ("Tax", "The tax treatment of the Fund and its investors may change, and investors may be taxed in their home jurisdictions on income that they have not received."),
    ]:
        d.p(f"**{t}.** {x}")
    d.h1("Section 10. Tax Summary")
    d.p("The Cayman Islands currently impose no income, corporation, capital gains or withholding tax on the Fund or on payments to non-resident investors. The Fund has applied for an undertaking from the Cayman Islands government that no such tax will be imposed for fifty years. "
        "Investors are responsible for the tax consequences in their own jurisdictions. The Fund is a reporting financial institution for the purposes of FATCA and CRS, and investors must provide the tax forms and self-certification described in the subscription agreement. "
        "The Administrator publishes a Tax Form Selection Guide that explains which form applies to each category of investor.")
    d.h1("Section 11. Service Providers")
    d.table([["Role", "Provider"],
             ["General Partner", GP],
             ["Manager", MGR],
             ["Administrator", ADMIN],
             ["Auditor", "Pell & Quayside"],
             ["Legal adviser as to Singapore and US law", "Ostrander Pell LLP"],
             ["Legal adviser as to Cayman Islands law", "Calder Reyes"]], widths=[7.0, 8.5])
    d.p("The service providers act only for the Fund, the General Partner and the Manager, and do not act for any investor.")
    d.h1("Section 12. Governance, Valuation and Co-Investment")
    d.p("**Advisory committee.** The General Partner will establish an advisory committee of up to seven representatives of the investors. The committee reviews conflicts of interest, approves valuation methodologies that depart from the Fund\u2019s policy, "
        "and consents to extensions of the term. Members serve without remuneration and are indemnified by the Fund, except in cases of fraud or wilful misconduct. Membership is offered to the largest investors and to others at the General Partner\u2019s discretion.")
    d.p("**Valuation.** The Manager values each investment quarterly at fair value in accordance with the International Private Equity and Venture Capital valuation guidelines and the Fund\u2019s valuation policy. "
        "Valuations are reviewed by the Administrator and, once a year, by the auditor in connection with the audited financial statements. Unrealised valuations do not affect the calculation of carried interest, which is calculated on realisations only.")
    d.p("**Co-investment.** The Manager may offer co-investment opportunities to investors and third parties where an investment exceeds the Fund\u2019s concentration limit. Co-investors bear their share of expenses, and the Manager allocates opportunities fairly, having regard to the size of each investor\u2019s commitment and its ability to respond within the time available. "
        "Co-investments do not carry a management fee or carried interest unless the Manager and the co-investor agree otherwise.")
    d.p("**Borrowing.** The Fund may borrow to bridge capital calls and to fund investments, up to 20% of aggregate commitments, for periods of no more than 180 days. The General Partner may pledge the unfunded commitments of investors as security for such borrowing, and investors agree to provide the confirmations that a lender reasonably requires.")
    d.h1("Section 13. Reports and Communication")
    d.p("The General Partner will send each investor annual audited financial statements within one hundred and twenty days after each year-end, quarterly unaudited reports within sixty days after each quarter-end, and notices of drawdowns and distributions. "
        "Reports are made available in English through the Administrator’s investor portal. An annual meeting of investors is held in Singapore, with remote attendance available.")
    d.p("**Reporting standards.** Quarterly reports contain a schedule of investments, the net asset value of the Fund, the status of capital calls and distributions, and a commentary from the Manager on portfolio developments. The annual report also states the fees and expenses paid by the Fund in the year and the amount held in the carried interest escrow.")
    d.h1("Section 14. Data Protection Notice")
    d.p("The Fund and the General Partner are joint data controllers of the personal data that investors and their connected individuals provide. The data is used to administer the Fund, to comply with anti-money laundering, FATCA, CRS and other legal obligations, and for the legitimate interests of the Fund. "
        "It may be shared with the Manager in Singapore, the Administrator, the auditor, legal advisers, banks and competent authorities, including in jurisdictions outside the Cayman Islands. "
        "Individuals may exercise their rights of access, rectification and objection by writing to the General Partner at investor.relations@lotusbay.example.com.")
    d.h1("Section 15. Important Notices")
    d.p("This summary is provided to a limited number of professional investors for information only and is not an offer to any person in any jurisdiction in which an offer would be unlawful. It has not been reviewed or approved by any securities regulator. "
        "Past performance of the Manager or of its previous funds is not a guide to the future performance of the Fund. Targets, estimates and projections are not guarantees.")
    d.save(path)


def side_letter(path):
    d = Doc("Side Letter – Sakura Kogyo Employees’ Pension Fund – Lotus Bay Asia Growth Fund II, L.P.")
    d.p(f"{GP.upper()}", bold=True, align="center")
    d.p("as General Partner of Lotus Bay Asia Growth Fund II, L.P.", align="center")
    d.p("c/o Lotus Bay Capital Pte. Ltd., 8 Marina View, #40-01, Singapore 018960", align="center")
    d.p("Date: 12 October 2026")
    d.p("Sakura Kogyo Employees’ Pension Fund\nAttention: Chief Investment Officer\nTokyo, Japan (fictional address)")
    d.p("Dear Sirs", )
    d.p("**Re: Lotus Bay Asia Growth Fund II, L.P. (the “Fund”) – Side Letter**")
    d.p("We refer to the subscription agreement signed by Sakura Kogyo Employees’ Pension Fund (the “Investor”) in respect of a commitment of US$40,000,000 to the Fund (the “Subscription Agreement”) and to the Partnership Agreement of the Fund. "
        "This letter (this “Side Letter”) sets out additional terms agreed between the General Partner, on behalf of the Fund, and the Investor. Terms used in this Side Letter and not defined have the meanings given in the Subscription Agreement or, if not defined there, in the Partnership Agreement.")
    d.h1("Section 1. Reports in Japanese")
    d.p("1.1 The General Partner shall procure that the annual audited financial statements, the quarterly reports and each notice of drawdown and distribution that is sent to the Investor are accompanied by a Japanese translation. "
        "The translation shall be delivered no later than thirty days after the English version.")
    d.p("1.2 The translation is provided for convenience. If it conflicts with the English version, the English version prevails, as provided in the Subscription Agreement. "
        "The cost of the translation is an expense of the Fund and is not charged to the Investor separately.")
    d.p("1.3 The General Partner shall also make available to the Investor, in Japanese, a short summary of any material change to the Partnership Agreement that requires the Investor’s consent.")
    d.h1("Section 2. Most Favoured Nation")
    d.p("2.1 If the General Partner or the Fund enters into a Side Letter with another investor that has a Capital Commitment equal to or less than that of the Investor, the General Partner shall give the Investor written notice of the terms of that Side Letter within thirty days after the Closing at which the other investor is admitted, "
        "excluding terms that relate to the legal, tax or regulatory status of the other investor, to its right to appoint a member of the advisory committee, or to a commitment made before the date of this Side Letter.")
    d.p("2.2 The Investor may elect, within thirty days after receiving that notice, to be granted any of the terms notified, and any election must be made as to all of the terms that are linked to the one elected. The General Partner shall then amend this Side Letter to give effect to the election.")
    d.h1("Section 3. Excuse Right")
    d.p("3.1 The Investor may elect not to participate in an investment (and shall be an Excused Investor in respect of it) if the General Partner has notified it of the investment in a Drawdown Notice and either: (a) the Investor has been advised by counsel that its participation would violate a law or regulation that applies to the Investor; "
        "or (b) the investment is in a company that derives more than 10% of its revenue from the production of tobacco, the manufacture of controversial weapons or the mining of thermal coal.")
    d.p("3.2 The Investor shall give notice of its election within five Business Days after receiving the Drawdown Notice, with a short explanation of the grounds. The amount that would have been called from the Investor in respect of that investment shall be reduced and the unfunded portion of its Capital Commitment restored as the Partnership Agreement provides.")
    d.h1("Section 4. Disclosure by the Investor")
    d.p("4.1 The General Partner acknowledges that the Investor is a pension fund that is required by Japanese law to report certain information about its investments to its supervisory authority and to its beneficiaries. The Investor may disclose the following without the General Partner’s consent: the name of the Fund, the amount of its commitment, "
        "its contributions and distributions, and the net asset value of its Interest.")
    d.p("4.2 All other Confidential Information remains subject to the confidentiality undertakings in the Subscription Agreement.")
    d.h1("Section 5. General")
    d.p("5.1 This Side Letter forms part of the agreement between the Investor and the Fund. If it conflicts with the Subscription Agreement or the Partnership Agreement, this Side Letter prevails as between the Investor and the Fund.")
    d.p("5.2 The Investor has delivered a Form W-8BEN-E, a completed FATCA and CRS self-certification and the identification documents requested by the Administrator. Nothing in this Side Letter limits the Investor’s obligations under those documents.")
    d.p("5.3 This Side Letter is governed by the laws of the Cayman Islands, and Section 14 of the Subscription Agreement applies to it as if it were set out in full.")
    d.p("5.4 The Investor shall keep the terms of this Side Letter confidential, except as required by law and except for disclosure to its directors, employees, auditors and professional advisers.")
    d.p("5.5 This Side Letter may be amended only by a written instrument signed by the General Partner and the Investor. A failure or delay in exercising a right under it is not a waiver of that right.")
    d.p("5.6 This Side Letter may be signed in counterparts and by electronic signature, each of which is an original, and all of which together constitute one instrument. The Investor shall not assign its rights under this Side Letter except to a transferee that is admitted to the Fund in accordance with the Subscription Agreement and to which the General Partner has agreed in writing that the benefit of this Side Letter will pass.")
    d.p("Please confirm your agreement to the above by signing and returning a copy of this letter.")
    d.p("Yours faithfully")
    d.p(f"For and on behalf of {GP}, as General Partner of the Fund")
    d.p("______________________________   Authorised signatory")
    d.p("We agree to the terms of this Side Letter.")
    d.p("For and on behalf of Sakura Kogyo Employees’ Pension Fund")
    d.p("______________________________   Authorised signatory")
    d.save(path)


def w8_guide(path):
    d = Doc("Tax Form Selection Guide for Non-US Investors – Harbourline Fund Administration (Cayman) Ltd.")
    d.p(ADMIN.upper(), bold=True, align="center")
    d.p("TAX FORM SELECTION GUIDE FOR NON-US INVESTORS", bold=True, align="center")
    d.p("Lotus Bay Asia Growth Fund II, L.P. – October 2026", align="center")
    d.h1("Section 1. Purpose of this Guide")
    d.p("This guide explains which US Internal Revenue Service form each category of investor in Lotus Bay Asia Growth Fund II, L.P. (the “Fund”) should deliver to the Administrator. "
        "The Administrator reviews each form for completeness and consistency with the investor’s subscription documents, but does not check the substance of a form and does not give tax advice. "
        "Each investor should consult its own tax adviser before signing a form.")
    d.h1("Section 2. Which Form Applies")
    d.table([["Category of investor", "Form", "Notes"],
             ["Individual that is not a US citizen or resident", "Form W-8BEN", "Provide the foreign tax identification number and, if claiming a treaty benefit, the country and the article."],
             ["Entity (company, partnership, trust, pension fund, insurer) that is organised outside the United States", "Form W-8BEN-E", "Complete the chapter 3 status, the chapter 4 (FATCA) status and, if claiming a treaty benefit, the limitation on benefits section."],
             ["Foreign government, central bank or international organisation", "Form W-8EXP", "Used instead of Form W-8BEN-E where the entity claims exempt status."],
             ["Entity that receives payments on behalf of others (an intermediary)", "Form W-8IMY", "Attach the withholding statement and the forms of the underlying investors."],
             ["US citizen, US resident or US-organised entity that invests through the US Feeder", "Form W-9", "Delivered with the US Feeder subscription package and not with the offshore subscription agreement."]],
            widths=[6.0, 3.0, 6.5])
    d.h1("Section 3. Completing the Forms")
    d.h2("Form W-8BEN (individuals)")
    d.p("An individual must give his or her name, country of citizenship, permanent residence address (not a post office box), date of birth and foreign tax identification number. An individual who claims treaty benefits must state the treaty country and article. "
        "The form must be signed and dated. A form that is undated, or that is signed by someone other than the individual without proper authority, will be returned.")
    d.h2("Form W-8BEN-E (entities)")
    d.p("An entity must state its country of organisation, its chapter 3 status, its chapter 4 status, its permanent residence address and its taxpayer identification number. "
        "Pension funds and insurers should take particular care with Part III and Part IV, which deal with treaty claims and with the entity’s FATCA classification. The classification chosen on the form must match the classification ticked in Annex B of the Subscription Agreement. "
        "If an entity ticks a passive status in Annex B, it must provide the controlling person information in Annex B as well as on the form.")
    d.h2("Form W-9 (US investors)")
    d.p("US investors do not use the offshore subscription agreement. They deliver a Form W-9 together with the US Feeder subscription documents. A US tax-exempt investor should also indicate whether it elects to invest through a blocker entity.")
    d.h1("Section 4. Validity and Updates")
    d.p("A Form W-8 is generally valid until the last day of the third calendar year after the year in which it is signed, unless a change in circumstances makes it incorrect sooner. "
        "An investor must deliver a new form within thirty days after becoming aware that any information on its current form has become incorrect. A Form W-9 remains valid until the information on it changes.")
    d.p("The Administrator will request a new form before the old one expires. If a valid form is not on file when a payment is made, the Fund may be required to withhold at the rate of thirty per cent.")
    d.h1("Section 5. Worked Classification for the Current Investors")
    d.p("The table below shows the form that the Administrator expects for each investor in the first closing. It is for information only.")
    d.table([["Investor", "Type", "Country", "Expected form", "Comment"],
             ["Mekong Pearl Life Insurance JSC", "Insurer", "Vietnam", "Form W-8BEN-E", "CRS self-certification; foreign-investment approval letter also required"],
             ["Sakura Kogyo Employees’ Pension Fund", "Pension", "Japan", "Form W-8BEN-E", "Treaty claim to be confirmed by the investor’s tax adviser"],
             ["Arun Mehta", "Individual", "Singapore", "Form W-8BEN", "Individual accredited investor"],
             ["Banyan Lane Trustees Ltd. as trustee of the Chen Family Trust", "Trust", "Hong Kong", "Form W-8BEN-E", "The trustee signs for the trust; controlling persons to be listed"],
             ["Cascade Ridge University Endowment", "US tax-exempt", "United States", "Form W-9", "Invests through the US Feeder; blocker election recorded"]],
            widths=[4.2, 2.2, 2.4, 2.6, 4.1])
    d.h1("Section 6. Common Mistakes")
    for x in ["Using Form W-8BEN for an entity, or Form W-8BEN-E for an individual.",
              "Leaving the date or the signature blank, or signing with a stamp.",
              "Giving a post office box or a care-of address as the permanent residence address.",
              "Ticking a different FATCA classification on the form and in Annex B.",
              "Claiming treaty benefits without stating the article or without a foreign tax identification number.",
              "Delivering an expired form, or a form signed more than three years ago."]:
        d.p("• " + x, indent=0.8)
    d.h1("Section 7. Delivery and Timing")
    d.p("Forms should be delivered to the Administrator in the same package as the signature pages, at least ten business days before the closing date. Scanned copies are accepted if the signature is legible. "
        "The original need not be sent unless the Administrator asks for it. A form delivered after the closing date delays the investor\u2019s admission until it has been reviewed and accepted.")
    d.p("The Administrator keeps the forms for at least seven years after the investor ceases to hold an interest, and may be required to disclose them to the US tax authority or to the Cayman Islands tax authority. "
        "By delivering a form, the investor agrees to that retention and disclosure.")
    d.h1("Section 8. Treaty Claims at a Glance")
    d.p("An investor that is resident in a country that has a tax treaty with the United States may be able to claim a reduced rate on certain US-source income. Whether a claim is available depends on the facts, including the investor\u2019s legal form, its ownership and the nature of the income. "
        "The Administrator does not advise whether a claim should be made. An entity that claims treaty benefits must complete the limitation on benefits section of Form W-8BEN-E and provide its foreign tax identification number. "
        "A pension fund or an insurer that claims exempt status should have the supporting documents available on request.")
    d.h1("Section 9. Contact")
    d.p("Questions about this guide may be sent to lb2-investors@harbourline.example.com or by telephone to +65 6555 0143. The Administrator does not answer questions about the tax consequences of an investment.")
    d.save(path)
