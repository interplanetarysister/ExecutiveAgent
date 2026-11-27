# Cloudflare — Deploy-Source Pinning

## Canonical source

The canonical Worker source is:

- `cloudflare/executive-agent-research.mjs`

A second copy exists at:

- `executiveagent/src/research-worker.mjs`

**Both copies are preserved by owner directive.** Do not delete either one.

## What a deploy actually ships

The only wrangler config in this repository is
`executiveagent/wrangler.jsonc`, and it sets:

```jsonc
"main": "src/research-worker.mjs"
```

So a wrangler deploy run from `executiveagent/` ships the **nested copy**
(`executiveagent/src/research-worker.mjs`), not the canonical copy in this
directory. Keep that in mind before deploying: editing only the canonical
copy changes nothing in a deploy until the nested copy is synced (see the
sync rule below).

## Account pinning

The `account_id` in `executiveagent/wrangler.jsonc` is the executive
Cloudflare account:

- Executive account: `ab53799fa1a2189dd6aee605504c9fa4`

**Never deploy executive assets to the Interplanetary Fund (iFund)
account:**

- iFund account: `c95db4f2c901f32776471b85f1eda15d`

## Sync rule

1. Edit the canonical copy: `cloudflare/executive-agent-research.mjs`.
2. Copy it byte-for-byte over the nested copy:
   `executiveagent/src/research-worker.mjs`.
3. Verify both copies match before any deploy:

   ```sh
   md5sum cloudflare/executive-agent-research.mjs executiveagent/src/research-worker.mjs
   ```

   The two hashes must be identical.

## Authorization

No deployment without the owner's explicit authorization.
