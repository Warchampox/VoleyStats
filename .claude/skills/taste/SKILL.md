---
name: taste
description: Domain-grounded judgment for making things — code, documents, UI, charts, plans, messages — and for critiquing them. Use when the user asks for taste, judgment, or polish ("make this good", "tighten this", "this feels off", "this feels generated"), when a deliverable is externally visible or high-stakes, when the brief is thin and the pull is to fill gaps with plausible defaults, or when asked to evaluate or compare work. Not for verbatim transformation or exhaustive extraction.
metadata:
  author: Hunter Bown
  version: "1.0.0"
  style: instruction-only
  compatibility: Agent Skills compatible clients (Claude Code, Codex, Copilot, Gemini CLI, and others)
---

# Taste

Taste is doing what the practitioner would do here instead of what the default produces. You already have the judgment. This skill is about the three places it still fails to get applied: grounding from memory when the real thing is available, inventing specifics to fill a thin brief, and producing more than the occasion warrants.

Two modes share one grounding step. **Create**: you are producing the work. **Critique**: you are judging work, yours or someone else's.

## Ground: three facts before you make anything

Establish these first. Put them in the reply when the user should see them; otherwise keep them to yourself.

1. **The job.** One sentence: what this artifact must cause to happen, for whom. "Get the CTO to approve the plan in five minutes." "Let an accountant decide in thirty seconds whether to start the trial." An outcome, not a topic.
2. **What the reader already knows.** Anything they know, you do not explain. Anything they would have to verify, you do not invent.
3. **The exemplar.** The specific thing a practitioner would hold this up against. If it exists — neighboring code, the existing page, the last memo of this genre, the design tokens, the data itself — **open it before writing**. Recall is not grounding when the real thing is one tool call away. If no exemplar exists, name the genre and its conventions in a sentence and proceed.

If you know the domain cold, grounding takes thirty seconds. If you don't, it is most of the work; a grounded first draft beats a polished third.

## Create

**Shape follows the job.** Choose the form from the job and the exemplar: prose or list, table or chart, one function or a module, one screen or a flow. The default shape — header, bullets, summary; hero, three cards, CTA; class, config, logger — is what appears when the shape wasn't chosen.

**Rank, then allocate.** Order the content by how much it moves the job. The top item gets the first position and the most space. Everything past the reader's attention gets compressed or cut. Equal treatment of unequal things is the most reliable tell of generated work.

**Specifics come from the source.** When the brief is thin, the pull is to fill it with plausible detail — features, prices, numbers, names, policies, API shapes — and it reads as grounded because it is specific. It is worse than a visible gap, because the reader cannot tell it is made up.
- If the specific is in the source (brief, code, data, the exemplar you opened): use it exactly.
- If it isn't: design around the gap, leave an honest placeholder (`[confirm: pricing tiers]`), or ask. When you must assume, collect every assumption in one place the user will see.
- Numbers you computed are fine. Numbers you would expect are not.

**Commit.** One recommendation, one design, one implementation, plus the single condition that would flip it. Alternatives belong in a critique, not a deliverable, unless the job is a decision document.

**Stop at the finish the stakes warrant.** A chat reply, a script run by hand, and a public page take different finish. Would the reader notice the next hour of work? If not, ship. Over-finishing and unrequested scope are taste failures in the same way padding is.

## Before delivering

Read it once, fast, as the reader. Then check the four things that survive competence:

| Check | If yes |
|---|---|
| Is anything here that the reader would have to verify because I made it up? | Source it, mark it, or cut it. |
| Would the exemplar be this long? | Cut from the bottom of the ranking. |
| Is any element here because the template has one — date block, intro, FAQ, feature grid, "next steps", closing summary? | Cut unless the job needs it. |
| Would a practitioner spot a tell in ten seconds — stale comment, wrong register, decorative element, hedge, a claim that outran the evidence? | Fix that one thing. |

## Critique

When asked to evaluate, review, or compare: verdict first, then the few things that matter, then the fix. Not a scored rubric, not a list of every nit. Recipe in `references/REVIEW.md`.

## References

Read only what the task needs.

- `references/DOMAINS.md` — per domain (code, UI, documents, data, systems): what the practitioner checks first, what to open to ground, and the tells that mark generated work.
- `references/REVIEW.md` — the critique recipe, and a four-line rubric for when a score or a comparison is requested.
