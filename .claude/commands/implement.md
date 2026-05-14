Execute the implementation plan by processing and executing all tasks defined in tasks.md.

## User Input

$ARGUMENTS

You **MUST** consider the user input before proceeding (if not empty).

## Pre-Execution Checks

**Check for extension hooks** (before_implement): check `.specify/extensions.yml` for `hooks.before_implement`. Execute mandatory hooks; display optional hooks for manual execution.

## Outline

1. Run `.specify/scripts/powershell/check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks` from repo root and parse FEATURE_DIR and AVAILABLE_DOCS list. All paths must be absolute.

2. **Check checklists status** (if FEATURE_DIR/checklists/ exists):
   - Scan all checklist files in the checklists/ directory
   - Count total items (`- [ ]` or `- [X]`) and incomplete items (`- [ ]`)
   - Create a status table:

     ```text
     | Checklist | Total | Completed | Incomplete | Status |
     |-----------|-------|-----------|------------|--------|
     | ux.md     | 12    | 12        | 0          | ✓ PASS |
     | test.md   | 8     | 5         | 3          | ✗ FAIL |
     ```

   - **If any checklist is incomplete**: Display the table and ask: "Some checklists are incomplete. Do you want to proceed with implementation anyway? (yes/no)" — halt if user says no
   - **If all checklists are complete**: Display the table and automatically proceed to step 3

3. Load and analyze the implementation context:
   - **REQUIRED**: Read tasks.md for the complete task list and execution plan
   - **REQUIRED**: Read plan.md for tech stack, architecture, and file structure
   - **IF EXISTS**: Read data-model.md, contracts/, research.md, .specify/memory/constitution.md, quickstart.md

4. **Project Setup Verification**: Create/verify ignore files based on actual project setup:
   - Check git repo → create/verify .gitignore
   - Check for Dockerfile, .eslintrc, .prettierrc, package.json, *.tf, helm charts → create/verify appropriate ignore files
   - If ignore file already exists: append missing critical patterns only
   - Common Node.js patterns: `node_modules/`, `dist/`, `build/`, `*.log`, `.env*`

5. Parse tasks.md structure and extract:
   - Task phases: Setup, Tests, Core, Integration, Polish
   - Task dependencies: Sequential vs parallel execution rules
   - Task details: ID, description, file paths, parallel markers [P]

6. Execute implementation following the task plan:
   - **Phase-by-phase execution**: Complete each phase before moving to the next
   - **Respect dependencies**: Run sequential tasks in order, parallel tasks [P] can run together
   - **Follow TDD approach**: Execute test tasks before their corresponding implementation tasks if present
   - **File-based coordination**: Tasks affecting the same files must run sequentially
   - **Validation checkpoints**: Verify each phase completion before proceeding

7. Implementation execution rules:
   - Setup first: Initialize project structure, dependencies, configuration
   - Core development: Implement models, services, CLI commands, endpoints
   - Integration work: Database connections, middleware, logging, external services
   - Polish and validation: Unit tests, performance optimization, documentation

8. Progress tracking and error handling:
   - Report progress after each completed task
   - Halt execution if any non-parallel task fails
   - For parallel tasks [P], continue with successful tasks, report failed ones
   - **IMPORTANT**: For completed tasks, mark the task as [X] in the tasks file

9. Completion validation:
   - Verify all required tasks are completed
   - Check that implemented features match the original specification
   - Validate that tests pass and coverage meets requirements
   - Report final status with summary of completed work

Note: If tasks are incomplete or missing, suggest running `/tasks` first.

## Post-Execution Checks

**Check for extension hooks** (after_implement): check `hooks.after_implement` key using same pattern.
