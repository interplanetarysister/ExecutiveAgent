# Mission 1: economics and marketing of capital raising

Research mission run 2026-11-26 by Michelle Rogers Executive. Purpose: give the executive a working
reference for inspiring and negotiating investment, grants and donations toward the $450,000 objective.

Method: five primary pages read directly, no secondary summaries used for anything marked verified. Every
finding is stored in `executive.knowledge` with a verification state and a linked row in
`executive.sources`, and the mission itself is recorded in `public.executive_research`. Anything that was
inferred rather than read is labelled `projected` or `reported` and must not be quoted as fact.

## Sources

| Source | Publisher | Published | What it establishes |
| --- | --- | --- | --- |
| What is Anchoring in Negotiation? | Program on Negotiation, Harvard Law School | 2026-09-29 | Anchoring bias, ZOPA-based rules for first offers, how to defuse a counterparty anchor |
| What is BATNA? | Program on Negotiation, Harvard Law School | 2026-09-30 | Alternatives decide accept, leverage and walk-away; they must be compared on equivalent terms |
| A Guide to Seed Fundraising | Y Combinator | 2016-01-07 | Runway-based ask sizing, dilution bands, SAFE and convertible mechanics, evidence investors need |
| Ten Nonprofit Funding Models | Stanford Social Innovation Review | 2009-03-01 | Donor value versus recipient value, and why large asks must follow existing funding markets |
| The Principles of Persuasion | Influence At Work, Dr. Robert Cialdini | 2016-05-23 | Six principles, learnable, and only durable when applied ethically |

## The ten principles now in the knowledge base

1. **The first number pulls the deal.** Anchoring bias is strong enough that a random number shifts expert
   estimates. Go first only when you know the zone of possible agreement better than the other side. If
   they anchor first, say plainly that the number is unacceptable before you counter, or your counter
   confirms it as in range.
2. **A BATNA is only leverage if it is comparable.** Translate every alternative into the same terms before
   comparing. A cheaper-looking option can be worse once conditions are read.
3. **Raise for a stated runway.** Twelve to eighteen months, tied to a believable plan, with a reduced-scope
   variant ready. The ask is defensible because the plan is.
4. **Watch the dilution band.** Ten percent is excellent, twenty is normal, above twenty-five is a warning.
   Model any instrument against the whole target, not one cheque.
5. **Seed capital is mostly SAFEs and convertible notes.** Terms to understand: cap, discount, interest,
   maturity. Nothing gets signed without owner approval and counsel.
6. **Two businesses, not one.** Program value and funder value are different products with different
   metrics. A single pitch weakens both.
7. **Follow existing funding markets.** As the ask grows, the number of decision makers shrinks and their
   motivations are already set. At $450,000 a small number of committed funders is viable; name the market
   and its established motives rather than appealing broadly.
8. **Persuade ethically or not at all.** Reciprocity, scarcity, authority, consistency, liking, social
   proof. Only real evidence may be used for authority and social proof. Manipulation ends the relationship
   that makes the next ask possible.
9. **Convert dollars into months.** $450,000 over eighteen months is $25,000 per month. A $50,000 grant is
   two months. Pipeline is a coverage ratio, not a total. (Projected from the runway guidance.)
10. **State the evidence class.** Verified, reported, projected, planned. Only cleared receipts increment
    verified received funding. (Internal operating rule.)

## What was not established

The claim that major donor relationships take three to five years to mature appeared in a search result but
was not read in a primary source. It is recorded as an open verification task, not as knowledge. Nothing in
this mission identifies a specific funder, and no funding has been received: verified received capital
remains $0.

## Recording contract

Findings are written through `public.executive_record_finding()`, which validates the verification state and
confidence range, deduplicates the source by URL, writes the knowledge entry and records an audit row in one
transaction. Mission briefs and digests go through `public.executive_record_artifact()`. The console uses the
same path, so browser entries and agent entries land identically.

Verified by test on 2026-11-26 with a disposable member account: valid write returned 200 with ids, a repeat
source URL returned the same source id, an invalid verification state and an out-of-range confidence were
both rejected, and a viewer-role account was refused with a permission error. The test account and every row
it created were deleted afterwards.
