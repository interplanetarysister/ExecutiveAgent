# Relationship Cultivation — What the Executive Agent Retains

**Purpose.** When the Executive Agent cultivates a relationship with a
potential investor (or another funding relationship) for Interplanetary
Fund, she retains a defined, professional record of that relationship —
enough to pick the thread back up months later, honour every commitment
made, and never ask a contact to repeat themselves. This guide defines
**exactly** what is retained, **where it lives** in the existing
executive schema, and **what is never retained**.

**Companion file.** `relationship-retention-knowledge-payload.json`
(next to this guide) expresses this guide as a ready-to-file
`POST /v1/agent/knowledge` payload (department `relationships`, topic
`investor-cultivation-retention`) — one of the first entries to file
through the autonomous knowledge path at activation, per
`AGENT_KNOWLEDGE_ENTRY.md`.

**Ground rule inherited from the schema:** verified facts are separable
from projections, and **nothing counts as funding until funds are
cleared** (`executive.funding_received` sums only cleared commitments).

---

## 1. The retention map — category by category

### 1.1 Identity & role → `executive.people`

| Retain | Column |
|---|---|
| Full name | `full_name` |
| Job title / role at their fund or firm | `title` |
| Their organization | `organization_id` → `executive.organizations` |
| Professional email | `email` |
| LinkedIn profile URL | `linkedin_url` |
| Relationship stage (see §2) | `relationship_stage` |
| Date of last contact (kept current after every interaction) | `last_contact_at` |
| Standing notes (see §1.7 for what belongs here) | `notes` |

One row per person. If a person changes firms, update `title` /
`organization_id` and note the move (with date) in `notes` — do not
create a second person row.

### 1.2 Organization & fund → `executive.organizations`

| Retain | Column |
|---|---|
| Fund / firm name | `name` (unique) |
| Kind of organization (`investor` \| `vc` \| `foundation` \| `government` \| `corporate` \| `accelerator` \| `partner`) | `org_type` |
| Website | `website` |
| Location / geography focus | `location` |
| Stated investment focus (sectors, themes) | `focus` |
| Fund-level facts: fund size/vintage, decision process, who decides, typical timeline — each with the date learned | `notes` |

### 1.3 Contact channels → `executive.people` + `executive.communications`

Retain the channels the contact themselves uses professionally:
professional email (`people.email`), LinkedIn (`people.linkedin_url`),
and the channel of each actual exchange (`communications.channel`).
A phone number is retained only if the contact gave it for this
relationship, and it goes in `people.notes` labelled as such — there is
no phone column, by design. **Never** retain personal channels (personal
email, personal mobile, home address) — see §4.

### 1.4 How met / who introduced → `executive.people.notes` + first `executive.communications` row

Record, at first contact: the date, the setting (event, platform,
cold outreach), and **who introduced us** (name, or "self-sourced").
File the introduction itself as the first `communications` row
(`direction` = `inbound` for an intro made to us, `outbound` for our
outreach; `summary` names the introducer). Provenance matters later:
introducers are relationships too, and are thanked and updated.

### 1.5 Investment focus & thesis fit → `executive.organizations.focus` + `public.executive_opportunities`

- Their thesis, sectors, stage and geography preferences:
  `organizations.focus` (theirs), expanded in `organizations.notes`
  with dates as preferences are stated or revised.
- The fit with Interplanetary Fund, stated as a judgement (not a fact):
  an opportunity row per concrete possibility —
  `public.executive_opportunities` with `category = 'investment'`
  (or `grant` / `sponsorship` / `partnership` as applicable),
  `organization`, `eligibility` (their criteria as they stated them),
  `source_url` (their fund/criteria page), `notes` (the fit rationale,
  marked as our assessment), `next_action`, and `status` per §2.
- Research behind the fit (their portfolio page, thesis posts, fund
  announcements) is filed as knowledge via the recording path
  (`executive.knowledge` + `executive.sources`, department `finance` or
  `relationships`), never as loose text in a notes field alone.

### 1.6 Typical check size / stage → `public.executive_opportunities` + `executive.funding_commitments`

- Typical range, as stated by them or published by the fund:
  `amount_estimate` on the opportunity (their typical check, labelled
  in `notes` as *typical*, never as promised), `currency`,
  `amount_verified` **only** when a specific amount for *us* is
  confirmed in writing.
- Stage fit (pre-seed / seed / Series A …): `eligibility` on the
  opportunity; fund-level stage focus in `organizations.focus`.
- Once a real amount is in play it moves to
  `executive.funding_commitments` (`counterparty`, `stage`, `amount`,
  `evidence`), and the pipeline view (`executive.funding_pipeline`)
  aggregates it. **An amount is a commitment only in that table, and
  funding only when `funds_cleared = true` with `cleared_at` set.**

### 1.7 Personal-professional context → `executive.people.notes`

Professional facts that make follow-up human and competent, each with
the date learned:

- Stated interests and enthusiasms relevant to the work (e.g. "cares
  about AI safety", "former founder", "collects portfolio companies in
  climate").
- Working preferences the contact expressed: best channel, best days /
  times, "send the deck before any call", "decisions monthly".
- Best contact cadence (e.g. "quarterly update is welcome; more is
  noise") — see §1.9.
- Names of colleagues they route through (their chief of staff,
  partner, analyst) — as people rows if we interact with them,
  otherwise named in `notes`.
- What they asked us for (materials, intros, metrics) — also a task,
  per §1.9.

**Facts only, dated.** Anything inferred is written as an inference
("appears to…", "likely…") — see §4. Nothing about health, family,
politics, religion, or other private life — even if mentioned in
passing — is retained.

### 1.8 Every interaction → `executive.communications` (+ `executive.appointments` for meetings)

One row per interaction, filed the same day:

| Retain | Column |
|---|---|
| Who | `person_id` (+ `organization_id` when org-level) |
| Channel (`email` \| `linkedin` \| `phone` \| `meeting` \| `other`) | `channel` |
| Direction (`outbound` \| `inbound`) | `direction` |
| Subject / title | `subject` |
| Summary: what was discussed, what they said, what we said | `summary` |
| Thread/message identifier where one exists (dedupe key) | `external_id` |
| When it happened | `occurred_at` |

Meetings additionally get an `executive.appointments` row (`title`,
`person_id`, `organization_id`, `starts_at` / `ends_at`, `location` or
`meeting_link`, `agenda` before, `notes` and `outcome` after,
`follow_up_at` for the next step). The `summary` in communications must
capture **commitments made by either side, verbatim where possible**:
what we promised to send/do, what they promised (a look, an intro, a
decision date). Commitments are also tasks — §1.9.

After filing an interaction: update `people.last_contact_at` and, if
the stage moved, `people.relationship_stage` (§2).

### 1.9 Follow-up obligations → `executive.tasks` (+ deadline monitoring)

Every commitment becomes a task the day it is made:

| Retain | Column |
|---|---|
| What is owed, to whom | `title` (name the contact: "Send Q3 metrics to …") |
| Detail: the commitment as made, and the interaction it came from | `detail` |
| Owner (`Michelle Rogers — Executive Agent`, or the owner herself) | `owner_agent` |
| Due date — feeds the deadline monitor and its alerts | `due_at` |
| Priority (1 = highest; time-promised items are 1–2) | `priority` |
| Blocker, if any | `blocked_on` |
| Proof of completion when done (link, message id, date sent) | `evidence` |

Standing cadence obligations (e.g. a promised quarterly update) are a
recurring discipline: when the task completes, the next one is created
in the same action. An opportunity's `next_action` +
`last_checked_at` on `public.executive_opportunities` mirror the
nearest obligation so the Funding view stays truthful.

### 1.10 Decisions → `executive.decisions`

Retain the decisions a relationship produces: our decision to pursue or
pass, their decision and stated rationale, changes of direction.
`decision`, `rationale` (including *their* stated reasons, attributed),
`decided_by`, `status` (`active` / `superseded` / `reversed` — a
changed decision supersedes, never edits history away).

---

## 2. Warmth / status stages

One relationship, two coordinated stage fields. Advance them together,
only on evidence (an interaction), never on hope.

| Stage | Meaning | `people.relationship_stage` | Opportunity / commitment state |
|---|---|---|---|
| **identified** | Named as a potential fit; not yet researched or contacted | `identified` | — |
| *(researched)* | We have done our homework (thesis, portfolio, fit) and are ready to approach | `researched` | Opportunity may be opened: `researching` |
| **introduced** | First contact made (by us or via an introducer) | `contacted` | Opportunity `researching` / `qualified` |
| **cultivating** | Two-way exchange under way; learning their criteria, sharing ours | `engaged` | Opportunity `qualified`; interactions filing regularly |
| **engaged** | Meetings held; concrete interest expressed by them | `meeting` | Opportunity `preparing` / `submitted` |
| **diligence** | They are actively evaluating: materials requested, questions, references | `meeting` (until outcome) | Opportunity `follow_up`; commitment row at `applied` / `verbal` |
| **committed** | They have committed: term sheet / signed, or a dated written commitment | `committed` | Commitment `term_sheet` / `signed`; opportunity `committed`. **Funded only when `funds_cleared`** → opportunity `funded` |
| **declined** | They passed, or we passed | last stage kept, outcome in `notes` + a `decisions` row | Opportunity `rejected` (or `expired` if it lapsed); commitment `withdrawn`; person → `dormant` if the door stays open |

Rules: a stage never advances on a single unanswered outbound message;
`committed` requires something written from them; `declined` records
the stated reason (attributed to them) or our reason (in `decisions`).

---

## 3. Capture checklist — per contact, per interaction

**When a contact is first identified:**
- [ ] Person row: name, title, organization link, professional email,
      LinkedIn.
- [ ] Organization row: type, website, focus, location.
- [ ] How-met note (setting, date, introducer) + first communications
      row.
- [ ] Stage set (`identified`, or `researched` once homework is filed).
- [ ] Fit research filed as knowledge (department `relationships` or
      `finance`) with sources.

**After every interaction (same day):**
- [ ] Communications row filed (channel, direction, summary,
      commitments verbatim).
- [ ] Meeting? Appointments row completed with outcome + follow-up.
- [ ] Every commitment (theirs and ours) is a task with a due date.
- [ ] `last_contact_at` updated; stage advanced if the evidence moved.
- [ ] New facts (check size, criteria, preferences, colleagues) written
      to the right table — dated, attributed, inferences marked.
- [ ] Opportunity `next_action` / `last_checked_at` refreshed.

**Before any follow-up — re-read first:**
- [ ] The person row and its full `notes` (context, cadence, preferences).
- [ ] The last three communications rows — especially the commitments
      in the most recent summary.
- [ ] Open tasks for this contact: anything owed, anything overdue.
- [ ] The opportunity row: status, `next_action`, amounts — typical vs
      verified kept distinct.
- [ ] The organization row: thesis/focus as last stated, and any newer
      knowledge entries filed since (fund announcements, new partners).
- [ ] Any `decisions` rows touching this relationship.

---

## 4. Do-not-retain rules — hard limits

- **No sensitive personal data.** Nothing about health, family,
  children, politics, religion, ethnicity, or private life — even if a
  contact volunteers it socially. The record is a professional file.
- **No credentials or secrets.** No passwords, tokens, API keys, or
  account access details for any person or organization — ever, in any
  field. (Agent keys live only as hashes in `executive.agents` plus the
  Secure Vault.)
- **No financial account details.** No bank details, account numbers,
  or personal financial information. Amounts retained are *funding
  amounts in discussion*, in the opportunities/commitments tables only.
- **No speculation recorded as fact.** Judgements, guesses and reads on
  a person are written as inferences ("appears to prefer…", dated), or
  not written. A later reader must always be able to tell fact from
  inference.
- **No private contact channels** the contact did not give for this
  relationship (personal email/mobile, home address).
- **No verbatim private messages beyond the working summary.**
  Communications rows are summaries with commitments quoted; they are
  not an archive of full message bodies, and nothing marked
  confidential by the contact is expanded beyond the summary needed to
  act on it.
- **No third-party gossip.** Claims about a contact from someone else
  are recorded attributed to their source ("X said …"), or not at all.

---

## 5. Retention hygiene

- **Review cadence:** dormant and cultivating relationships are
  reviewed monthly; a contact with no interaction in 12 months is
  confirmed `dormant` with a dated note rather than silently stale.
- **Corrections:** a contact's correction of any fact is applied the
  same day, and the correction itself is the newest communications
  entry. Wrong data is worse than no data.
- **Single home:** every fact lives in exactly the table this guide
  assigns it. If it is in a notes field, it is because no column exists
  — and it is dated.
