# Migration notes

## Gap between 0010 and 0012

Migration `0011_billable_accounts` was added on the workspace foundation branch and
later removed in commit `68183ad` ("Remove workspace billing scaffold to avoid
overlapping dodo-billing-integration"). The journal intentionally skips idx 11:
ordering goes from `0010_workspace_project_slug_unique` directly to
`0012_audit_workspace_scope`.

Do not renumber `0012_audit_workspace_scope` to fill the gap; databases that
applied the removed billing migration would conflict with a reused 0011 slot.
