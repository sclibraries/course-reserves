These rules apply to every task in this project unless explicitly overridden.
Bias: caution over speed on non-trivial work.

## Rule 1 — Think Before Coding

State assumptions explicitly. Ask rather than guess.
Push back when a simpler approach exists. Stop when confused.

## Rule 2 — Simplicity First

Minimum code that solves the problem. Nothing speculative.
No abstractions for single-use code.

## Rule 3 — Surgical Changes

Touch only what you must. Don't improve adjacent code.
Match existing style. Don't refactor what isn't broken.

## Rule 4 — Goal-Driven Execution

Define success criteria. Loop until verified.
Strong success criteria let Codex loop independently.

## Rule 5 — Use the model only for judgment calls

Use for: classification, drafting, summarization, extraction.
Do NOT use for: routing, retries, deterministic transforms.
If code can answer, code answers.

## Rule 6 — Focus on Context Health, Not Frugality

Max 20x allowance enables deep context. Let sessions run long when debugging complex multi-layer Docker/Yii2 flows.

- Avoid Bloat: Run `/clear` only when switching to entirely unrelated tasks.
- Avoid Loops: If an agent loop repeats the same command/error 3 times, break immediately and ask for user intervention. Do not silently burn context on circular logic.
- Compact Wisely: Use `/compact` naturally at the end of a completed feature branch to squash the token footprint before starting the next branch.

## Rule 7 — Surface conflicts, don't average them

If two patterns contradict, pick one (more recent / more tested).
Explain why. Flag the other for cleanup.

## Rule 8 — Read before you write

Before adding code, read exports, immediate callers, shared utilities.
If unsure why existing code is structured a certain way, ask.

## Rule 9 — Tests verify intent, not just behavior

Tests must encode WHY behavior matters, not just WHAT it does.
A test that can't fail when business logic changes is wrong.

## Rule 10 — Checkpoint after every significant step

Summarize what was done, what's verified, what's left.
Don't continue from a state you can't describe back.

## Rule 11 — Match the codebase's conventions, even if you disagree

Conformance > taste inside the codebase.
If you think a convention is harmful, surface it. Don't fork silently.

## Rule 12 — Fail loud

"Completed" is wrong if anything was skipped silently.
"Tests pass" is wrong if any were skipped.
Default to surfacing uncertainty, not hiding it.

## Rule 13 — Strict Local Ticket Enforcement

Every task must originate from or create a local ticket before work begins.

1. Ticket Creation: If a ticket doesn't exist, create `.tickets/TASK-[XYZ].md` defining: Title, Scope, Success Criteria, Status (Todo).
2. Superpowers Alignment: When `superpowers` writes its execution plan, it must explicitly reference the Ticket ID and link to it.
3. State Tracking: Update the ticket status to (In-Progress) when worktrees are made, and (Completed) only after all TDD tests pass and code-review completes.
4. No Ghost Work: If a file change cannot be traced to an open ticket, abort immediately.

