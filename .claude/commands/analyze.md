Perform a non-destructive cross-artifact consistency and quality analysis across spec.md, plan.md, and tasks.md after task generation.

## User Input

$ARGUMENTS

You **MUST** consider the user input before proceeding (if not empty).

**STRICTLY READ-ONLY**: Do **not** modify any files. Output a structured analysis report only.

## Pre-Execution Checks

**Check for extension hooks** (before_analyze): check `.specify/extensions.yml` for `hooks.before_analyze`. Execute mandatory hooks; display optional hooks for manual execution.

## Execution Steps

### 1. Initialize Analysis Context

Run `.specify/scripts/powershell/check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks` once from repo root and parse JSON for FEATURE_DIR and AVAILABLE_DOCS. Derive absolute paths:

- SPEC = FEATURE_DIR/spec.md
- PLAN = FEATURE_DIR/plan.md
- TASKS = FEATURE_DIR/tasks.md

Abort with an error message if any required file is missing.

### 2. Load Artifacts

**From spec.md:** Overview/Context, Functional Requirements, Success Criteria, User Stories, Edge Cases

**From plan.md:** Architecture/stack choices, Data Model references, Phases, Technical constraints

**From tasks.md:** Task IDs, Descriptions, Phase grouping, Parallel markers [P], Referenced file paths

**From constitution:** Load `.specify/memory/constitution.md` for principle validation

### 3. Build Semantic Models (internal only)

- Requirements inventory: For each FR-### and SC-###, record a stable key
- User story/action inventory: Discrete user actions with acceptance criteria
- Task coverage mapping: Map each task to requirements or stories
- Constitution rule set: Extract principle names and MUST/SHOULD statements

### 4. Detection Passes

Focus on high-signal findings. Limit to 50 findings total.

**A. Duplication Detection**: Identify near-duplicate requirements

**B. Ambiguity Detection**: Flag vague adjectives (fast, scalable, secure, intuitive, robust) lacking measurable criteria; flag unresolved placeholders (TODO, TKTK, ???)

**C. Underspecification**: Requirements with verbs but missing object or measurable outcome; user stories missing acceptance criteria

**D. Constitution Alignment**: Any requirement or plan element conflicting with a MUST principle

**E. Coverage Gaps**: Requirements with zero associated tasks; tasks with no mapped requirement/story; Success Criteria requiring buildable work not reflected in tasks

**F. Inconsistency**: Terminology drift, data entities referenced in plan but absent in spec (or vice versa), conflicting requirements

### 5. Severity Assignment

- **CRITICAL**: Violates constitution MUST, missing core spec artifact, or requirement with zero coverage blocking baseline functionality
- **HIGH**: Duplicate or conflicting requirement, ambiguous security/performance attribute, untestable acceptance criterion
- **MEDIUM**: Terminology drift, missing non-functional task coverage, underspecified edge case
- **LOW**: Style/wording improvements, minor redundancy

### 6. Produce Compact Analysis Report

```markdown
## Specification Analysis Report

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| A1 | Duplication | HIGH | spec.md:L120-134 | ... | ... |

**Coverage Summary Table:**
| Requirement Key | Has Task? | Task IDs | Notes |

**Constitution Alignment Issues:** (if any)

**Unmapped Tasks:** (if any)

**Metrics:**
- Total Requirements
- Total Tasks
- Coverage % (requirements with >=1 task)
- Ambiguity Count / Duplication Count / Critical Issues Count
```

### 7. Provide Next Actions

- If CRITICAL issues: Recommend resolving before `/implement`
- If only LOW/MEDIUM: User may proceed with improvement suggestions
- Provide explicit command suggestions

### 8. Offer Remediation

Ask: "Would you like me to suggest concrete remediation edits for the top N issues?" (Do NOT apply automatically.)

### 9. Check for extension hooks

(after_analyze): check `hooks.after_analyze` key using same pattern.
