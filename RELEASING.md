# Releasing

This repository uses npm + GitHub tags for releases.

## Prerequisites

- Push access to `PSPDFKit-labs/nutrient-openclaw`
- npm publish access to `@nutrient-sdk/nutrient-openclaw`
- `NPM_TOKEN` configured in GitHub repo secrets (automation token)

## Release Flow

1. Ensure `main` is clean and up to date.
2. Update `CHANGELOG.md`:
   - Move relevant items from `Unreleased` into a new version section.
   - Keep entries concise and user-visible.
3. Bump version and create tag:

```bash
npm version patch
```

This runs:
- `preversion`: lint + tests
- `version`: syncs `openclaw.plugin.json` version to match `package.json`

4. Push commit and tag:

```bash
git push origin main
git push origin --tags
```

5. GitHub Actions release workflow runs on tag `v*.*.*`:
   - installs dependencies
   - runs lint + tests
   - verifies tag matches `package.json` version
   - publishes to npm with provenance
   - creates GitHub release

## Notes

- If you need a non-patch release, use `npm version minor` or `npm version major`.
- If the workflow fails at publish, verify `NPM_TOKEN` permissions for the `@nutrient-sdk` scope.
