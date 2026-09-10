-- Dwell time before freeze threshold alerts fire (reduces door-blip false alarms).
alter table public.alert_settings
  add column if not exists freeze_dwell_minutes integer not null default 0;

comment on column public.alert_settings.freeze_dwell_minutes is
  'Minutes a probe must stay at/below freeze threshold before alerting; 0 = immediate';
