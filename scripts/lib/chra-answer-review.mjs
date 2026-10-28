// Parts 1 and 2 contain questions but no keys. These are authored answers,
// not representations of a printed key. Numbers make pairing independently auditable.
const parse = text => Object.fromEntries(text.trim().split('\n').map(line => {
  const match = line.match(/^(\d+) ([A-E]) (.+)$/)
  if (!match) throw new Error('Malformed CHRA answer review.')
  return [match[1], { letter: match[2], explanation: match[3] }]
}))

export const part1 = parse(`
1 B Statutory benefits establish enforceable minimum entitlements for employees within their legal coverage.
2 C DOLE administers and enforces general Philippine labor standards.
3 B The applicable regional wage order determines the minimum rate and which employees and establishments it covers.
4 C Ordinary-day overtime adds at least 25% of the ordinary hourly rate, giving a total hourly multiplier of 1.25.
5 C Work within eight hours on an ordinary rest day carries a 30% premium, for total pay of 130%.
6 C An eligible covered employee receives the usual daily wage for an unworked regular holiday.
7 D Work within eight hours on a regular holiday is paid at 200% of the daily rate.
8 B The total rate is 130%; the premium above ordinary pay is 30%. The prompt is clarified to ask for total pay.
9 B Covered night work from 10 p.m. to 6 a.m. attracts at least a 10% night differential for each qualifying hour.
10 B The ordinary-day overtime multiplier is 1.25, or 125% of the ordinary hourly wage.
11 A The general minimum is total basic salary earned in the calendar year divided by twelve.
12 C PHP 240,000 divided by 12 equals PHP 20,000.
13 C Covered rank-and-file employees generally qualify after at least one month of work in the calendar year, subject to the applicable exclusions.
14 B The general SIL entitlement is five days after at least one year of service, subject to coverage and exemptions.
15 B SIL has statutory exclusions; qualifying field personnel are an example rather than an exemption for every rank-and-file worker.
16 C RA 11210 generally grants 105 days with full pay for live childbirth, subject to the applicable eligibility and payment rules.
17 C A qualified solo mother receives an additional 15 paid maternity-leave days for live childbirth.
18 C RA 8187 provides seven days of paternity leave for a qualified married employee for the first four deliveries of the cohabiting legitimate spouse.
19 C RA 11861 provides up to seven paid working days annually for eligible solo parents who meet the statutory requirements.
20 C RA 9710 provides up to two months of special leave with full pay following qualifying gynecological surgery, subject to service requirements.
21 C RA 9262 provides up to ten paid leave days in addition to other paid leave, extendible when required by the protection order.
22 B Solo-parent leave requires the employee to satisfy the statutory eligibility conditions; it is not universal leave.
23 C Service charges are distributed in full among covered employees other than managerial employees, with equal shares based on actual hours or days worked under the rules.
24 B Service charges cannot be used to satisfy an employer's obligation to comply with an increased minimum wage.
25 B The usual minimum retirement-pay component is 22.5 days per credited year: 15 days plus five SIL days plus 2.5 days representing one-twelfth of the thirteenth-month pay.
26 D For this retirement computation, at least six months is credited as a whole year.
27 C Separation-pay entitlement and rate depend on the lawful ground and applicable statutory provisions; resignation alone does not create a universal entitlement.
28 B Retrenchment is an authorized-cause ground with statutory conditions and a separation-pay formula based on service.
29 B A covered employee who resigns may receive proportionate thirteenth-month pay for basic salary earned in that year.
30 B Company policy cannot generally remove applicable statutory minimum entitlements.
31 C The general optional retirement age under RA 7641 is 60, with at least five years of service and subject to coverage and applicable plans; compulsory retirement is generally 65.
32 A Redundancy or installation of labor-saving devices generally requires at least one month's pay or one month's pay per year of service, whichever is greater.
33 B The usual minimum for qualifying retrenchment or closure is one month's pay or one-half month's pay per year, whichever is greater.
34 B Separation from employment does not automatically erase earned wages and applicable proportionate statutory benefits.
35 B Ordinary-day overtime uses a 125% total hourly rate.
36 D Regular-holiday work within eight hours uses a 200% rate.
37 C Special non-working-day work within eight hours ordinarily uses a 130% rate.
38 B Work within eight hours on an ordinary rest day uses a 130% rate.
39 A Ordinary-day overtime is the ordinary hourly wage multiplied by 1.25.
40 C Rest-day overtime uses 1.30 times 1.30, or 169% of the ordinary hourly wage.
41 C Regular-holiday overtime uses 2.00 times 1.30, or 260% of the ordinary hourly wage.
42 B Work within eight hours on a special non-working day that is also a rest day uses a 150% rate.
43 C Special non-working-day overtime uses 1.30 times 1.30, or 169%.
44 B The statutory minimum differential for each qualifying night hour is 10%.
45 C A regular holiday that is also a rest day uses 2.00 times 1.30, or 260%, for the first eight hours.
46 D Overtime on a regular holiday that is also a rest day uses 2.60 times 1.30, or 338%.
47 C PHP 100 times 1.25 equals PHP 125 for one ordinary-day overtime hour.
48 D PHP 100 times 2.00 equals PHP 200 for one regular-holiday hour within eight hours.
49 B The additional differential is PHP 100 times 10%, or PHP 10.
50 B The minimum ordinary-day overtime multiplier is 1.25.
51 C PHP 800 times 2.00 equals PHP 1,600.
52 C PHP 800 times 1.30 equals PHP 1,040.
53 C PHP 800 times 1.30 equals PHP 1,040.
54 C PHP 100 times 1.25 times two hours equals PHP 250.
55 C The rest-day overtime multiplier is 1.30 times 1.30, or 1.69.
56 C PHP 100 times 2.00 times 1.30 times two hours equals PHP 520.
57 C A regular holiday on a rest day uses a 260% rate for the first eight hours.
58 C A special non-working day on a rest day uses 1.50 times 1.30, or 195%, for overtime.
59 C PHP 100 times 10% times three qualifying hours equals PHP 30 in additional night differential.
60 B The general private-sector night-differential window is 10 p.m. to 6 a.m.
61 B The minimum differential for covered qualifying night hours is 10%.
62 C Eight ordinary hours give PHP 800; four night hours add PHP 40, giving PHP 840.
63 E DOLE's multiplier for ordinary-day night overtime is 1.25 times 1.10. PHP 100 times 1.25 times 1.10 times two hours equals PHP 275.
64 C Work within eight hours on a special non-working day that is not a rest day uses a 130% rate.
65 D PHP 100 times 1.30 times 1.30 times two hours equals PHP 338.
66 C The total ordinary rest-day rate within eight hours is 130%.
67 C PHP 100 times 1.30 times 1.30 times two hours equals PHP 338.
68 D The total regular-holiday rate within eight hours is 200%.
69 C PHP 100 times 2.60 times 1.30 times two overtime hours equals PHP 676.
70 B A special non-working day on a rest day uses a 150% rate within eight hours.
71 C PHP 800 times 2.60 equals PHP 2,080.
72 B A 25% ordinary-day overtime premium produces a 1.25 multiplier.
73 C Rest-day overtime produces a 1.69 multiplier.
74 C Regular-holiday overtime produces a 2.60 multiplier.
75 B A special non-working day on a rest day produces a 1.95 overtime multiplier.
76 C PHP 800 times 1.50 equals PHP 1,200.
77 C PHP 100 times 1.50 times 1.30 times two hours equals PHP 390.
78 C An eligible employee receives 100% of the usual daily wage for an unworked regular holiday.
79 C PHP 100 times 1.25 times two overtime hours equals PHP 250.
80 C PHP 100 times eight hours times 1.30 equals PHP 1,040.
81 C PHP 100 times eight hours times 1.30 equals PHP 1,040.
82 C PHP 100 times eight hours times 2.00 equals PHP 1,600.
83 A NSD is an additional minimum 10% for covered qualifying night hours; it does not replace overtime pay.
84 E PHP 100 times 1.25 times 1.10 times two hours equals PHP 275 under the official ordinary-day night-overtime formula.
85 B SSS provides social insurance for qualified members under the Social Security Act and its implementing rules.
86 C SSS handles the private-sector EC benefit administration and GSIS handles the public-sector counterpart; ECC is the program's policy-making body.
87 B PhilHealth administers the National Health Insurance Program.
88 A Pag-IBIG combines member savings with access to eligible housing and other loan programs.
89 C Statutory registration and contribution obligations follow the law; an internal regularization date does not displace them.
90 A RA 11210 is the Expanded Maternity Leave Law.
91 B Paternity leave enables a qualified father to support his spouse and family during covered pregnancy-related circumstances.
92 B A qualified solo parent who satisfies the legal eligibility conditions may receive parental leave.
93 B RA 9262 provides the applicable leave for qualified victims attending covered legal or medical matters.
94 B Special leave under RA 9710 concerns qualifying gynecological surgery and requires eligibility; it does not cover every medical condition.
95 A SIL gives eligible employees paid time away from work for rest and personal needs.
96 B Thirteenth-month pay is a statutory benefit for employees within its coverage, subject to applicable exclusions.
97 B A covered employee's resignation does not automatically forfeit the proportionate thirteenth-month benefit earned during the year.
98 C Contributions and remittances must follow the governing program's legal requirements, including the separate employer and employee shares where applicable.
99 A The EC program covers qualifying work-related sickness, injury, disability and death.
100 C HR should investigate the missing registrations and coordinate lawful corrective action rather than wait for a complaint or rely on a waiver.
`)

export const part2 = parse(`
1 B Selecting a relative without evaluating qualified applicants compromises merit and fairness.
2 C A relevant skills assessment tests the job requirement that interview answers alone have not established.
3 A Realistic recruitment information and onboarding clarify duties and schedules before expectations lead to early turnover.
4 D Filling the vacancy with a current employee is internal recruitment.
5 B Selection criteria should assess job requirements rather than unrelated family plans.
6 C Training should address identified HRIS skill gaps before blaming users or abandoning the system.
7 A Transfer of training concerns applying classroom learning in actual work.
8 D A senior employee sharing experience and supporting a junior employee's career is mentoring.
9 B Evaluation should examine learning, application at work and organizational outcomes rather than attendance alone.
10 C The promotion creates a people-management development need that leadership coaching can address.
11 A Giving disproportionate weight to the most recent event is the recency effect.
12 D Central tendency compresses ratings toward the middle instead of distinguishing performance.
13 B A fair initial response clarifies the performance gap and explores causes and support.
14 C A quantified reduction with a three-month deadline is specific, measurable and time-bound.
15 A Performance should include teamwork when collaboration is a genuine requirement of the role.
16 D Objective compensation criteria and applicable law should guide review instead of personal favoritism.
17 B Salary benchmarking compares pay offers with relevant labor-market rates.
18 C A bonus linked to specified performance targets is performance-based variable pay.
19 A Policy, records and employment commitments determine whether the promised incentive is payable.
20 D Retention can improve through development, recognition, flexibility and culture as well as pay.
21 B Discipline requires the applicable lawful basis and procedural safeguards, including notice and an opportunity to respond.
22 C Eligibility decisions require current authoritative rules and the employee's relevant records.
23 A Overtime entitlement depends on actual hours, legal coverage, classification and exemptions.
24 D An impartial complaint process should address confidentiality and retaliation risks instead of protecting a manager from scrutiny.
25 B Payroll records and the cause of the delay must be checked so any underpayment or delay can be corrected.
26 C Maternity benefits must be administered according to legal eligibility and the applicable benefit rules.
27 A Preventable safety hazards require timely correction and compliance with occupational safety obligations.
28 D A threat linked to a good-faith complaint raises a potential retaliation issue.
29 B Herzberg's motivators include meaningful work, achievement, recognition and responsibility.
30 C Instrumentality is the perceived connection between performance and the promised outcome.
31 A Praise that increases the desired behavior illustrates positive reinforcement.
32 D Learning by observing another person illustrates Bandura's social learning approach.
33 B Theory X assumes workers need close control and tend to avoid responsibility.
34 C Inviting participation in decisions is characteristic of democratic leadership.
35 A Explaining the need for change prepares people to move from existing habits, the unfreezing stage.
36 D Equity theory considers perceived fairness of one's contribution-to-reward relationship relative to others.
37 B Workforce planning anticipates future employee numbers and required capabilities.
38 C Turnover patterns should be investigated before attributing blame or selecting a remedy.
39 A Appropriate access controls and safeguards protect employee personal data.
40 D Succession planning develops potential replacements for critical roles.
41 B Strategic HR connects people capabilities and talent initiatives with business objectives.
42 C Satisfaction alone does not establish successful learning transfer or improved work outcomes.
43 A Reliable evidence and employee input help identify causes and design targeted interventions.
44 D An inexperienced team needs clear direction with support adjusted as competence develops.
45 B Performance expectations must be considered alongside the resources and operational barriers affecting delivery.
46 C Balanced incentives reduce the risk that volume targets undermine quality, safety or ethics.
47 A Process mapping and clear ownership address coordination failures across departments.
48 D Structured interviews and consistent job-related scoring improve comparability and reduce arbitrary judgments.
49 B Strong results do not justify selective exemption from workplace rules; facts and fair procedures still matter.
50 C A comprehensive HR approach coordinates planning, development, performance, rewards, relations and compliance.
51 B Advertising, screening, interviewing and selecting candidates are recruitment and selection activities.
52 C Seeking candidates within the existing workforce is internal recruitment.
53 A Asking for an example of actual past behavior is a behavioral interview question.
54 D Predetermined questions and common scoring criteria define a structured interview.
55 B A realistic job preview helps applicants understand what the work actually involves.
56 A The job description sets out duties, responsibilities and reporting relationships.
57 C Orientation to policies, rules and culture is part of onboarding.
58 D A training needs analysis diagnoses the skill or performance gap before choosing training.
59 B Guided performance of real job tasks is on-the-job training.
60 A Transfer requires opportunities and workplace support to apply the learning.
61 C Kirkpatrick Level 2, learning, measures acquired knowledge and skills.
62 D Identifying and preparing future leadership replacements is succession planning.
63 B Focusing on only the latest accomplishment illustrates the recency effect.
64 C Rating almost everyone near the middle illustrates central tendency.
65 D SMART goals are specific, measurable, achievable, relevant and time-bound.
66 C Discussing causes and agreeing on corrective action is a proportionate initial performance response.
67 A Feedback from several stakeholder groups is 360-degree feedback.
68 B Communicating standards in advance gives employees clear expectations and assessment criteria.
69 C Job evaluation compares positions to establish their relative internal value for pay purposes.
70 D Total rewards includes both financial and nonfinancial rewards associated with employment.
71 B Unjustified differences for substantially comparable work raise pay-equity concerns.
72 A Comparing pay with relevant competing employers is salary benchmarking.
73 C Employer-provided health insurance is an indirect financial benefit, unlike direct wages or commissions.
74 D A team incentive connects a shared reward to clear team performance measures.
75 B Impartial listening, documentation and factual assessment provide a fair starting point for a complaint.
76 A A labor union represents workers' collective employment interests.
77 C Collective bargaining concerns negotiations over employment terms between authorized parties.
78 D A fair procedure hears the employee's response and assesses relevant evidence before deciding.
79 B Helping parties reach a workable solution to a work disagreement is conflict resolution.
80 A The Labor Code is the principal private-sector labor-standards and labor-relations framework, alongside amendments and special laws.
81 C Forecasting future staffing needs is human resource planning.
82 D Estimating future staffing numbers and skills is workforce forecasting.
83 B Redeployment and targeted training can address excess staffing in one area and shortages in another.
84 A A job specification lists the qualifications and competencies required of the person doing the job.
85 C Job analysis studies the position's tasks, conditions and required competencies.
86 D Maslow's safety needs include security and protection from physical danger.
87 B Company policies and administration are Herzberg hygiene factors rather than achievement or growth motivators.
88 A Expectancy theory links effort, expected performance and valued outcomes.
89 C Comparing one's rewards and contributions with a coworker's illustrates equity theory.
90 D Democratic leadership encourages participation and ideas.
91 B Enthusiasm and connection to organizational goals reflect employee engagement.
92 A Turnover rate measures departures relative to the relevant workforce over a specified period.
93 C Time to fill tracks the duration needed to fill vacancies.
94 D Early turnover should be investigated using exit evidence, onboarding practices and employee experiences.
95 B Confidential salary data should be disclosed only through authorized procedures with an appropriate basis.
96 A Strategic HR aligns workforce policies and capabilities with longer-term business goals.
97 C An HRIS improves administration and data management; it does not remove the need for judgment or security controls.
98 D Understanding and addressing career, management and reward issues supports retention.
99 B Restructuring requires communication, training and support to help employees adapt.
100 A Recruitment effectiveness should be assessed against meaningful outcome targets rather than activity counts alone.
`)

export const references = {
  laborCode: 'https://blr.dole.gov.ph/2014/12/11/book-iii-conditions-of-employment/',
  payComputations: 'https://nwpc.dole.gov.ph/wp-content/uploads/2024/11/Workers-Statutory-Monetary-Benefits-Handbook-2024-Edition.pdf#page=12',
  maternity: 'https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/2/86567',
  soloParent: 'https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/2/95472',
  paternity: 'https://ldr.senate.gov.ph/sites/default/files/2022-12/Implementing%20Rules%20and%20Regulations%20of%20Republic%20Act%20No.%208187%20for%20the%20Private%20Sector.pdf',
  womensLeave: 'https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/2/26011',
  vawc: 'https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/2/22128',
  retirement: 'https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/2/1680',
  serviceCharges: 'https://dole.gov.ph/news/new-rules-on-service-charge-law-out/',
  privacy: 'https://privacy.gov.ph/data-privacy-act-/',
  trainingEvaluation: 'https://www.kirkpatrickpartners.com/the-kirkpatrick-model/',
  motivation: 'https://openstax.org/books/organizational-behavior/pages/7-3-process-theories-of-motivation',
  socialLearning: 'https://openstax.org/books/organizational-behavior/pages/4-1-basic-models-of-learning',
}
