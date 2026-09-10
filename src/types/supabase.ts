export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      alert_events: {
        Row: {
          acknowledged_at: string | null
          body: string
          channels_sent: string[]
          channels_skipped: string[]
          created_at: string
          id: number
          kind: string
          meta: Json
          title: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          body: string
          channels_sent?: string[]
          channels_skipped?: string[]
          created_at?: string
          id?: number
          kind: string
          meta?: Json
          title: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          body?: string
          channels_sent?: string[]
          channels_skipped?: string[]
          created_at?: string
          id?: number
          kind?: string
          meta?: Json
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      alert_settings: {
        Row: {
          alert_playbooks: Json
          alert_rules: Json
          alert_templates: Json
          battery_alerts_enabled: boolean
          battery_threshold_pct: number
          battery_trend_alerts_enabled: boolean
          channel_discord: boolean
          channel_email: boolean
          channel_ntfy: boolean
          channel_push: boolean
          channel_pushover: boolean
          channel_severity: Json
          channel_slack: boolean
          channel_sms: boolean
          channel_teams: boolean
          channel_telegram: boolean
          channel_webhook: boolean
          channel_whatsapp: boolean
          data_retention_days: number | null
          digest_enabled: boolean
          discord_webhook_url: string | null
          drip_email_stage: number
          drip_emails_enabled: boolean
          email: string | null
          enabled: boolean
          escalation_enabled: boolean
          escalation_minutes: number
          feed_uptime_alerts_enabled: boolean
          forecast_freeze_enabled: boolean
          forecast_hours_ahead: number
          freeze_drill_enabled: boolean
          freeze_threshold_f: number
          freeze_dwell_minutes: number
          humidity_threshold: number
          last_alert_sent_at: string | null
          last_battery_alert_at: string | null
          last_battery_trend_alert_at: string | null
          last_drip_email_at: string | null
          last_escalation_at: string | null
          last_feed_uptime_alert_at: string | null
          last_flood_alert_at: string | null
          last_forecast_alert_at: string | null
          last_freeze_drill_at: string | null
          last_monthly_report_at: string | null
          last_nws_alert_at: string | null
          last_outage_alert_at: string | null
          last_portfolio_alert_at: string | null
          last_quarterly_report_at: string | null
          last_rate_alert_at: string | null
          last_rssi_alert_at: string | null
          last_runway_alert_at: string | null
          last_trial_reminder_at: string | null
          monthly_report_enabled: boolean
          ntfy_server: string
          ntfy_topic: string | null
          nws_freeze_alerts_enabled: boolean
          outage_hours: number
          outbound_webhook_secret: string | null
          outbound_webhook_url: string | null
          playbook_fired: Json
          portfolio_alerts_enabled: boolean
          pushover_app_token: string | null
          pushover_user_key: string | null
          quarterly_report_enabled: boolean
          quiet_hours_bypass_freeze: boolean
          quiet_hours_enabled: boolean
          quiet_hours_end: string
          quiet_hours_sms_critical: boolean
          quiet_hours_start: string
          quiet_hours_timezone: string
          rate_change_f: number
          reading_webhook_secret: string | null
          reading_webhook_url: string | null
          rssi_alerts_enabled: boolean
          rssi_threshold: number
          runway_alert_enabled: boolean
          slack_webhook_url: string | null
          sms_phone: string | null
          snooze_until: string | null
          space_channel_routing: Json
          teams_webhook_url: string | null
          telegram_bot_token: string | null
          telegram_chat_id: string | null
          telegram_command_secret: string | null
          updated_at: string
          user_id: string
          vacation_until: string | null
          whatsapp_phone: string | null
        }
        Insert: {
          alert_playbooks?: Json
          alert_rules?: Json
          alert_templates?: Json
          battery_alerts_enabled?: boolean
          battery_threshold_pct?: number
          battery_trend_alerts_enabled?: boolean
          channel_discord?: boolean
          channel_email?: boolean
          channel_ntfy?: boolean
          channel_push?: boolean
          channel_pushover?: boolean
          channel_severity?: Json
          channel_slack?: boolean
          channel_sms?: boolean
          channel_teams?: boolean
          channel_telegram?: boolean
          channel_webhook?: boolean
          channel_whatsapp?: boolean
          data_retention_days?: number | null
          digest_enabled?: boolean
          discord_webhook_url?: string | null
          drip_email_stage?: number
          drip_emails_enabled?: boolean
          email?: string | null
          enabled?: boolean
          escalation_enabled?: boolean
          escalation_minutes?: number
          feed_uptime_alerts_enabled?: boolean
          forecast_freeze_enabled?: boolean
          forecast_hours_ahead?: number
          freeze_drill_enabled?: boolean
          freeze_threshold_f?: number
          freeze_dwell_minutes?: number
          humidity_threshold?: number
          last_alert_sent_at?: string | null
          last_battery_alert_at?: string | null
          last_battery_trend_alert_at?: string | null
          last_drip_email_at?: string | null
          last_escalation_at?: string | null
          last_feed_uptime_alert_at?: string | null
          last_flood_alert_at?: string | null
          last_forecast_alert_at?: string | null
          last_freeze_drill_at?: string | null
          last_monthly_report_at?: string | null
          last_nws_alert_at?: string | null
          last_outage_alert_at?: string | null
          last_portfolio_alert_at?: string | null
          last_quarterly_report_at?: string | null
          last_rate_alert_at?: string | null
          last_rssi_alert_at?: string | null
          last_runway_alert_at?: string | null
          last_trial_reminder_at?: string | null
          monthly_report_enabled?: boolean
          ntfy_server?: string
          ntfy_topic?: string | null
          nws_freeze_alerts_enabled?: boolean
          outage_hours?: number
          outbound_webhook_secret?: string | null
          outbound_webhook_url?: string | null
          playbook_fired?: Json
          portfolio_alerts_enabled?: boolean
          pushover_app_token?: string | null
          pushover_user_key?: string | null
          quarterly_report_enabled?: boolean
          quiet_hours_bypass_freeze?: boolean
          quiet_hours_enabled?: boolean
          quiet_hours_end?: string
          quiet_hours_sms_critical?: boolean
          quiet_hours_start?: string
          quiet_hours_timezone?: string
          rate_change_f?: number
          reading_webhook_secret?: string | null
          reading_webhook_url?: string | null
          rssi_alerts_enabled?: boolean
          rssi_threshold?: number
          runway_alert_enabled?: boolean
          slack_webhook_url?: string | null
          sms_phone?: string | null
          snooze_until?: string | null
          space_channel_routing?: Json
          teams_webhook_url?: string | null
          telegram_bot_token?: string | null
          telegram_chat_id?: string | null
          telegram_command_secret?: string | null
          updated_at?: string
          user_id: string
          vacation_until?: string | null
          whatsapp_phone?: string | null
        }
        Update: {
          alert_playbooks?: Json
          alert_rules?: Json
          alert_templates?: Json
          battery_alerts_enabled?: boolean
          battery_threshold_pct?: number
          battery_trend_alerts_enabled?: boolean
          channel_discord?: boolean
          channel_email?: boolean
          channel_ntfy?: boolean
          channel_push?: boolean
          channel_pushover?: boolean
          channel_severity?: Json
          channel_slack?: boolean
          channel_sms?: boolean
          channel_teams?: boolean
          channel_telegram?: boolean
          channel_webhook?: boolean
          channel_whatsapp?: boolean
          data_retention_days?: number | null
          digest_enabled?: boolean
          discord_webhook_url?: string | null
          drip_email_stage?: number
          drip_emails_enabled?: boolean
          email?: string | null
          enabled?: boolean
          escalation_enabled?: boolean
          escalation_minutes?: number
          feed_uptime_alerts_enabled?: boolean
          forecast_freeze_enabled?: boolean
          forecast_hours_ahead?: number
          freeze_drill_enabled?: boolean
          freeze_threshold_f?: number
          freeze_dwell_minutes?: number
          humidity_threshold?: number
          last_alert_sent_at?: string | null
          last_battery_alert_at?: string | null
          last_battery_trend_alert_at?: string | null
          last_drip_email_at?: string | null
          last_escalation_at?: string | null
          last_feed_uptime_alert_at?: string | null
          last_flood_alert_at?: string | null
          last_forecast_alert_at?: string | null
          last_freeze_drill_at?: string | null
          last_monthly_report_at?: string | null
          last_nws_alert_at?: string | null
          last_outage_alert_at?: string | null
          last_portfolio_alert_at?: string | null
          last_quarterly_report_at?: string | null
          last_rate_alert_at?: string | null
          last_rssi_alert_at?: string | null
          last_runway_alert_at?: string | null
          last_trial_reminder_at?: string | null
          monthly_report_enabled?: boolean
          ntfy_server?: string
          ntfy_topic?: string | null
          nws_freeze_alerts_enabled?: boolean
          outage_hours?: number
          outbound_webhook_secret?: string | null
          outbound_webhook_url?: string | null
          playbook_fired?: Json
          portfolio_alerts_enabled?: boolean
          pushover_app_token?: string | null
          pushover_user_key?: string | null
          quarterly_report_enabled?: boolean
          quiet_hours_bypass_freeze?: boolean
          quiet_hours_enabled?: boolean
          quiet_hours_end?: string
          quiet_hours_sms_critical?: boolean
          quiet_hours_start?: string
          quiet_hours_timezone?: string
          rate_change_f?: number
          reading_webhook_secret?: string | null
          reading_webhook_url?: string | null
          rssi_alerts_enabled?: boolean
          rssi_threshold?: number
          runway_alert_enabled?: boolean
          slack_webhook_url?: string | null
          sms_phone?: string | null
          snooze_until?: string | null
          space_channel_routing?: Json
          teams_webhook_url?: string | null
          telegram_bot_token?: string | null
          telegram_chat_id?: string | null
          telegram_command_secret?: string | null
          updated_at?: string
          user_id?: string
          vacation_until?: string | null
          whatsapp_phone?: string | null
        }
        Relationships: []
      }
      alert_snooze_tokens: {
        Row: {
          created_at: string
          expires_at: string
          hours: number
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          hours?: number
          token: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          hours?: number
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          household_id: string
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          household_id: string
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          household_id?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      claims_pack_exports: {
        Row: {
          content_hash: string
          created_at: string
          expires_at: string | null
          generated_by: string | null
          household_id: string
          id: string
          pack_data: Json
          range_from: string
          range_to: string
          revoked_at: string | null
          token: string
        }
        Insert: {
          content_hash: string
          created_at?: string
          expires_at?: string | null
          generated_by?: string | null
          household_id: string
          id?: string
          pack_data: Json
          range_from: string
          range_to: string
          revoked_at?: string | null
          token: string
        }
        Update: {
          content_hash?: string
          created_at?: string
          expires_at?: string | null
          generated_by?: string | null
          household_id?: string
          id?: string
          pack_data?: Json
          range_from?: string
          range_to?: string
          revoked_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "claims_pack_exports_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_share_tokens: {
        Row: {
          created_at: string
          expires_at: string
          r2_key: string
          title: string | null
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          r2_key: string
          title?: string | null
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          r2_key?: string
          title?: string | null
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      history_saved_views: {
        Row: {
          created_at: string
          household_id: string | null
          id: string
          name: string
          params: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          household_id?: string | null
          id?: string
          name: string
          params?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          household_id?: string | null
          id?: string
          name?: string
          params?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "history_saved_views_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          admin_notes: string | null
          created_at: string | null
          email: string
          id: number
          message: string
          name: string
          status: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string | null
          email?: string
          id?: number
          message: string
          name?: string
          status?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string | null
          email?: string
          id?: number
          message?: string
          name?: string
          status?: string
        }
        Relationships: []
      }
      device_sensors: {
        Row: {
          created_at: string
          device_id: string
          id: string
          key: string
          kind: string
          label: string
          offset_num: number
          sort_order: number
          unit: string | null
          visible: boolean
        }
        Insert: {
          created_at?: string
          device_id: string
          id?: string
          key: string
          kind: string
          label: string
          offset_num?: number
          sort_order?: number
          unit?: string | null
          visible?: boolean
        }
        Update: {
          created_at?: string
          device_id?: string
          id?: string
          key?: string
          kind?: string
          label?: string
          offset_num?: number
          sort_order?: number
          unit?: string | null
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "device_sensors_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          created_at: string
          enabled: boolean
          household_id: string
          id: string
          ingest_key_hash: string | null
          ingest_key_prefix: string | null
          last_seen_at: string | null
          meta: Json
          name: string
          pull_url: string | null
          sort_order: number
          source: string
          space: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          household_id: string
          id?: string
          ingest_key_hash?: string | null
          ingest_key_prefix?: string | null
          last_seen_at?: string | null
          meta?: Json
          name: string
          pull_url?: string | null
          sort_order?: number
          source: string
          space?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          household_id?: string
          id?: string
          ingest_key_hash?: string | null
          ingest_key_prefix?: string | null
          last_seen_at?: string | null
          meta?: Json
          name?: string
          pull_url?: string | null
          sort_order?: number
          source?: string
          space?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      door_open_events: {
        Row: {
          closed_at: string | null
          created_at: string
          duration_ms: number | null
          household_id: string
          id: string
          label: string
          opened_at: string
          sensor_id: string | null
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          household_id: string
          id?: string
          label: string
          opened_at: string
          sensor_id?: string | null
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          household_id?: string
          id?: string
          label?: string
          opened_at?: string
          sensor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "door_open_events_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "door_open_events_sensor_id_fkey"
            columns: ["sensor_id"]
            isOneToOne: false
            referencedRelation: "device_sensors"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_uptime_checks: {
        Row: {
          checked_at: string
          feed_id: string
          feed_name: string
          id: number
          latency_ms: number | null
          message: string | null
          ok: boolean
          url: string
          user_id: string
        }
        Insert: {
          checked_at?: string
          feed_id: string
          feed_name: string
          id?: number
          latency_ms?: number | null
          message?: string | null
          ok: boolean
          url: string
          user_id: string
        }
        Update: {
          checked_at?: string
          feed_id?: string
          feed_name?: string
          id?: number
          latency_ms?: number | null
          message?: string | null
          ok?: boolean
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      freeze_map_snapshots: {
        Row: {
          avg_temp_f: number | null
          captured_at: string
          city_id: string
          city_label: string
          freeze_risk_count: number
          id: number
          lat: number | null
          lon: number | null
          min_temp_f: number | null
          sample_count: number
        }
        Insert: {
          avg_temp_f?: number | null
          captured_at?: string
          city_id: string
          city_label: string
          freeze_risk_count?: number
          id?: number
          lat?: number | null
          lon?: number | null
          min_temp_f?: number | null
          sample_count?: number
        }
        Update: {
          avg_temp_f?: number | null
          captured_at?: string
          city_id?: string
          city_label?: string
          freeze_risk_count?: number
          id?: number
          lat?: number | null
          lon?: number | null
          min_temp_f?: number | null
          sample_count?: number
        }
        Relationships: []
      }
      garage_temps: {
        Row: {
          feed_name: string | null
          humidity: number
          id: number
          probe_key: string | null
          probe_label: string | null
          tempc: number
          tempf: number
          timestamp: string
          user_id: string | null
        }
        Insert: {
          feed_name?: string | null
          humidity: number
          id?: number
          probe_key?: string | null
          probe_label?: string | null
          tempc: number
          tempf: number
          timestamp?: string
          user_id?: string | null
        }
        Update: {
          feed_name?: string | null
          humidity?: number
          id?: number
          probe_key?: string | null
          probe_label?: string | null
          tempc?: number
          tempf?: number
          timestamp?: string
          user_id?: string | null
        }
        Relationships: []
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      history_archives: {
        Row: {
          created_at: string
          household_id: string
          id: string
          object_key: string
          period_end: string
          period_start: string
          row_count: number
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          object_key: string
          period_end: string
          period_start: string
          row_count?: number
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          object_key?: string
          period_end?: string
          period_start?: string
          row_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "history_archives_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_activity: {
        Row: {
          action: string
          created_at: string
          detail: string | null
          household_id: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          detail?: string | null
          household_id: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          detail?: string | null
          household_id?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "household_activity_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_thermostat_connections: {
        Row: {
          access_token: string | null
          access_token_expires_at: string | null
          connected_by: string | null
          created_at: string
          external_device_id: string | null
          household_id: string
          id: string
          provider: string
          refresh_token: string
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          access_token_expires_at?: string | null
          connected_by?: string | null
          created_at?: string
          external_device_id?: string | null
          household_id: string
          id?: string
          provider: string
          refresh_token: string
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          access_token_expires_at?: string | null
          connected_by?: string | null
          created_at?: string
          external_device_id?: string | null
          household_id?: string
          id?: string
          provider?: string
          refresh_token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_thermostat_connections_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      thermostat_snapshots: {
        Row: {
          ambient_temp_f: number | null
          cool_setpoint_f: number | null
          external_device_id: string | null
          heat_setpoint_f: number | null
          household_id: string
          hvac_mode: string | null
          id: number
          meta: Json
          provider: string
          recorded_at: string
        }
        Insert: {
          ambient_temp_f?: number | null
          cool_setpoint_f?: number | null
          external_device_id?: string | null
          heat_setpoint_f?: number | null
          household_id: string
          hvac_mode?: string | null
          id?: number
          meta?: Json
          provider: string
          recorded_at?: string
        }
        Update: {
          ambient_temp_f?: number | null
          cool_setpoint_f?: number | null
          external_device_id?: string | null
          heat_setpoint_f?: number | null
          household_id?: string
          hvac_mode?: string | null
          id?: number
          meta?: Json
          provider?: string
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "thermostat_snapshots_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          household_id: string
          id: string
          invited_by: string | null
          role: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          household_id: string
          id?: string
          invited_by?: string | null
          role?: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          household_id?: string
          id?: string
          invited_by?: string | null
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_invites_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          created_at: string
          digest_opt_in: boolean
          household_id: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          digest_opt_in?: boolean
          household_id: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          digest_opt_in?: boolean
          household_id?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          freeze_map_city_id: string | null
          freeze_map_label: string | null
          freeze_map_lat: number | null
          freeze_map_lon: number | null
          freeze_map_opt_in: boolean
          id: string
          indoor_reference_sensor_id: string | null
          name: string
          tenant_notify_email: string | null
          tenant_notify_name: string | null
        }
        Insert: {
          created_at?: string
          freeze_map_city_id?: string | null
          freeze_map_label?: string | null
          freeze_map_lat?: number | null
          freeze_map_lon?: number | null
          freeze_map_opt_in?: boolean
          id?: string
          indoor_reference_sensor_id?: string | null
          name?: string
          tenant_notify_email?: string | null
          tenant_notify_name?: string | null
        }
        Update: {
          created_at?: string
          freeze_map_city_id?: string | null
          freeze_map_label?: string | null
          freeze_map_lat?: number | null
          freeze_map_lon?: number | null
          freeze_map_opt_in?: boolean
          id?: string
          indoor_reference_sensor_id?: string | null
          name?: string
          tenant_notify_email?: string | null
          tenant_notify_name?: string | null
        }
        Relationships: []
      }
      inbound_webhooks: {
        Row: {
          created_at: string
          created_by: string | null
          household_id: string
          id: string
          last_used_at: string | null
          name: string
          signing_secret: string | null
          token_hash: string
          token_prefix: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          household_id: string
          id?: string
          last_used_at?: string | null
          name?: string
          signing_secret?: string | null
          token_hash: string
          token_prefix: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          household_id?: string
          id?: string
          last_used_at?: string | null
          name?: string
          signing_secret?: string | null
          token_hash?: string
          token_prefix?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbound_webhooks_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      ingest_stats: {
        Row: {
          day: string
          device_id: string
          error_count: number
          success_count: number
        }
        Insert: {
          day: string
          device_id: string
          error_count?: number
          success_count?: number
        }
        Update: {
          day?: string
          device_id?: string
          error_count?: number
          success_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "ingest_stats_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      job_runs: {
        Row: {
          detail: Json
          finished_at: string | null
          id: number
          job_name: string
          started_at: string
          status: string
        }
        Insert: {
          detail?: Json
          finished_at?: string | null
          id?: number
          job_name: string
          started_at?: string
          status: string
        }
        Update: {
          detail?: Json
          finished_at?: string | null
          id?: number
          job_name?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      email_suppressions: {
        Row: {
          email: string
          reason: string
          last_error: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          email: string
          reason?: string
          last_error?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          email?: string
          reason?: string
          last_error?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      fcm_device_tokens: {
        Row: {
          app_id: string | null
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          app_id?: string | null
          created_at?: string
          id?: string
          platform?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          app_id?: string | null
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      puck_claim_pending: {
        Row: {
          bay_id: string
          created_at: string
          device_id: string
          expires_at: string
          nonce_hex: string
        }
        Insert: {
          bay_id: string
          created_at?: string
          device_id: string
          expires_at: string
          nonce_hex: string
        }
        Update: {
          bay_id?: string
          created_at?: string
          device_id?: string
          expires_at?: string
          nonce_hex?: string
        }
        Relationships: [
          {
            foreignKeyName: "puck_claim_pending_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: true
            referencedRelation: "pucks"
            referencedColumns: ["device_id"]
          },
        ]
      }
      pucks: {
        Row: {
          bay_id: string | null
          created_at: string
          created_by: string | null
          device_id: string
          household_id: string
          mood_override: string | null
          mood_override_at: string | null
          secret_hex: string
          space_name: string | null
          updated_at: string
        }
        Insert: {
          bay_id?: string | null
          created_at?: string
          created_by?: string | null
          device_id: string
          household_id: string
          mood_override?: string | null
          mood_override_at?: string | null
          secret_hex: string
          space_name?: string | null
          updated_at?: string
        }
        Update: {
          bay_id?: string | null
          created_at?: string
          created_by?: string | null
          device_id?: string
          household_id?: string
          mood_override?: string | null
          mood_override_at?: string | null
          secret_hex?: string
          space_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pucks_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_signups: {
        Row: {
          created_at: string
          id: string
          referred_user_id: string
          referrer_rewarded_at: string | null
          referrer_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          referred_user_id: string
          referrer_rewarded_at?: string | null
          referrer_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          referred_user_id?: string
          referrer_rewarded_at?: string | null
          referrer_user_id?: string
        }
        Relationships: []
      }
      sensor_reading_rollups: {
        Row: {
          avg_num: number | null
          bucket_start: string
          household_id: string
          max_num: number | null
          min_num: number | null
          sample_count: number
          sensor_id: string
        }
        Insert: {
          avg_num?: number | null
          bucket_start: string
          household_id: string
          max_num?: number | null
          min_num?: number | null
          sample_count?: number
          sensor_id: string
        }
        Update: {
          avg_num?: number | null
          bucket_start?: string
          household_id?: string
          max_num?: number | null
          min_num?: number | null
          sample_count?: number
          sensor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sensor_reading_rollups_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sensor_reading_rollups_sensor_id_fkey"
            columns: ["sensor_id"]
            isOneToOne: false
            referencedRelation: "device_sensors"
            referencedColumns: ["id"]
          },
        ]
      }
      sensor_readings: {
        Row: {
          household_id: string
          id: number
          meta: Json
          recorded_at: string
          sensor_id: string
          value_bool: boolean | null
          value_num: number | null
          value_text: string | null
        }
        Insert: {
          household_id: string
          id?: number
          meta?: Json
          recorded_at?: string
          sensor_id: string
          value_bool?: boolean | null
          value_num?: number | null
          value_text?: string | null
        }
        Update: {
          household_id?: string
          id?: number
          meta?: Json
          recorded_at?: string
          sensor_id?: string
          value_bool?: boolean | null
          value_num?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sensor_readings_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sensor_readings_sensor_id_fkey"
            columns: ["sensor_id"]
            isOneToOne: false
            referencedRelation: "device_sensors"
            referencedColumns: ["id"]
          },
        ]
      }
      server_errors: {
        Row: {
          created_at: string
          id: string
          message: string
          method: string
          path: string
          stack: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          method?: string
          path: string
          stack?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          method?: string
          path?: string
          stack?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      share_links: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          household_id: string
          id: string
          label: string | null
          scope: string
          token: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          household_id: string
          id?: string
          label?: string | null
          scope: string
          token: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          household_id?: string
          id?: string
          label?: string | null
          scope?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_links_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      status_notify_state: {
        Row: {
          id: number
          last_healthy: boolean | null
          updated_at: string
        }
        Insert: {
          id?: number
          last_healthy?: boolean | null
          updated_at?: string
        }
        Update: {
          id?: number
          last_healthy?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      status_page_tokens: {
        Row: {
          created_at: string
          household_id: string
          id: string
          label: string
          revoked_at: string | null
          token: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          label?: string
          revoked_at?: string | null
          token: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          label?: string
          revoked_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_page_tokens_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      status_subscriptions: {
        Row: {
          confirmed_at: string | null
          created_at: string
          email: string
          id: string
          token: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          email: string
          id?: string
          token: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          email?: string
          id?: string
          token?: string
        }
        Relationships: []
      }
      stripe_subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          plan_tier: string
          status: string
          stripe_customer_id: string
          stripe_price_id: string | null
          stripe_subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_tier?: string
          status: string
          stripe_customer_id: string
          stripe_price_id?: string | null
          stripe_subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_tier?: string
          status?: string
          stripe_customer_id?: string
          stripe_price_id?: string | null
          stripe_subscription_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mobile_oauth_exchanges: {
        Row: {
          created_at: string
          expires_at: string
          jti: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          jti: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          jti?: string
        }
        Relationships: []
      }
      stripe_webhook_events: {
        Row: {
          id: string
          received_at: string
          type: string
        }
        Insert: {
          id: string
          received_at?: string
          type: string
        }
        Update: {
          id?: string
          received_at?: string
          type?: string
        }
        Relationships: []
      }
      user_temp_feeds: {
        Row: {
          enabled: boolean
          feed_id: string
          id: number
          name: string
          sort_order: number
          url: string
          user_id: string
        }
        Insert: {
          enabled?: boolean
          feed_id: string
          id?: never
          name: string
          sort_order?: number
          url: string
          user_id: string
        }
        Update: {
          enabled?: boolean
          feed_id?: string
          id?: never
          name?: string
          sort_order?: number
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      user_temp_probes: {
        Row: {
          feed_id: string
          id: number
          label: string
          probe_id: string
          probe_key: string
          sort_order: number
          user_id: string
          visible: boolean
        }
        Insert: {
          feed_id: string
          id?: never
          label: string
          probe_id: string
          probe_key: string
          sort_order?: number
          user_id: string
          visible?: boolean
        }
        Update: {
          feed_id?: string
          id?: never
          label?: string
          probe_id?: string
          probe_key?: string
          sort_order?: number
          user_id?: string
          visible?: boolean
        }
        Relationships: []
      }
      webhook_deliveries: {
        Row: {
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          status_code: number | null
          success: boolean
          url_host: string
          user_id: string | null
          webhook_type: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          status_code?: number | null
          success?: boolean
          url_host: string
          user_id?: string | null
          webhook_type: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          status_code?: number | null
          success?: boolean
          url_host?: string
          user_id?: string | null
          webhook_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      count_managed_users: {
        Args: { caller_id: string; group_filter?: string | null; search_text?: string | null }
        Returns: number
      }
      get_user_household_id: {
        Args: { target_user_id: string }
        Returns: string
      }
      is_admin_user: { Args: { caller_id: string }; Returns: boolean }
      is_household_member: {
        Args: { target_household_id: string }
        Returns: boolean
      }
      list_managed_users: {
        Args: {
          caller_id: string
          group_filter?: string | null
          page_num?: number
          page_size?: number
          search_text?: string | null
          sort_by?: string | null
          sort_dir?: string | null
        }
        Returns: {
          created_at: string
          email: string
          groups: string[]
          is_admin: boolean
          user_id: string
        }[]
      }
      set_user_admin_membership: {
        Args: { caller_id: string; make_admin: boolean; target_user_id: string }
        Returns: undefined
      }
      sync_member_group_membership: {
        Args: { is_active: boolean; target_user_id: string }
        Returns: undefined
      }
      sync_plan_group_membership: {
        Args: { is_active: boolean; plan_tier: string; target_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
