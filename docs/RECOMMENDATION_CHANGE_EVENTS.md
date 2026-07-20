# Recommendation Change Events V1

The contract exists at `/api/operations/change-events`.

Current state:

- Returns typed empty events when no persisted recommendation-change event table exists.
- Does not fabricate line movement, model movement or recommendation changes.
- Does not rewrite historical predictions.

Future storage can persist:

- Previous and new category.
- Previous and new odds timestamp.
- Change reason.
- Affected game and market.
- Whether official-pick policy changed. This must remain false unless an explicit approved policy migration occurs.
