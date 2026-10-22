# Domains

Read the section for the domain you are working in. If the work spans two (a chart inside a memo, a UI built in code), read both and let the more specific context win.

Each section answers three questions: what the practitioner checks first, what to open to ground before creating, and which tells give away generated work in this domain.

---

## Code

**Practitioner checks first**
- Does it match the file it lives in — naming, error style, abstraction level, how it logs?
- Is the common case easy at the call site?
- What happens when it fails, and will the failure be legible?

**Open to ground**
- The file being edited and its two or three nearest neighbors. Match them even where you would have chosen differently.
- The test file for that module, if one exists — it shows what the codebase considers worth testing.
- The one dependency you are about to add: check whether the codebase already has a way to do this.

**Tells**
- A comment or docstring that describes behavior the code no longer has, or never had ("retries at 1s, 2s, 4s" when only two sleeps can run).
- Configuration for something with one correct value here; a class where a function would do; a logger in a script run by hand.
- Defensive checks against conditions the surrounding code already guarantees.
- Tests that exercise the framework or the mock rather than the behavior.

---

## UI and visual design

**Practitioner checks first**
- Hierarchy: where does the eye land first, second, third, and is that the order the task needs?
- Does the page know its audience — vocabulary, density, and what it assumes they already understand?
- Is there exactly one primary action, and is everything else visibly subordinate to it?

**Open to ground**
- The existing product: its components, tokens, spacing scale, and type. New work should look like it was always there.
- One real page of the same kind — a settings page, a checkout, a pricing page — from a product the audience already uses. Look at what it leaves plain.
- The actual content. Design for the copy, data, and assets that exist, not for the ones a template expects.

**Tells**
- Hero, three feature cards, testimonial strip, FAQ, CTA — the sequence that appears when no sequence was chosen.
- Placeholder assets rendered as real: fake logos, invented testimonials, screenshots of features that do not exist.
- Copy that describes capabilities the brief never mentioned. Specific claims are not free; each one is a promise the product has to keep.
- A page longer than the decision it supports. If the reader decides in thirty seconds, the page should let them.
- Decoration that encodes nothing: gradients, glows, icons chosen for a grid rather than a meaning.

---

## Documents and messages

**Practitioner checks first**
- Does the first sentence carry the conclusion, and could a reader stop there and act correctly?
- Is space proportional to importance rather than to complexity?
- What is the reader supposed to do after reading, and is that unmistakable?

**Open to ground**
- The last two or three artifacts of this genre from this audience or organization. Match their length, register, and structure unless you have a reason not to.
- The source material the document rests on — the data, the thread, the code — not a summary of it.
- The reader's actual constraints: how long they have, what they already decided, what they are skeptical of.

**Tells**
- A header block, background section, or introduction that exists because memos have them.
- Balanced coverage of unbalanced evidence: three pros and three cons when there are two decisive pros and one relevant con.
- Headings that name a section ("Analysis") rather than state its claim ("The bill is not the real cost; pipeline time is").
- A closing paragraph that restates the document; a "next steps" list that repeats the recommendation.
- Facts that sound sourced but were not: a market size, a benchmark, a quote, a competitor's price.

---

## Data and charts

**Practitioner checks first**
- What single comparison should the viewer make, and does the encoding make exactly that comparison easy?
- Can the scale, baseline, or axis mislead? Would the honest version change the conclusion?
- What is the one finding, and is it visually dominant?

**Open to ground**
- The data itself: its range, its gaps, its outliers, how many series there really are. Never design a chart from the column names.
- How this audience already reads numbers — the dashboard, report, or paper they use today. Finance, science, product, and journalism plot differently for good reasons.
- The decision the artifact supports. "What does the data show" is not a spec; "should we cut the second tier" is.

**Tells**
- Every series shown when one matters; every metric on the dashboard at the same size.
- A chart where a table would be read faster, or a dual axis that makes the viewer juggle scales.
- A legend doing the work direct labels could do; gridlines that aid no comparison.
- A chart title that names the variables instead of stating the finding.

---

## Systems, plans, and architecture

**Practitioner checks first**
- What are the real constraints — traffic, team size, existing infrastructure, tolerated downtime, data sensitivity — and does the design follow from them?
- How does it fail, and who finds out?
- How do we get from here to there without stopping the world?

**Open to ground**
- The current system as it actually runs: configs, deploy scripts, the incident history, the on-call notes. Not the architecture diagram from two years ago.
- How comparable teams at comparable scale built the same thing. Not how the textbook builds it.
- The people who will operate it, and what they already know how to run.

**Tells**
- Components that exist because a diagram of this kind usually has them: a queue, a cache, a service boundary with no owner.
- Alternatives listed for completeness that were never seriously considered.
- Scalability analysis for scale the system will not see in the relevant timeframe.
- A migration plan without a first step that could ship this week.
