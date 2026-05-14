Convert existing tasks into actionable, dependency-ordered GitHub issues for the feature based on available design artifacts.

## User Input

$ARGUMENTS

You **MUST** consider the user input before proceeding (if not empty).

## Pre-Execution Checks

**Check for extension hooks** (before_taskstoissues): check `.specify/extensions.yml` for `hooks.before_taskstoissues`. Execute mandatory hooks; display optional hooks for manual execution.

## Outline

1. Run `.specify/scripts/powershell/check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks` from repo root and parse FEATURE_DIR and AVAILABLE_DOCS list. All paths must be absolute.

2. From the executed script, extract the path to **tasks.md**.

3. Get the Git remote by running:

```bash
git config --get remote.origin.url
```

> **CAUTION**: ONLY PROCEED TO NEXT STEPS IF THE REMOTE IS A GITHUB URL.
> If it is not a GitHub URL, stop and inform the user.

4. For each task in tasks.md, use the GitHub MCP server (if available) or the GitHub CLI (`gh issue create`) to create a new issue in the repository matching the Git remote URL.

   For each task create an issue with:
   - Title: The task description (without the checkbox and ID prefix)
   - Body: Include Task ID, phase, story label (if any), parallel marker (if any), and file paths
   - Labels: Map phase to a label (e.g., "setup", "implementation", "polish")

> **CAUTION**: UNDER NO CIRCUMSTANCES EVER CREATE ISSUES IN REPOSITORIES THAT DO NOT MATCH THE REMOTE URL.

5. Report summary: number of issues created, any failures, and links to the created issues.

## Post-Execution Checks

**Check for extension hooks** (after_taskstoissues): check `hooks.after_taskstoissues` key using same pattern.
