# Security fix staging notes

## Author approval policy

Apply `author-profile-approval-guard.sql` to a staging database that contains the current EduAxis schema.

The policy makes the database enforce both:
- the new profile belongs to the authenticated user; and
- its initial status is exactly `pending`.

The registration page intentionally omits `status`; PostgreSQL supplies the `pending` default. A modified client request that attempts to insert `approved` must be rejected by RLS.

## Required verification before Production

1. Confirm the staging database has the current `public.author_profiles` schema and all related RLS policies.
2. Create a staging Auth user and sign in as that user.
3. Attempt to insert an author profile with `status: 'approved'`; expect an RLS denial.
4. Insert the same profile without a status field; expect success and a stored status of `pending`.
5. Confirm an admin can still approve or reject the profile through the Author Management page.
6. Confirm an author with `pending` status cannot upload author images or create article submissions, and an approved author can.
7. Run Supabase Security Advisors and check the author-profile policies again.

Do not run the SQL against Production until this verification has passed and the release has been reviewed.

## Preview environment isolation

The Vercel Preview target intentionally has no Supabase or Razorpay connection while staging is being prepared. The Production target retains the existing values.

To restore functional Preview testing later, add the same variable names to the Preview target using a dedicated staging Supabase project and Razorpay **test-mode** credentials. Never add the Production service-role key, production payment secrets, or Production database URL/publishable key to Preview.

Current Production-only variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

`OCR_SPACE_API_KEY` is limited to Production and local Development.

## Migration history note

The connected Supabase project currently records only the two Phase 3 migrations. A Supabase development branch created from that history alone would not contain the full pre-existing EduAxis schema, so it is not a valid staging replica yet. Reconstruct and commit a complete baseline migration or establish a dedicated staging project before applying and testing this fix.
