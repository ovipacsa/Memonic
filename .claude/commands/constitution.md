Create or update the project constitution from interactive or provided principle inputs, ensuring all dependent templates stay in sync.

## User Input

$ARGUMENTS

You **MUST** consider the user input before proceeding (if not empty).

## Pre-Execution Checks

**Check for extension hooks** (before_constitution): check `.specify/extensions.yml` for `hooks.before_constitution`. Execute mandatory hooks; display optional hooks for manual execution.

## Outline

You are updating the project constitution at `.specify/memory/constitution.md`. This file is a TEMPLATE containing placeholder tokens in square brackets (e.g. `[PROJECT_NAME]`, `[PRINCIPLE_1_NAME]`). Your job is to (a) collect/derive concrete values, (b) fill the template precisely, and (c) propagate any amendments across dependent artifacts.

**Note**: If `.specify/memory/constitution.md` does not exist yet, copy it from `.specify/templates/constitution-template.md` first.

Follow this execution flow:

1. Load the existing constitution at `.specify/memory/constitution.md`.
   - Identify every placeholder token of the form `[ALL_CAPS_IDENTIFIER]`.
   - **IMPORTANT**: The user might require less or more principles than the template. If a number is specified, respect that.

2. Collect/derive values for placeholders:
   - If user input (conversation) supplies a value, use it
   - Otherwise infer from existing repo context (README, docs, prior constitution versions)
   - `RATIFICATION_DATE` is the original adoption date (if unknown, ask or mark TODO)
   - `LAST_AMENDED_DATE` is today if changes are made, otherwise keep previous
   - `CONSTITUTION_VERSION` must increment:
     - MAJOR: Backward incompatible governance/principle removals or redefinitions
     - MINOR: New principle/section added or materially expanded guidance
     - PATCH: Clarifications, wording, typo fixes, non-semantic refinements

3. Draft the updated constitution content:
   - Replace every placeholder with concrete text (no bracketed tokens left unless intentionally deferred — justify any left)
   - Preserve heading hierarchy
   - Ensure each Principle section: succinct name line, paragraph capturing non-negotiable rules, explicit rationale
   - Ensure Governance section lists amendment procedure, versioning policy, and compliance review expectations

4. Consistency propagation checklist:
   - Read `.specify/templates/plan-template.md` and ensure "Constitution Check" or rules align with updated principles
   - Read `.specify/templates/spec-template.md` for scope/requirements alignment — update if constitution adds/removes mandatory sections
   - Read `.specify/templates/tasks-template.md` and ensure task categorization reflects new or removed principle-driven task types
   - Read any runtime guidance docs (README.md, etc.) and update references to changed principles

5. Produce a Sync Impact Report (prepend as an HTML comment at top of the constitution file):
   - Version change: old → new
   - List of modified principles (old title → new title if renamed)
   - Added sections / Removed sections
   - Templates requiring updates (✅ updated / ⚠ pending) with file paths
   - Follow-up TODOs for intentionally deferred placeholders

6. Validation before final output:
   - No remaining unexplained bracket tokens
   - Version line matches report
   - Dates in ISO format YYYY-MM-DD
   - Principles are declarative, testable, and free of vague language

7. Write the completed constitution back to `.specify/memory/constitution.md` (overwrite).

8. Output a final summary:
   - New version and bump rationale
   - Any files flagged for manual follow-up
   - Suggested commit message (e.g., `docs: amend constitution to vX.Y.Z (principle additions + governance update)`)

**Formatting**: Use Markdown headings exactly as in the template. Keep a single blank line between sections. Avoid trailing whitespace.

## Post-Execution Checks

**Check for extension hooks** (after_constitution): check `hooks.after_constitution` key using same pattern.
