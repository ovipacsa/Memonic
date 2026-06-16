# Feature Specification: Purge Account

**Feature Branch**: `004-purge-account`

**Created**: 2026-05-21

**Status**: Draft

**Input**: User description: "create a delete account button. Button should be name purge and should be place on the lower right corner of the user panel. When pushed a pop will require confirmation of the action, If the user confirms the account will be deleted meaning the user wont be able to log in and won't be seen in the Europeans feed any longer but the all the data related to the user will persist in the data base."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Purge Account via Profile Panel (Priority: P1)

A signed-in user decides to permanently deactivate their Memonic account. They locate the **PURGE** button at the bottom-right corner of their profile panel on the feed page, click it, and are presented with a confirmation dialog explaining the consequences. After confirming, their account is deactivated: they are immediately logged out and can no longer sign in. Their posts and data remain in the system but they no longer appear in the Signal Members rail or the post feed for other users.

**Why this priority**: Core user-facing action. Without this story the feature does not exist.

**Independent Test**: Can be fully tested by clicking PURGE on the profile panel, confirming the dialog, and verifying (a) immediate logout, (b) inability to log back in, and (c) absence of the user from other accounts' feeds and Signal Members rail.

**Acceptance Scenarios**:

1. **Given** a signed-in user on `/feed`, **When** they click the PURGE button in the lower-right corner of their profile panel, **Then** a confirmation dialog appears describing the permanent nature of the action before anything is changed.
2. **Given** the confirmation dialog is open, **When** the user confirms, **Then** their account is deactivated, they are logged out, and they are redirected to the home page.
3. **Given** the confirmation dialog is open, **When** the user cancels, **Then** the dialog closes and the account remains active and unchanged.
4. **Given** an account has been purged, **When** someone attempts to log in with those credentials, **Then** the login is rejected and an appropriate error is shown.
5. **Given** an account has been purged, **When** another signed-in user views the Signal Members rail or the post feed, **Then** the purged user does not appear in either location.

---

### User Story 2 — Data Persistence After Purge (Priority: P2)

Although the purged account is no longer accessible or visible, all records associated with it (profile data, posts, nutrition logs, friend history) remain intact in the system. This supports auditability and regulatory retention without exposing the deactivated user to other members.

**Why this priority**: Ensures the system honours the "soft delete" contract and data is not lost irreversibly.

**Independent Test**: After purging an account, an administrator or database inspection confirms all rows associated with the user still exist while the user cannot log in or be seen on-platform.

**Acceptance Scenarios**:

1. **Given** an account has been purged, **When** the underlying data store is inspected, **Then** the user's profile, posts, nutrition logs, and social graph entries are all present and unmodified.
2. **Given** an account has been purged, **When** another user who was friends with the purged account views their feed, **Then** the purged user's posts are no longer visible (hidden, not deleted).

---

### Edge Cases

- What happens if the network fails mid-purge after the user confirms? The account must not be left in a partially-deactivated state; the operation must succeed fully or not at all.
- What happens if the user double-clicks PURGE or confirms twice before the server responds? The operation must be idempotent and not error on a second deactivation call.
- What happens if a purged user's session cookie is still present in a browser after purge? Any subsequent authenticated request must be rejected as if the session were invalid.
- What happens to pending friend requests sent to or from a purged account? They should no longer be visible or actionable by the other party.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The profile panel on the feed page MUST display a button labelled **PURGE** positioned at the lower-right corner of the panel.
- **FR-002**: Clicking PURGE MUST open a confirmation dialog that clearly describes the consequences: the user will be unable to log in and will no longer appear to other members, but their data will be retained.
- **FR-003**: The confirmation dialog MUST provide an explicit confirm action and a cancel action.
- **FR-004**: Cancelling the dialog MUST close it without making any changes to the account.
- **FR-005**: Confirming the dialog MUST deactivate the account by setting a persistent `deactivated` flag on the user record (soft delete — no data is removed).
- **FR-006**: Upon successful deactivation, the system MUST immediately invalidate the user's active session and log them out.
- **FR-007**: Upon successful deactivation, the user MUST be redirected to the public home page.
- **FR-008**: A deactivated account MUST be rejected at login with a clear, user-facing message.
- **FR-009**: Deactivated users MUST be excluded from the Signal Members rail for all other users.
- **FR-010**: Deactivated users MUST be excluded from the post feed for all other users (their posts are hidden, not deleted).
- **FR-011**: The purge operation MUST be atomic — either the account is fully deactivated or no change is made.
- **FR-012**: All data rows associated with the purged user (profile, posts, logs, social graph) MUST remain in the data store after deactivation.

### Key Entities

- **User**: Gains a `deactivated` boolean flag (and optionally a `deactivated_at` timestamp). When `true`, the user cannot authenticate and is invisible to other members.
- **Session**: Invalidated immediately upon account deactivation.
- **Posts / Nutrition Logs / Social Graph entries**: Retained in full; excluded from public queries by filtering on the author's `deactivated` status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A signed-in user can locate, trigger, and complete the purge flow in under 60 seconds from the feed page.
- **SC-002**: After purging, the user is logged out and redirected within 3 seconds of confirming.
- **SC-003**: A purged account's credentials are rejected at login 100% of the time.
- **SC-004**: A purged user is absent from the Signal Members rail and post feed for 100% of other users on next page load.
- **SC-005**: 100% of data rows associated with the purged user remain present in the data store after the operation.
- **SC-006**: Cancelling the confirmation dialog results in zero changes to the account state 100% of the time.

## Assumptions

- The feature targets authenticated users on the `/feed` page only; no equivalent flow exists on any other page.
- "Soft delete" means a `deactivated` flag is set on the user record; no rows are physically removed from any table.
- There is no self-service reactivation flow — a purged account remains deactivated indefinitely unless an administrator intervenes at the database level.
- Pending friend requests involving the purged account are effectively orphaned and will not surface in any UI after deactivation (no explicit cleanup required for v1).
- The confirmation dialog copy is final and does not require localisation for v1.
- Mobile/responsive layout is in scope to the same degree as the existing profile panel.
