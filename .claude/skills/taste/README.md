# taste

An agent skill for domain-grounded judgment while creating and critiquing work: code, documents, UI, charts, plans, messages.

Capable models already have taste on a well-specified brief. Where it still fails is narrow and predictable: they ground from memory when the real artifact is one tool call away, they fill a thin brief with plausible invented specifics that read as grounded, and they produce more than the occasion warrants. This skill targets those three failures and nothing else.

## What's in it

```text
taste/
├── SKILL.md                 grounding step, create recipe, pre-delivery check, critique mode
├── references/
│   ├── DOMAINS.md           per domain: what practitioners check first, what to open, tells
│   └── REVIEW.md            critique recipe, option comparison, four-line rubric
├── agents/openai.yaml       Codex skill metadata
├── scripts/install.sh       installer for Claude Code, Codex, and ~/.agents
└── scripts/package-claude-skill.sh
```

`SKILL.md` is under 900 words. The references load only when the task needs them.

## Install

```sh
git clone https://github.com/Hmbown/taste.git
cd taste
./scripts/install.sh          # installs everywhere it finds a skills directory
```

Or pick a target:

```sh
./scripts/install.sh claude   # copies to ~/.claude/skills/taste
./scripts/install.sh agents   # copies to ~/.agents/skills/taste (Codex, Copilot CLI, Gemini CLI)
./scripts/install.sh codex    # symlinks ~/.codex/skills/taste -> this repo
```

Project-local: copy the repo into `.claude/skills/taste/` or `.agents/skills/taste/`.

## Usage

The skill triggers on its own when a request asks for judgment, polish, or a deliverable that will be seen. To invoke it directly:

```text
Use taste on this component. It works, but it feels generated.
Apply taste to this memo. The CTO has five minutes.
Build this landing page with taste. I have copy and nothing else.
Use taste to compare these three designs.
```

## What changed in 1.0

The earlier versions argued for taste: six principles, six workflow steps, eight anti-patterns, a six-dimension rubric. Testing against current models showed they already agree with all of it and produce strong work on rich briefs without the skill. The residual failures were different from the ones the old version addressed, so 1.0 is rebuilt around them:

- **Open the exemplar.** Grounding means reading the neighboring code, the existing page, the last memo — not recalling what such things usually look like.
- **Specifics come from the source.** The most damaging failure observed in testing was confabulation: a landing page that invented seven product features, a pricing model, and a platform policy from a two-sentence brief, all fluently. The old "specificity over sophistication" principle pushed toward this. The new rule: if it isn't in the source, design around it, mark it, or ask.
- **Finish matches stakes.** Length and polish calibrated to what the reader will notice.
- **Critique mode.** Verdict first, then the invention, the cut, the miss, the tell — not a score.

## Release

```sh
git tag v1.0.0
git push origin v1.0.0
```

The release workflow builds `dist/taste.skill` and attaches it to a GitHub release.
