---
name: Audit Action Enum
description: Only 17 specific values are allowed in the audit_action pgEnum; using anything else causes a DB runtime error.
---

The `auditActionEnum` in `lib/db/src/schema/auditLogs.ts` is a hard-coded pgEnum. Only these values are valid:

user_register, user_login, user_logout, user_update,
subscription_created, subscription_activated, subscription_expired, subscription_cancelled,
payment_initiated, payment_completed, payment_failed,
mt5_account_added, mt5_account_removed,
copy_factory_subscriber_added, copy_factory_subscriber_removed,
admin_settings_updated, admin_plan_created, admin_plan_updated

**Why:** pgEnum is enforced at the DB level; inserting an unlisted value throws a constraint error at runtime even if TypeScript doesn't catch it.

**How to apply:** When logging an action that has no exact match (e.g. a batch job run), use the closest existing action and put the real action name in `metadata: { action: "..." }`. To add a new action type, add it to the enum in the schema file AND run a migration.
