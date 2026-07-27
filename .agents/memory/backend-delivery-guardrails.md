---
name: Backend delivery guardrails
description: Durable rules for backend changes in this commerce project.
---

Database failures must not be represented as successful empty or mock business results, and financial or workflow state changes must use atomic conditional writes.

**Why:** Silent fallbacks make production outages look like valid catalog/order behavior, while check-then-update flows allow duplicate payments, applications or invalid state transitions under concurrency.

**How to apply:** Keep authoritative values in the database, map known Prisma errors to explicit HTTP statuses, and use conditional updates or unique constraints for every externally retried state transition.