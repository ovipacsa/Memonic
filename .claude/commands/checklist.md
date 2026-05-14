Generate a custom checklist for the current feature based on user requirements.

**CRITICAL CONCEPT**: Checklists are **UNIT TESTS FOR REQUIREMENTS WRITING** — they validate the quality, clarity, and completeness of requirements in a given domain. NOT for testing if code/implementation works.

- ✅ "Are visual hierarchy requirements defined for all card types?" (completeness)
- ✅ "Is 'prominent display' quantified with specific sizing/positioning?" (clarity)
- ❌ NOT "Verify the button clicks correctly"
- ❌ NOT "Test error handling works"

## User Input

$ARGUMENTS

You **MUST** consider the user input before proceeding (if not empty).

## Pre-Execution Checks

**Check for extension hooks** (before_checklist): check `.specify/extensions.yml` for `hooks.before_checklist`. Execute mandatory hooks; display optional hooks for manual execution.

## Execution Steps

1. **Setup**: Run `.specify/scripts/powershell/check-prerequisites.ps1 -Json` from repo root and parse JSON for FEATURE_DIR and AVAILABLE_DOCS list.

2. **Clarify intent**: Derive up to THREE initial clarifying questions from the user's phrasing + signals from spec/plan/tasks. Skip any that are already unambiguous from `$ARGUMENTS`. Only ask about information that materially changes checklist content.

   Generation algorithm:
   - Extract signals: feature domain keywords, risk indicators ("critical", "must", "compliance"), stakeholder hints, explicit deliverables
   - Cluster signals into candidate focus areas (max 4) ranked by relevance
   - Identify probable audience & timing (author, reviewer, QA, release)
   - Formulate questions: Scope refinement, Risk prioritization, Depth calibration, Audience framing, Boundary exclusion

   You may ask up to TWO more follow-up questions (Q4/Q5) if ≥2 scenario classes remain unclear. Do not exceed 5 total. Skip if user declines.

3. **Understand user request**: Combine `$ARGUMENTS` + clarifying answers. Derive checklist theme (e.g., security, review, deploy, ux).

4. **Load feature context**: Read from FEATURE_DIR:
   - spec.md: Feature requirements and scope
   - plan.md (if exists): Technical details, dependencies
   - tasks.md (if exists): Implementation tasks

5. **Generate checklist** — Create "Unit Tests for Requirements":
   - Create `FEATURE_DIR/checklists/` directory if it doesn't exist
   - Generate unique checklist filename based on domain (e.g., `ux.md`, `api.md`, `security.md`)
   - If file does NOT exist: Create new file, number items starting from CHK001
   - If file exists: Append new items, continuing from the last CHK ID
   - Never delete or replace existing checklist content

   **CORE PRINCIPLE — Test the Requirements, Not the Implementation**:
   Every checklist item MUST evaluate the REQUIREMENTS THEMSELVES for:
   - **Completeness**: Are all necessary requirements present?
   - **Clarity**: Are requirements unambiguous and specific?
   - **Consistency**: Do requirements align with each other?
   - **Measurability**: Can requirements be objectively verified?
   - **Coverage**: Are all scenarios/edge cases addressed?

   **Item format**: `- [ ] CHK### <requirement quality question> [DimensionTag, Spec §X.Y or Gap]`

   **✅ CORRECT patterns**:
   - "Are [requirement type] defined/specified/documented for [scenario]?"
   - "Is [vague term] quantified/clarified with specific criteria?"
   - "Are requirements consistent between [section A] and [section B]?"
   - "Can [requirement] be objectively measured/verified?"

   **🚫 PROHIBITED patterns**:
   - Any item starting with "Verify", "Test", "Confirm", "Check" + implementation behavior
   - References to code execution, user actions, system behavior
   - "Displays correctly", "works properly", "functions as expected"

   Traceability: ≥80% of items MUST include at least one reference: `[Spec §X.Y]`, `[Gap]`, `[Ambiguity]`, `[Conflict]`, or `[Assumption]`.

6. **Structure Reference**: Follow the canonical template in `.specify/templates/checklist-template.md`. If unavailable: H1 title, purpose/created meta lines, `##` category sections with `- [ ] CHK### <item>` lines.

7. **Report**: Output full path to checklist file, item count, and whether the run created a new file or appended to an existing one.

## Post-Execution Checks

**Check for extension hooks** (after_checklist): check `hooks.after_checklist` key using same pattern.
