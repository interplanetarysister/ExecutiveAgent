# Interplanetary Fund Master Brief — Standing Knowledge

**Who this is for:** Michelle Rogers — Executive Agent. This is your
canonical knowledge of Interplanetary Fund: what it is, how it is
built, what it is for, how it sounds, what can be proven about it, and
how to present it truthfully to the people who decide grants,
investments, and partnerships.

**Status vocabulary — use it exactly, everywhere.** Every claim about
iFund sits in one of three states, and you never blur them:

- **Live** — deployed on production and verified there.
- **Merged, not deployed** — code is in the repository's `main`
  branch and tested, but the production site does not run it yet.
- **Planned / goal** — directed or designed, not yet built.

**Companion filings:** This brief is filed into your knowledge base
as six payloads under `executiveagent/docs/ifund-master-brief-payloads/`
(purpose-and-model, construction, goals, branding-and-voice,
proof-points, audience-framing), all `unverified` by design — they
are internally authored knowledge, filed as *reported* under the
honesty rule in `AGENT_KNOWLEDGE_ENTRY.md`, not checked external
sources. The grant process that uses this brief lives in
`GRANT_APPLICATION_PLAYBOOK.md`.

**Sources this brief rests on** (read 2026-11-28): the iFund build
contract (`docs/architecture/IFUND_BUILD_CONTRACT_2026-11-03.md`),
the partner-first hybrid model
(`docs/architecture/PARTNER_FIRST_HYBRID_MODEL_20261114.md`), the
standing owner rules
(`docs/operations/IFUND_STANDING_OWNER_RULES_20261120.md`), the
Creative Studio contract
(`docs/product/IFUND_CREATIVE_STUDIO_AND_PREMIUM_TRIAL_20261122.md`),
and the owner's recorded facts and decisions. Where sources disagree,
the owner's newest explicit decision wins; where this brief is
unsure, it says UNVERIFIED rather than guessing.

---

## (a) What iFund is

**One sentence.** Interplanetary Fund is an AI-powered fundraising
and crowdfunding platform — one cohesive, mobile-first ecosystem
where people create campaigns, tell their stories, raise support, and
get help from a team of AI agents, while established fundraising
hosts remain partners rather than competitors.

**The problem it solves.** Running a fundraiser is skilled work —
writing a story that moves people, producing images and video,
promoting across channels, keeping donors engaged — and most
campaign creators are not marketers. They have a need and a story,
but not the craft, the tools, or the time. Traditional platforms give
them an empty form and a share button. iFund gives them a team: AI
agents that write like professional campaign managers, a creative
studio that produces their media, and guidance that turns a raw
personal need into a public campaign a stranger can understand and
act on.

**Who it serves.**

- **Campaign creators** — individuals and small causes raising money
  for goals of every kind, especially nontechnical users: the
  platform is built to minimise clicks and form complexity, in plain
  language, mobile-first.
- **Donors and supporters** — people discovering campaigns, following
  creators, and giving, with honest presentation: verified figures
  are labelled verified; reported figures are labelled reported.
- **Nonprofit and fundraising hosts** — established organisations and
  platforms whose campaigns creators can link and promote alongside
  first-party iFund campaigns (the partner-first model, below).

**The partner-first hybrid model** (owner decision, 2026-11-14).
iFund is the *operating system for fundraising success* — campaign
creation, growth, distribution, and verified outcome measurement —
not a would-be monopoly donation destination. A campaign may link
verified, owner-scoped fundraisers hosted on outside platforms;
supporters then give **directly at that provider's own checkout**.
iFund never receives outside-platform donations and forwards them,
never takes its first-party withdrawal fee on outside gifts, and
never represents an outside link as an approved partnership — a URL
is not proof of ownership or permission. First-party fundraising on
iFund itself (PayPal-based, fee at withdrawal) continues alongside.
This positioning is a strength with partners and judges alike: iFund
grows the whole ecosystem's results instead of demanding the
ecosystem move.

**What it is not.** Not a nonprofit (it is a for-profit company).
Not a donation custodian for other platforms. Not a promise machine:
its AI Campaign Coach is planning and writing help, and its quality
rubrics explain evidence — they never predict a campaign's success.

## (b) Construction — how it is built, in plain terms

**One canonical product.** The implementation repository is
`interplanetarysister/InterplanetaryFund`; the canonical frontend is
`apps/web` (React/JavaScript, Vite). The original Base44 app is a
read-only behavioural reference — never a deploy source — and older
stacks (Convex, Vercel, `interplanetary-fund-backend`) are retired.

**The stack.**

- **Cloudflare** hosts and runs it: Pages serves the web app;
  Workers run the API, integrations, webhook intake, AI/agent
  orchestration, and scheduled jobs; R2 is the sole durable media
  store (campaign and member media bytes live there, privately).
- **Supabase** (Postgres + Auth + row-level security) is the sole
  durable application record store. Ownership is enforced
  server-side by RLS and verified identity — never by client-side
  checks or email matching.
- **GitHub** is the source of deployable code. Merging, auditing,
  and repairing are standing-authorised; a production build/release
  always needs the owner's explicit go. GitHub Actions is currently
  billing-locked, so releases use the free direct-deploy path.

**The AI agent team.** iFund's member-facing agents work as one team
with shared, owner-scoped context: a conversation with one agent is
team context for the member's other agents, always account-isolated.
The named team (standing owner rules): **NEXUS** coordinates
**STORY** (campaign writing), **ECHO**, **PULSE**, **ORBIT**,
**POLARIS**, **FORGE**, **LINK**, and **DISCOVER**. Two front-door
roles sit on top:

- **REACH** is the single front desk for outreach, connections, and
  growth conversations — one combined chat in front, specialist
  agents behind it.
- **NEXUS as chief of staff** can put into motion anything any agent
  on the site can do, and recommends or refers the member to the
  right specialist.

Agent features are gated honestly: internal AI permission is not
external approval; consequential actions (publishing externally,
payments, outreach sends) need their own verified permissions and
explicit human confirmation — external campaign publishing and
updating always require explicit human confirmation. Deep-research
help ("Refine Knowledge about Your Goal") is a subscriber-tier
capability, verified server-side, never taken from a member's word.

**Creative Studio.** One professional creative workspace inside the
existing product (never a sprawl of new pages): campaign story
writing, AI image generation and enhancement, captions, and — newly
built — AI video generation. A single shared trial allowance governs
AI creation: during the 24-hour signup trial (plus earned 24-hour
referral extensions) a member may create at most **15 AI-generated
items across all creative tools combined**, enforced by a fail-closed
backend ledger — never by browser state. Generated images are
checked after generation so model-baked gibberish lettering never
reaches a member's media; caption wording is AI-drafted and passes a
deterministic nonsense guard before use.

**Payments — state them precisely.** PayPal is the priority payment
integration and the first APIMatic target. Three separations are
absolute: campaign donations, platform-support payments, and saved
payment methods are distinct systems. **Campaign donations remain
disabled until implementation and review are complete**; Bitcoin
functionality remains disabled until fully implemented and
reviewed; the 7% platform fee is taken **only at withdrawal**, from
provider-verified funds, under owner-only controls. Saved payment
methods are token-only via the PayPal vault (token, brand, last 4,
expiry — never raw card numbers in iFund's database).

**Mobile-first.** The product is designed phone-first (particularly
Android), with an independent mobile app expected to use the same
backend and data — one ecosystem, not parallel products.

## (c) Goals — stated as goals, not accomplishments

**Near-term.**

- Ship the parked production release: a run of audited, tested,
  merged work (agent-context repairs, campaign editing restoration,
  the public-facing discretion layer, AI video generation, the
  image-lettering fix) is merged to `main` and waiting on the
  owner's release go — production still runs the previous build.
- Run the **AI video pilot**: Alibaba Model Studio (Wan) free quotas
  behind a swappable provider adapter, usage tracked per model,
  generation failing closed at quota end with **no silent paid
  spillover**. The standing decision after the pilot — paid floor
  vs. off — is the owner's, made with pilot data in hand.
- Serve the **first cohorts of campaign creators** and reach first
  subscriber revenue: until there is regular monthly income there
  can be no regular monthly bill — the free-tier discipline is a
  business rule, not a preference.
- Complete payment implementation and review so campaign donations
  can be enabled deliberately — never by drift.

**Long-term.** One unified fundraising operating system: campaigns,
users, donations, AI agents, admin, and shared data in a single
ecosystem; AI-powered donor matching; human-directed AI campaign
management; official-API connections to external crowdfunding
platforms under delegated, revocable authorisation; and agent
knowledge that is portable — retained with provenance and
permissions independently of any single AI provider.

## (d) Branding & voice

**Names.** The company and product are **Interplanetary Fund**
(short forms: **iFund** / **IFund**). The live product is at
interplanetaryfund.com. The GitHub namespace is
`interplanetarysister`. (Name-collision care: the funder
*IFundWomen* is a different organisation — never imply affiliation.)

**Founder positioning — the facts, stated plainly.** Woman-owned
and woman-developed. Solo founder. Based in Everett, Washington.
A software development student who is also the platform's founder
and developer — she oversees product development, architecture,
infrastructure, integrations, deployments, business development,
and AI agent coordination herself. This is a true and compelling
positioning for women-in-STEM and women-founder audiences; it needs
no embellishment.

**The writing rules — how iFund sounds.**

1. **Professional campaign-manager voice.** Write like the expert
   the member is hiring: fresh, creative, expert wording in plain,
   easy-to-understand, actionable language.
2. **Transform, don't echo.** Never hand the member's own phrasing,
   grammar, or private need back to them as public copy. Their input
   is intelligence; the output is craft.
3. **Psychological influence is the craft** — persuasion that helps
   readers understand a need and choose to act. (The owner's chosen
   terms are "social engineering" / "psychological influence";
   never "donor manipulation.") Influence is never fabrication: no
   invented proof, urgency, scarcity, testimonials, or outcomes.
4. **Public-facing discretion.** What a member needs is private.
   Public copy reframes need as obstacle → change → the reader's
   role. Never plead in the first person ("I need money", "help me
   raise…"), never leak internal objectives ("we need users /
   signups") into public text, never present a personal purchase as
   the campaign's public framing.
5. **Consolidate, don't sprawl.** Features belong in existing pages
   and flows — the product is one ecosystem, and its copy behaves
   the same way: one clear story, not five overlapping ones.

**What "sounds good" means, concretely** — obstacle, change, and
the reader's role, in plain words:

- "Every fundraiser starts with a story worth telling. Interplanetary
  Fund's AI campaign team helps creators tell theirs like
  professionals — so supporters see exactly what their gift makes
  possible."
- "She built the platform she needed: one place where a first-time
  fundraiser gets expert writing, media, and guidance, without
  hiring an agency."
- "Creators keep their audience wherever it already gives —
  Interplanetary Fund links and promotes campaigns across the
  platforms supporters trust, and measures what actually worked."

## (e) Verified proof points

Each point names its source. Anything not listed here is not a proof
point — do not promote it into one.

- **The product is live** at interplanetaryfund.com; the frontend
  and agents serve real guest, member, and admin flows. *(Source:
  owner's recorded live verifications, 2026-11-26/27 — site 200,
  Supabase auth/REST 200 with the live publishable key, payments
  health live; a 45-check verification checklist run 2026-11-27 with
  guest, admin, and owner sections largely PASS.)*
- **Phase 1 video attach-and-play is live infrastructure**: members
  can attach their own uploaded/generated video to posts and play
  it, from private single-copy storage with no public URL minted,
  enforced by a database trigger. Merged via PR #396; both
  migrations applied to production Supabase and verified.
  *(Source: iFund repository, PR #396, main `1670531`.)*
- **A sustained, audited repair programme**: cross-goal agent
  context isolation, allowance idempotency, the account-verification
  gate removal for agent features (live migration verified
  function-by-function), campaign editing restoration, the
  public-facing discretion layer, AI video generation wiring, and
  the image-lettering verification fix — PRs #402–#406, all merged
  to `main` with full test suites green (root 1356/1356, web
  1415/1415 on the final tree). **State precisely: merged and
  tested; NOT yet deployed** — production runs the previous build
  until the owner authorises the release. *(Source: iFund
  repository PRs #402–#406.)*
- **The 60-second Interplanetary Fund reel exists and is verified**:
  exactly 60.0 seconds, 1080×1920 (9:16), voiceover and burned-in
  scene text, ending on interplanetaryfund.com, completed
  2026-11-26. *(Source: owner's production files and verification
  note.)* Present it as a product film — it shows the "one post"
  vision; the one-click post→fundraiser conversion it depicts is
  **planned, not built** (see §g).
- **Hackathon deadlines are real calendar facts, not entries
  won**: #BuildHybridAI 2026 closes Mon 30 Nov 2026, 2:00 PM PT —
  an audit found iFund does **not** currently qualify (no Firebase
  AI Logic in the code) and the founder has not decided the entry.
  Kiroween 2026 submissions close Fri 4 Dec 2026, 2:00 PM PT; the
  entry project is undecided. **Never describe iFund as a
  hackathon entrant, finalist, or winner — UNVERIFIED / not
  established.**
- **The video jobs database is live**: migration `20261128000000`
  applied to production Supabase 2026-11-28 and verified (table
  present, 19 columns, RLS on, browser access revoked). The
  provider wiring it supports is merged-not-deployed, and the
  Alibaba pilot account does not exist yet. *(Source: live audit,
  2026-11-28.)*
- **UNVERIFIED — never state**: user/member counts, donation
  volume, revenue, growth rates, press coverage, partnerships with
  named platforms, testimonials, and any award or selection. None
  are established in the sources; several are known to be zero or
  not-yet (pre-revenue; donations disabled).

## (f) Audience framing — positive, truthful, decision-ready

The frame changes by audience; the facts never do. Lead with what
the decision-maker is actually selecting for, use only §(e) proof
points, and keep the state vocabulary (live / merged-not-deployed /
planned) intact even when it would be easier to blur.

**Grant judges** select for: a real problem, an underserved
founder and audience, a credible plan for *this* money, and
outcomes they can picture being measured. iFund's honest strengths
here are structural: a woman founder-developer in STEM building the
tool herself; creators who are underserved by design-and-marketing
skill gaps; funds mapped to specific costs (infrastructure, AI
service costs, outreach to first cohorts); success defined in
countable terms (campaigns created, creators served, verified
outcomes tracked with labelled provenance).

> *Model paragraph — grant judges.* "Interplanetary Fund is a
> woman-owned, woman-developed fundraising platform built by a solo
> founder in Everett, Washington — a software development student
> who is the company's developer, architect, and operator. The
> platform gives first-time and nontechnical campaign creators the
> professional help fundraising usually requires hiring for: an AI
> campaign team that writes and refines their story, a creative
> studio that produces their images and video, and guidance that
> turns a private need into a public campaign supporters can trust.
> The product is live and pre-revenue; this funding would cover the
> platform infrastructure, AI service costs, and outreach that carry
> it to its first cohorts of creators, with outcomes tracked and
> reported in verified-versus-reported terms from day one."

**Investors** select for: a large, real market; a model that can
earn; a founder who ships; and a believable path from here to
traction. iFund's honest strengths: fundraising is a mass-market
activity with a skill bottleneck the product directly removes; the
model pairs subscription tiers (Creative Studio / premium) with a
withdrawal-fee first-party ledger and partner-first distribution
that does not require winning a platform war; the founder has
shipped a live platform solo and runs a disciplined, audited build
programme. Its honest stage: pre-revenue, pre-traction — say so,
and sell the path (first cohorts → subscriber conversion → verified
outcome data as the moat), never invented traction.

> *Model paragraph — investors.* "Interplanetary Fund is the
> AI-powered operating system for fundraising: creators get a team
> of AI agents — writing, creative studio, growth guidance — inside
> one mobile-first platform, and established hosts stay partners
> through linked campaigns and direct-to-provider giving. Revenue
> comes from premium subscriptions and a 7% fee taken only at
> withdrawal on first-party campaigns. The company is pre-revenue
> by design and by discipline: a solo woman founder-developer has
> built and operates the live platform on free-tier infrastructure
> with zero recurring burn, and the next milestone is first cohorts
> and first subscriber revenue. The ask at this stage is for
> believers in the path: remove the skill bottleneck from
> fundraising, and the platform that does it owns the creator
> relationship."

**Partners** (fundraising hosts, payment and ecosystem providers)
select for: incremental value without channel conflict, clean
compliance posture, and technical seriousness. Lead with the
partner-first guarantees: their checkout, their donors' money never
touches iFund, no fee on outside gifts, capability claims only at
the level actually authorised (public link vs OAuth vs API vs
webhook are separate, labelled states).

> *Model paragraph — partners.* "Interplanetary Fund sends
> supporters to your checkout, not around it. Creators link their
> campaigns on your platform, promote them with AI writing and
> creative tools, and every donation completes on your own
> authorised pages — Interplanetary Fund never custodies
> outside-platform funds and takes no fee on them. What partners
> gain is distribution and measurement: more creators arriving with
> better stories, and source-labelled reporting that distinguishes
> clicks, referrals, and provider-verified gifts. Integrations are
> claimed only at the level actually authorised, and external
> publishing always requires the campaign owner's explicit
> confirmation."

**The public** gets the simple version: what it is, who it helps,
and an invitation — no stage vocabulary, no internal mechanics, and
the discretion rules of §(d) applied without exception.

> *Model paragraph — public.* "Fundraising is hard to do well
> alone. Interplanetary Fund gives every creator a team: AI helpers
> that shape your story, make your images and video, and guide your
> campaign — in one place, built for your phone, by a founder who
> needed it herself."

## (g) Hard honesty rules

These bind every audience, every draft, every filing.

1. **Donations are not live.** Never claim campaign donations are
   enabled, available, or coming on a date. They remain disabled
   until implementation and review complete, on the owner's word.
   The same discipline applies to Bitcoin (disabled) and to saved
   payment methods (built as token-only vault storage; its database
   migration is source-only and NOT applied live — verified
   2026-11-28).
2. **Never invent figures.** No user counts, donation totals,
   revenue, conversion rates, projections presented as results,
   testimonials, endorsements, press, or partnerships. If a number
   is not in §(e) with a source, it does not exist for copy
   purposes. Estimates are labelled estimates; reported figures are
   labelled reported; only provider-verified figures are "verified".
3. **State the build state.** Built ≠ merged ≠ deployed ≠ live.
   The reel's one-click post→fundraiser conversion is planned, not
   built; PRs #402–#406 are merged, not deployed; the video pilot
   is wired, not activated. Saying otherwise in a grant or investor
   document is misrepresentation, not optimism.
4. **Partnerships are claimed at their authorised level only.**
   A linked campaign is not a partnership; an API is not live until
   its integration is verified; PayPal is the priority integration
   *in implementation*, described as such.
5. **The founder's circumstances are hers.** Private needs, internal
   objectives, and platform economics are input intelligence, never
   public copy (§d.4). Fundraising copy for iFund itself follows the
   same discretion rules iFund applies to its members.
6. **When unsure, mark it.** UNVERIFIED is a complete and acceptable
   statement. A flagged gap the owner can fill beats a confident
   error a judge can find.

---

## What only the owner can add

This brief is built from repository and recorded-fact sources. The
following exist only on the owner's side; until she supplies them,
they are gaps — named here, never filled by inference.

**Her ChatGPT-side material.** ChatGPT holds its own accumulated
picture of Interplanetary Fund — custom instructions, saved memory,
project files, and long working conversations (a 45-check
verification checklist was run from that side on 2026-11-27). If the
owner exports and hands over any of it, reconcile it into this
brief and the knowledge base under this rule:

> **Reconciliation rule.** Owner-supplied ChatGPT material is merged
> as **reported** knowledge (filed `unverified`, like everything
> internally authored). Where it conflicts with verified repo or
> live facts, **the verified facts win**, the conflicting item is
> corrected in the brief, and the conflict is flagged to the owner —
> never silently overwritten in either direction. Where ChatGPT
> material adds colour with no repo counterpart (positioning
> language, historical context), it is kept and labelled
> owner-reported.

**Legal facts (names only — values are never stored in this brief,
in knowledge entries, or in any playbook):** legal business name;
legal entity type; EIN; founding/formation date; state of
registration; business address; ownership percentages; business
bank account status. Several routes are gated on these (entity form
gates Alliance of Angels, Y Combinator, and Techstars; founding
date gates some startup-credit tiers) — they are requested through
the grant playbook's owner-supplied-facts checklist when a specific
application needs them.

**Brand assets.** Logo files and their usage rules; the canonical
colour/type tokens as deployed (the product's cosmic design system
is described in the repo's design contract, but the asset files
themselves are owner-held); approved founder photography; the reel
and any future product films as distributable files; social handles
and which accounts are official. Until supplied, describe the brand
from §(d) and link interplanetaryfund.com rather than reproducing
assets.

**Decisions only she can make.** The paid floor after the video
pilot; whether day-pass members are entitled to AI content credits
(open product question); hackathon entry choices; the production
release go. Record her decisions when she makes them — a decision
recorded is knowledge; a decision assumed is an error waiting for
an audience.
