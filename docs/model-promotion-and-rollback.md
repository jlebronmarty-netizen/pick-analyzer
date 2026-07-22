# Model Promotion And Rollback

Promotion and rollback are audit operations, not side effects of training.

## Promotion

Promotion must preserve the old champion, store evidence, record validation metrics, record `promotedAt`, identify the promotion actor and keep rollback metadata.

## Rollback

Rollback restores the prior champion pointer without deleting challenger rows or historical projections.

## V1 Status

Pitcher-outs promotion is not ready until settled shadow sample size is sufficient. Rollback policy is defined and validation fixtures assert rollback preservation.
