alter table public.ufc_free_predictions_v1 drop constraint ufc_free_predictions_v1_bout_id_key;
create unique index ufc_free_predictions_model_bout_v2_idx on public.ufc_free_predictions_v1 ((body->>'model'),bout_id);
alter table public.ufc_free_predictions_v1 add constraint ufc_prediction_model_required check (jsonb_typeof(body->'model')='string' and length(body->>'model')>0);
