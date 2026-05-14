Identify underspecified areas in the current feature spec by asking up to 5 highly targeted clarification questions and encoding answers back into the spec.

## User Input

$ARGUMENTS

You **MUST** consider the user input before proceeding (if not empty).

## Pre-Execution Checks

**Check for extension hooks (before clarification)**:
- Check if `.specify/extensions.yml` exists in the project root and look for entries under `hooks.before_clarify`
- Filter out hooks where `enabled` is explicitly `false`
- For each executable hook: if optional, display prompt; if mandatory, execute and wait for result

## Outline

Goal: Detect and reduce ambiguity or missing decision points in the active feature specification and record the clarifications directly in the spec file.

Note: This clarification workflow is expected to run (and be completed) BEFORE invoking `/plan`. If the user explicitly states they are skipping clarification (e.g., exploratory spike), you may proceed, but must warn that downstream rework risk increases.

Execution steps:

1. Run `.specify/scripts/powershell/check-prerequisites.ps1 -Json -PathsOnly` from repo root. Parse JSON for:
   - `FEATURE_DIR`
   - `FEATURE_SPEC`
   - (Optionally capture `IMPL_PLAN`, `TASKS` for future chained flows.)
   - If JSON parsing fails, abort and instruct user to re-run `/specify` or verify feature branch environment.

2. Load the current spec file. Perform a structured ambiguity & coverage scan using this taxonomy. For each category, mark status: Clear / Partial / Missing.

   - Functional Scope & Behavior: Core user goals, out-of-scope declarations, user roles
   - Domain & Data Model: Entities, attributes, relationships, lifecycle/state transitions
   - Interaction & UX Flow: Critical user journeys, error/empty/loading states, accessibility
   - Non-Functional Quality Attributes: Performance, scalability, reliability, observability, security, compliance
   - Integration & External Dependencies: External services/APIs, data formats, protocol assumptions
   - Edge Cases & Failure Handling: Negative scenarios, rate limiting, conflict resolution
   - Constraints & Tradeoffs: Technical constraints, explicit tradeoffs
   - Terminology & Consistency: Canonical glossary terms, avoided synonyms
   - Completion Signals: Acceptance criteria testability, measurable DoD indicators
   - Misc / Placeholders: TODO markers, ambiguous adjectives lacking quantification

3. Generate (internally) a prioritized queue of up to 5 candidate clarification questions. Constraints:
    - Maximum of 5 total questions across the whole session
    - Each question must be answerable with a short multiple-choice selection (2–5 options) OR a one-word/short-phrase answer (≤5 words)
    - Only include questions whose answers materially impact architecture, data modeling, task decomposition, test design, UX behavior, operational readiness, or compliance validation
    - Exclude questions already answered, trivial stylistic preferences, or plan-level execution details

4. Sequential questioning loop (interactive):
    - Present EXACTLY ONE question at a time
    - For multiple-choice questions:
       - **Analyze all options** and determine the **most suitable option** based on best practices, risk reduction, and project alignment
       - Present your **recommended option prominently** at the top: `**Recommended:** Option [X] - <reasoning>`
       - Render all options as a Markdown table:

       | Option | Description |
       |--------|-------------|
       | A | <Option A description> |
       | B | <Option B description> |
       | Short | Provide a different short answer (<=5 words) |

       - After the table add: `You can reply with the option letter (e.g., "A"), accept the recommendation by saying "yes" or "recommended", or provide your own short answer.`
    - For short-answer style: Provide your **suggested answer** based on best practices, then prompt for acceptance or custom answer
    - After the user answers: record it in working memory and move to the next queued question
    - Stop when: all critical ambiguities resolved early, user signals completion ("done", "good", "no more"), or you reach 5 questions

5. Integration after EACH accepted answer (incremental update approach):
    - For the first integrated answer: Ensure a `## Clarifications` section exists; create `### Session YYYY-MM-DD` subheading
    - Append bullet: `- Q: <question> → A: <final answer>`
    - Apply the clarification to the most appropriate section(s) of the spec
    - Save the spec file AFTER each integration
    - Preserve formatting; keep each inserted clarification minimal and testable

6. Validation (performed after EACH write plus final pass):
   - Clarifications section contains exactly one bullet per accepted answer (no duplicates)
   - Total asked questions ≤ 5
   - Updated sections contain no lingering vague placeholders
   - No contradictory earlier statement remains
   - Markdown structure valid; only allowed new headings: `## Clarifications`, `### Session YYYY-MM-DD`

7. Write the updated spec back to `FEATURE_SPEC`.

8. Report completion:
   - Number of questions asked & answered
   - Path to updated spec
   - Sections touched
   - Coverage summary table (Resolved / Deferred / Clear / Outstanding per category)
   - Suggested next command

## Post-Execution Checks

**Check for extension hooks** (after_clarify): check `hooks.after_clarify` key using same pattern as pre-execution.

## Behavior Rules

- If no meaningful ambiguities found, respond: "No critical ambiguities detected worth formal clarification." and suggest proceeding
- If spec file missing, instruct user to run `/specify` first
- Never exceed 5 total asked questions
- Respect user early termination signals ("stop", "done", "proceed")
