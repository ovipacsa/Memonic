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
   - **Cache clearing after each phase**: After every phase completes, clear stale state (see step 9)

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

9. **Cache clearing between phases** — run after every phase completes, before starting the next:
   - Detect the project type from plan.md:
     - **Next.js**: Delete `.next/cache` directory; if a dev server is running on port 3000, stop it (PowerShell: `Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess -Force -ErrorAction SilentlyContinue`), then restart it in the background (`npm run dev > /dev/null 2>&1 &`); wait up to 10 s for port 3000 to respond
     - **Vite / React**: Delete `node_modules/.vite` cache directory; restart the dev server if running
     - **Generic Node**: Run `npm run build` to recompile; clear any `dist/` or `build/` output if the project is a library
     - **Other**: Log "no cache strategy identified — skipping cache clear" and continue
   - After restarting, verify the server is accepting connections with a quick HTTP check before proceeding to the next phase
   - If the server fails to restart, report the error clearly but do NOT halt the entire implementation — continue with remaining phases and flag the issue in the completion report

10. Completion validation:
    - Verify all required tasks are completed
    - Check that implemented features match the original specification
    - Validate that tests pass and coverage meets requirements
    - Run a final cache clear + server restart (per step 9) before Playwright review

11. **Playwright visual review** — run after ALL tasks are complete and server is confirmed running:

    a. **Determine pages to test**: Read quickstart.md (if it exists) for the list of verification URLs and scenarios; fall back to inspecting the project routes from plan.md or the framework's routing conventions.

    b. **For each page**:
       1. Navigate with Playwright (`mcp__plugin_playwright_playwright__browser_navigate`)
       2. Take a full-page screenshot (`mcp__plugin_playwright_playwright__browser_take_screenshot` with `fullPage: true`)
       3. Read the screenshot image and inspect it for:
          - Blank/white pages (CSS not loading)
          - Broken layout (elements out of place, overflow, zero-height containers)
          - Missing design tokens (wrong colours, wrong fonts, unstyled elements)
          - Console errors (read from Playwright console log after navigation)
       4. Report findings per page: ✓ PASS or ✗ FAIL with description of the issue

    c. **Auth-gated pages**: If a page redirects to login, log in using test credentials from `TestUsers.txt` (if present) or any credentials readable from the project, then revisit the page. If no credentials are available, note it and skip that page.

    d. **Issue triage**: For each ✗ FAIL page:
       - Diagnose the root cause (missing CSS import, wrong class, JS error, server error)
       - Apply the fix directly (edit the file)
       - Re-run a fresh cache clear + server restart
       - Re-screenshot the page and confirm it passes
       - Mark the fix in a "Playwright Fixes" section of the completion report

    e. **Completion report** — output a table:

       ```text
       | Page     | Status  | Notes                          |
       |----------|---------|--------------------------------|
       | /home    | ✓ PASS  |                                |
       | /feed    | ✓ PASS  |                                |
       | /nutrition | ✗ FAIL | White page — missing CSS link  |
       ```

    f. Implementation is only considered **done** when all pages pass Playwright review OR remaining failures are explicitly acknowledged as out-of-scope by the user.

Note: If tasks are incomplete or missing, suggest running `/tasks` first.

## Post-Execution Checks

**Check for extension hooks** (after_implement): check `hooks.after_implement` key using same pattern.
