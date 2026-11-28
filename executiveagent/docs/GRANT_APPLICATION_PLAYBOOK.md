# Grant Application Playbook — Standing Brief

**Who this is for:** Michelle Rogers — Executive Agent. This is your
operating brief for running grant cycles for Interplanetary Fund: how
you find, rank, prepare, and file grant applications, and where your
authority stops.

**Origin:** The owner directed that you learn this process from a live
worked example rather than from theory. The first supervised pass was
run on 2026-11-28 (see §6, the worked example). This brief generalises
that pass into your repeatable process. When a later supervised pass
differs from this brief, the owner's newest explicit instruction wins
and this brief is updated to match.

**Companion filing:** The distilled version of this brief is filed as a
knowledge entry — payload at
`executiveagent/docs/grant-application-knowledge-payload.json`
(department `funding`, topic `grant-applications`, filed unverified by
design: it is internally authored process knowledge, not a checked
external source).

---

## 1. The grant cycle, end to end

Run every cycle in this order. Do not skip steps to save time; the
steps are what make an application submittable without rework.

1. **Research.** Sweep for open opportunities (funder pages, grant
   roundups, the US Chamber small-business grants listing, prior
   cycles' near-misses). Record every candidate with amount, deadline,
   eligibility, fee, and source.
2. **Rank by fit.** Apply the fit rules in §2. Discard or defer
   anything that fails them; note *why* in the opportunity record so a
   later cycle does not re-litigate it.
3. **Verify on the funder's own page.** Deadlines, amounts, fees, and
   eligibility are claims until you have read them on the funder's
   official page (or two independent current roundups agree and say
   they checked the funder page). Anything you could not verify is
   labelled UNVERIFIED in the record — never presented as fact.
4. **Prepare the shared application core** (§3) once per cycle, before
   touching any individual form.
5. **Map each form before filling it** (§4). List every field the form
   asks for, which core element or owner-supplied fact answers it, and
   which fields have no truthful answer yet.
6. **Draft, then stop at the gates.** You may draft and pre-fill.
   You **stop** before any fee payment and before any final submission
   and get the owner's explicit approval for that application (§4).
7. **Submit and record.** After approval and submission, record the
   application the same day (§5): what was filed, when, what it cost,
   what happens next, and the next action with its date.
8. **File the knowledge.** After each cycle, file what you learned
   (new funders, changed deadlines, recurring cadence) via
   `POST /v1/agent/knowledge` under department `funding`, following the
   honesty rule in `AGENT_KNOWLEDGE_ENTRY.md`: deadlines and amounts
   you actually read on a funder page may be `source-checked` with
   that URL; everything else is `unverified`.

## 2. Fit rules — how you rank

Interplanetary Fund's profile, as the owner has set it: woman-owned
and woman-founded, solo founder, an AI-powered fundraising and
crowdfunding platform with a live product, **pre-revenue**,
bootstrapped, no outside capital raised, founder based in Everett,
Washington, and also a software-development student.

Rank highest, in this order:

- **Non-dilutive and free to apply.** Grants before anything that
  takes equity or charges for access.
- **Pre-revenue explicitly welcome.** Idea-stage and pre-revenue
  eligibility stated by the funder outranks a larger prize that
  quietly expects traction or revenue.
- **No recurring costs — ever.** The owner’s standing financial rule:
  nothing that creates a recurring bill. A one-time application fee
  is a flagged exception, not a default (see below).
- **Women-founder fit.** ≥50% women-owned eligibility matches the
  company as constituted; say so plainly where a form asks.
- **Deadline realism.** A grant you can truthfully complete before
  its deadline outranks a bigger one you cannot.

**Fees — flag, never absorb silently.** Record every fee in the
opportunity record before drafting. Note whether a waiver exists and
how to request it (e.g. Amber Grant: waiver on request by email;
IFundWomen: waiver in advance per its rules). A fee is paid only
after the owner approves that application (§4). Watch cumulative
cost: a monthly grant re-entered every month costs its fee twelve
times a year.

**Hard exclusions / deferrals:**

- Revenue, traction, staff-count, or incorporation requirements the
  company does not currently meet → defer, and record the requirement
  and the date to re-check (e.g. entity form gates several investor
  routes; some fellowships require revenue the company does not yet
  have).
- Location-restricted grants outside the company's actual footprint
  (a grant limited to another city's limits does not fit an Everett
  business — check the boundary, not the county name).
- "Grant databases" and pay-to-play listings that charge for access
  to public information.
- Anything whose terms would misdescribe the company (nonprofit-only
  programmes for a for-profit company, and vice versa).

## 3. The shared application core — prepare once, reuse everywhere

Most small-grant forms ask for the same substance in different boxes.
Draft these elements once per cycle, from verified facts only, and
adapt length — never substance — per form.

**Business description.** What Interplanetary Fund is (an AI-powered
fundraising and crowdfunding platform), who it serves (campaign
creators and the causes they raise for), what is live today, and what
stage the company is at (pre-revenue, bootstrapped, solo founder).
Write it in the plain, professional register the owner requires:
transform the founder's input into fresh, expert wording; never pad,
never echo a form's prompt back as the answer.

**Founder bio (skeleton).** Woman founder and developer of
Interplanetary Fund; based in Everett, Washington; software
development student; oversees product development, architecture,
infrastructure, and business development. Fill only from facts the
owner has confirmed — roles, place, and enrolment are confirmed;
anything beyond them (prior employers, years of experience, personal
history) is an owner-supplied fact (§7), not an inference.

**Use-of-funds narrative.** Rules, in order:

1. **Truthful and specific.** Name real, current needs of the
   platform (infrastructure, integrations, accessibility, member
   tooling) and tie the requested amount to them.
2. **No invented figures.** No revenue, user counts, growth rates,
   donation volumes, or projections the owner has not supplied or
   that a live source does not verify. If a form demands a number you
   do not have, that is a §7 gap — stop and ask; do not estimate
   silently.
3. **No fabricated proof.** No invented testimonials, partners,
   press, urgency, or scarcity — in grant copy exactly as in campaign
   copy.
4. **Amounts as itemised fact.** Where a budget breakdown is asked,
   list real cost items plainly. Do not write prose that begs
   ("please help us raise…") — state what the money does.
5. **Private input stays private.** The founder's personal
   circumstances are drafting input, not application copy, unless the
   funder's form explicitly asks for them and the owner approves
   including them.

## 4. Per-application discipline

- **Map before you fill.** For each form: enumerate every field,
  its character/format limits, and its source (core element,
  owner-supplied fact, or unanswerable-yet). A field with no truthful
  source stays blank and goes on the gap list.
- **Never invent.** Entity type, EIN, founding date, revenue, sales,
  employee counts, ownership percentages beyond the confirmed
  women-owned/founded facts, bank details, dates of birth, addresses
  — if it is not confirmed, it is not entered. Guessing a plausible
  value is a firing offence in this office, not a shortcut.
- **STOP gates — owner approval required, every time:**
  - before paying **any** fee (including a "small" one, and including
    re-entry fees in later months);
  - before clicking **final submit** on any application;
  - before signing anything, accepting terms that bind the company,
    or uploading identity/financial documents;
  - before representing the company's entity form, revenue, or
    ownership in a way not already confirmed.
  At each gate, present the owner with: the funder, the amount, the
  fee (or waiver status), the deadline, and the exact answers as they
  will be submitted.
- **One narrative, many forms.** Reuse the §3 core verbatim where
  character limits allow. Consistency across applications is a
  feature: funders compare notes more often than founders expect.
- **Deadlines in the funder's timezone.** Record the deadline with
  its timezone as the funder states it (the November 2026 cluster
  closed 11:59pm **ET**, which is 8:59pm in Everett). Work to the
  earlier, local reading when in doubt.

## 5. Recording — every application, same day

For each opportunity you work, keep a row in
`public.executive_opportunities` current:

- funder and programme name; category `grant`;
- amount (use `amount_verified` only for an amount the funder's own
  page states for this programme; otherwise `amount_estimate`,
  labelled as such);
- status as it moves: identified → researched → drafted →
  awaiting-owner-approval → submitted → awarded / declined / closed;
- **`next_action` always set** — the single next step and its date
  (e.g. "Owner approval to submit", "Re-enter December round",
  "Winner announced ~15 Dec — check result"). An opportunity with no
  next action is a dropped ball;
- fee paid (or waiver requested/granted), submission date, and the
  confirmation reference exactly as the funder issued it — copied,
  never paraphrased.

Related follow-ups (announcement dates, re-entry dates, course
completion deadlines) also become `executive.tasks` with `due_at` so
deadline monitoring catches them.

## 6. The worked example — November 2026 cycle (researched 2026-11-28)

Your first supervised pass, run with the owner on 2026-11-28 from the
funding research of the same date. Treat the figures below as the
researched state of that cycle (index-verified against funder pages
and current roundups during research), not as standing facts —
re-verify every amount, fee, and deadline before any future round.

**The 30 November cluster — all closing Mon 30 Nov 2026, 11:59pm ET:**

| Grant | Amount | Fee | Notes from the example |
|---|---|---|---|
| Amber Grant (WomensNet) — incl. Startup Grant + November STEM Category Grant | 3 × $15,000 this month; monthly winners enter a 3 × $75,000 year-end pool | $15; waiver on request by email | One form enters three grants; November is the STEM category month — the direct fit for an AI platform. Pre-revenue with <$10k sales qualifies for the Startup Grant. Recurs monthly; each re-entry is a new fee decision. |
| Hey Helen Grant (Visionaries) | $10,000/month, unrestricted | $15 | **One application stays on file for 12 monthly rounds** — the best fee efficiency in the set. Requires a US business bank account; pre-revenue eligible; nonprofits ineligible (the company is for-profit, so it fits). Recurs monthly without re-filing. |
| IFundWomen Startup Accelerator Grant | $5,000, unrestricted, no equity | $5; waiver in advance per rules | Idea-stage and pre-revenue explicitly welcome. Winner expected ~15 Dec 2026. (Name note: the funder is *IFundWomen*; the company is *Interplanetary Fund* — no affiliation.) |
| HerRise MicroGrant (HerSuiteSpot) | $1,000/month, 1 winner/month | $15, non-refundable | Smallest prize at the same fee as Amber/Hey Helen — in the example it was filed only because the narrative was already drafted. Recurs monthly, closing the last day of each month. Excludes nonprofits, franchises, consultants. |

**Immediately after — Verizon Small Business Digital Ready Grant:**
$10,000, **free**. Unlock the application by completing any 2 free
Digital Ready courses/events **by 7 Dec 2026**; final decisions by
12 Jan 2027. No revenue, gender, or sector requirement stated.
Taxable (LISC issues a 1099); nonprofits ineligible. Lesson from the
example: start the courses the same week the grant is identified —
the unlock step, not the form, is the schedule risk.

**Cadence this example established:**

- **Monthly:** Amber Grant (re-enter; new fee decision each month),
  HerRise (re-enter; same caution), Hey Helen (already on file —
  verify the entry is live rather than re-applying).
- **Do once, alongside any IFundWomen round:** the free IFundWomen
  Universal Grant Application (one profile matched to rotating
  corporate grants).
- **Free, longer fuse:** Galaxy Grant ($3,500, closes 31 Jan 2027,
  ~30-second form). Women Founders Grant ($5,000, closes 31 Dec 2026,
  $25 fee, for-profit funder — a conscious owner decision, not a
  default).
- **Not a 30-day item:** NSF SBIR/STTR (up to ~$305,000 Phase I) is
  genuine-R&D funding with a Project Pitch process — a Q1-2027
  project, prepared deliberately, never rushed into a monthly cycle.
- **Honest negative from the example:** no currently open general
  Washington-state or Snohomish County grant for a pre-revenue tech
  startup was verified. Do not manufacture local options to fill the
  map; use the free local help (SBDC, Everett Community College
  Small Business Accelerator, NWIRC) instead.

Total fees if every fee in the example were paid: **$50** for the
November cluster ($15 + $15 + $5 + $15), before waivers.

## 7. Facts the owner must supply — checklist (names only)

These are never inferred, estimated, or carried over from a previous
form without re-confirmation. Keep this checklist with the cycle; an
application that needs one of these and lacks it waits.

- [ ] Legal business name (as registered)
- [ ] Legal entity type (e.g. LLC / corporation / sole proprietorship)
- [ ] EIN (employer identification number)
- [ ] Founding / formation date
- [ ] State of registration
- [ ] Business address (as registered)
- [ ] Ownership percentages and owner names as the funder requires
- [ ] Business bank account — exists? institution? (account and
      routing numbers are entered by the owner only, never recorded
      by you)
- [ ] Annual revenue / total sales to date (funder's definition)
- [ ] Employee / contractor count (funder's definition)
- [ ] Founder date of birth (only where a funder requires it)
- [ ] Founder government ID (only where a funder requires it;
      owner-entered, never stored)
- [ ] Business phone and business email for funder correspondence
- [ ] Website and social profiles the funder may review
- [ ] Prior grants, loans, or outside capital received (with dates)
- [ ] Student enrolment status and level (for student-founder
      opportunities)

**Handling rule:** you record *that* a fact was supplied and *when*,
and use it in the application the owner approved. Values from this
checklist — EIN, dates of birth, ID numbers, bank details — are never
written into knowledge entries, opportunity notes, or this playbook.
