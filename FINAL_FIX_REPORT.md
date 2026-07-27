# Empire Shop — Stage 2 Backend / Database / API Report

**Date:** 26 July 2026  
**Scope:** Backend, Prisma schema and migrations, database integrity, repositories, services, API validation, transactions, concurrency, error handling, build and production runtime.  
**UI/UX, frontend, SEO, authentication and search design were not redesigned.**

## 1. Problems found

- Product creation accepted extended fields but did not persist `weightKg`, `dimensionsJson`, `tagsJson`, `attributesJson` and `primaryImageIndex`.
- Public product rating aggregation included unapproved reviews.
- Search converted database failures into successful empty results.
- Order creation could return a development-only mock order when the database was unavailable, hiding a backend failure.
- Payment result application updated the transaction and order in separate operations, leaving a race window.
- Payment callbacks did not verify provider amount and currency against the transaction.
- Seller application creation used a check-then-create flow, allowing concurrent duplicate pending applications.
- Admin seller-application approval/rejection was also vulnerable to concurrent double review.
- Seller order status updates did not enforce a strict forward transition or optimistic concurrency.
- Several Prisma errors (`P2025`, `P2003`) were returned as generic HTTP 500 responses.
- Search minimum-rating filtering was applied after pagination, producing inconsistent totals and `hasMore`.
- Related-product `limit=NaN` was not rejected.
- Order item slugs were not explicitly rejected when duplicated in one order.

## 2. Cause of each problem

- Repository input mapping was incomplete even though the Prisma schema already contained the fields.
- The aggregation query lacked an `isApproved=true` predicate.
- Service-level catch blocks treated infrastructure errors as valid empty business results.
- Legacy mock behavior remained in the order route for local development.
- The transaction state guard and parent order update were not inside one database transaction.
- Webhook payload values were parsed but not compared with the authoritative transaction values.
- Application uniqueness was checked in application code only, without a database constraint.
- Admin review first read `pending` and then performed an unconditional update.
- Seller transitions were validated only by the target status, not by current state; the write was unconditional.
- Central error mapping handled only a subset of Prisma error codes, and several routes had local generic catches.
- Rating filtering happened after candidate pagination rather than in the database selection.
- Numeric query parameters were parsed with `Number()` without rejecting `NaN`.
- A client could submit the same product slug multiple times and rely on ambiguous downstream handling.

## 3. How the problems were fixed

- Completed Product Repository create mapping and added the `hasDiscount` filter.
- Restricted rating aggregation to approved reviews.
- Moved Search candidate loading, product-name suggestions and minimum-rating candidate selection behind the repository; database failures now propagate to the API as HTTP 500 instead of empty success responses.
- Removed the order mock fallback; unavailable database now consistently returns HTTP 503.
- Wrapped payment transaction state mutation and order status reflection in one Prisma transaction with an atomic terminal-state guard.
- Added provider amount and currency consistency checks to the payment callback.
- Added a partial unique database index allowing only one pending seller application per user, and made creation plus user status synchronization transactional.
- Made admin seller review writes conditional on `status=pending` inside a transaction, returning HTTP 409 when another reviewer wins the race.
- Enforced seller transitions `pending → confirmed → processing → shipped` and used conditional `updateMany` for concurrency safety.
- Added Prisma `P2025` → 404 and `P2003` → 409 mappings.
- Added duplicate order item validation and moved minimum-rating eligibility into the repository query.
- Added strict integer validation for related-product limits and invalid instant-search parameters.
- Added migration `20260726200000_pending_seller_application_constraint`.

## 4. Files changed

- `FINAL_FIX_REPORT.md`
- `prisma/migrations/20260726200000_pending_seller_application_constraint/migration.sql`
- `src/app/api/admin/seller-applications/[id]/route.ts`
- `src/app/api/orders/route.ts`
- `src/app/api/payments/callback/route.ts`
- `src/app/api/products/route.ts`
- `src/app/api/products/[slug]/related/route.ts`
- `src/app/api/search/instant/route.ts`
- `src/app/api/seller/applications/route.ts`
- `src/app/api/seller/orders/[id]/status/route.ts`
- `src/lib/payments/apply-result.ts`
- `src/lib/validation/order.ts`
- `src/server/infrastructure/errors.ts`
- `src/server/repositories/product.repository.ts`
- `src/server/services/search.service.ts`

No UI/UX component or frontend styling file was changed.

## 5. Build status

- `npm install --ignore-scripts`: PASS
- `npm run db:generate`: PASS
- `npx prisma validate`: PASS
- `npx prisma format --check`: PASS
- `npm run typecheck`: PASS
- `npm run lint`: PASS with zero warnings
- `npm run build`: PASS
- Standalone preparation: PASS
- `node .next/standalone/server.js`: PASS; server became ready on the production test port
- Build emitted one non-blocking Tailwind ambiguity warning for an existing `duration-[5500ms]` class; compilation and output were successful.

## 6. Database status

- `prisma migrate deploy`: PASS
- `prisma migrate status`: database is up to date
- 20 migrations are applied, including the new pending-application constraint.
- Verified application tables: `User`, `Category`, `Product`, `Order`, `OrderItem`, `Transaction`, `Review`, `SellerApplication`, `SellerNotification`, `AdminAuditLog`.
- Verified database totals: 24 foreign keys, 97 public indexes and 22 check constraints.
- Verified the partial unique index `SellerApplication_one_pending_per_user_key`.
- Verified finance and catalog checks for non-negative prices, stock, totals, transaction amounts and commission range.
- Current database row counts at verification time: 19 categories, 0 products, 0 users. No application data was deleted by Stage 2.

## 7. API status

Production standalone smoke tests passed:

- `/api/health`: HTTP 200
- `/api/healthz`: HTTP 200
- `/api/categories`: HTTP 200
- `/api/products?page=1&limit=5`: HTTP 200
- `/api/search?q=عسل&pageSize=5`: HTTP 200
- `/api/search/instant?q=x&limit=99`: validation response
- `/api/products/test/related?limit=abc`: HTTP 400
- unauthenticated `POST /api/orders`: HTTP 403 from the auth guard

The API now returns explicit 4xx/5xx responses for invalid input, unavailable database, relation conflicts, not-found Prisma errors and backend failures instead of silently returning mock or empty success data.

## 8. Remaining issues

- `npm audit --omit=dev` reports 4 upstream production dependency findings: 1 moderate and 3 high. No breaking forced upgrade was performed in Stage 2.
- No E2E suite or first-build code review was added, consistent with the requested scope.
- Upload routes still require the project’s configured object-storage path in a read-only or multi-instance production environment.
- The current database contains no users or products; migrations are healthy, but business data must be supplied by the project’s normal seed/import process before catalog behavior can show records.
- The existing non-blocking Tailwind ambiguous-class warning remains.
