alter table public.ufc_free_predictions_v1 add constraint ufc_prediction_model_not_null_v2 check ((body->>'model') is not null);
