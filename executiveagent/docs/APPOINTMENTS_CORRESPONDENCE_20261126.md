# Executive appointments and searchable correspondence — 2026-11-26

Repository: `interplanetarysister/ExecutiveAgent`  
Supabase project: `bimmfmydbmooarobilsq`  
Console: https://interplanetarysister.github.io/ExecutiveAgent/

## User workflow

The Executive Console now has an **Appointments & correspondence** tab.

- Record appointments with title, associated person and/or company, start and end, location, agenda, follow-up, and current status.
- Record correspondence with subject, person and/or company, channel, direction, time, and notes.
- Search timeline records by the individual's name, company's name, subject or notes. Filter simultaneously by specific person, specific company, and event type.
- Company filtering includes records inherited from the contact's linked company; when creating a record the contact's company is filled into the stored record unless another company was explicitly chosen.
- Appointments can have status updated and notes/outcome edited. Owner/admin access can delete records.
- New person and organization records are managed by the existing Relationships tab.

## Persistence and authorization

- Reuses `executive.people`, `executive.organizations`, and `executive.communications`.
- Adds `executive.communications.organization_id` with a foreign key and indexes.
- Adds `executive.appointments`, with person/company foreign keys, time validations, details and follow-ups, and indexes.
- Grants DML to `authenticated`, enforced by canonical `public.executive_can()` RLS: read for permitted executive readers, write for authorized executive writers, delete for executive managers.
- Anonymous users and signed-in accounts without an executive role cannot read the underlying records, even though the dashboard shell remains accessible to signed-in users.

## Validation

- JavaScript of the full Executive Console compiled under a static syntax check.
- In a transaction with simulated owner authorization, inserted organization, person, appointment and correspondence, verified both resolved to the same person and company, then rolled back.
- A simulated non-member viewed zero appointments and was rejected when attempting to insert.
- Verified all temporary test records were absent after rollback (0 existing appointments, communications, people and organizations at the time of test).
- Supabase `apply_migration` returned its existing SQLSTATE 42P10 for this project. The schema was applied via direct SQL and its exact source committed in `supabase/migrations/20261126_executive_appointments_correspondence.sql`.

## Publication status

Source was committed to the GitHub default branch, including the new tab. A subsequent unauthenticated fetch of the live GitHub Pages site still served the prior HTML at the time of checking. The source is ready, but Pages publication and a signed-in browser acceptance test **have not yet been verified**.

## Scope

This is a manually maintained executive log; recording correspondence does not send mail or automatically sync external calendars. Do not interpret saved appointments as externally booked meetings.
