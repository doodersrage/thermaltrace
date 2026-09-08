interface ImportMetaEnv {
  readonly SUPABASE_URL: string;
  readonly SUPABASE_ANON_KEY: string;
  readonly SUPABASE_SERVICE_ROLE_KEY?: string;
  /** ThermalTrace GitHub OAuth app (direct sign-in, bypasses Supabase GitHub provider). */
  readonly GITHUB_CLIENT_ID?: string;
  readonly GITHUB_CLIENT_SECRET?: string;
  readonly GARAGE_TEMP_FEED_URL?: string;
  /** Preferred server-only OpenWeather credentials. */
  readonly OPENWEATHER_API_KEY?: string;
  readonly OPENWEATHER_CITY_ID?: string;
  readonly AMBIENT_APPLICATION_KEY?: string;
  readonly TURNSTILE_SITE_KEY?: string;
  readonly TURNSTILE_SECRET_TOKEN?: string;
  readonly SMTP_MAIL_FROM?: string;
  readonly SMTP_MAIL_TO?: string;
  readonly STRIPE_SECRET_KEY?: string;
  readonly STRIPE_WEBHOOK_SECRET?: string;
  readonly STRIPE_PRICE_ID?: string;
  readonly STRIPE_PRICE_ID_PRO?: string;
  readonly STRIPE_PRICE_ID_ANNUAL?: string;
  readonly STRIPE_PRICE_ID_PRO_ANNUAL?: string;
  readonly STRIPE_PRICE_ID_PORTFOLIO?: string;
  readonly STRIPE_PRICE_ID_PORTFOLIO_ANNUAL?: string;
  readonly STRIPE_DISPLAY_MEMBER_MONTHLY?: string;
  readonly STRIPE_DISPLAY_MEMBER_ANNUAL?: string;
  readonly STRIPE_DISPLAY_PRO_MONTHLY?: string;
  readonly STRIPE_DISPLAY_PRO_ANNUAL?: string;
  readonly STRIPE_DISPLAY_PORTFOLIO_MONTHLY?: string;
  readonly STRIPE_DISPLAY_PORTFOLIO_ANNUAL?: string;
  readonly SITE_URL?: string;
  readonly ORIGIN?: string;
  readonly CRON_SECRET?: string;
  /** Optional dedicated HMAC secrets (preferred over CRON_SECRET). */
  readonly MFA_STEPUP_SECRET?: string;
  readonly ALERT_ACK_SECRET?: string;
  readonly MOBILE_EXCHANGE_SECRET?: string;
  readonly TWILIO_ACCOUNT_SID?: string;
  readonly TWILIO_AUTH_TOKEN?: string;
  readonly TWILIO_FROM_NUMBER?: string;
  readonly VAPID_PUBLIC_KEY?: string;
  readonly VAPID_PRIVATE_KEY?: string;
  readonly VAPID_SUBJECT?: string;
  /** Full Firebase service account JSON (preferred) for FCM HTTP v1 */
  readonly FCM_SERVICE_ACCOUNT_JSON?: string;
  readonly FCM_PROJECT_ID?: string;
  readonly FCM_CLIENT_EMAIL?: string;
  readonly FCM_PRIVATE_KEY?: string;
  readonly OPS_DISCORD_WEBHOOK_URL?: string;
  readonly DISCORD_OPS_WEBHOOK_URL?: string;
  readonly PRICING_DEFAULT_INTERVAL?: string;
  readonly GA_MEASUREMENT_ID?: string;
  readonly SENTRY_DSN?: string;
  readonly PUBLIC_SENTRY_DSN?: string;
  readonly SENTRY_AUTH_TOKEN?: string;
  readonly SENTRY_ORG?: string;
  readonly SENTRY_PROJECT?: string;
  readonly TWILIO_WHATSAPP_FROM?: string;
  readonly NEST_ACCESS_TOKEN?: string;
  readonly ECOBEE_ACCESS_TOKEN?: string;
  readonly YUBICO_CLIENT_ID?: string;
  readonly YUBICO_API_KEY?: string;
  readonly PUBLIC_PLAY_STORE_URL?: string;
  /** Amazon Associates tag for BOM buy links (optional; appended as `tag=`). */
  readonly PUBLIC_AMAZON_ASSOCIATE_TAG?: string;
  readonly AMAZON_ASSOCIATE_TAG?: string;
  /** AES-GCM encryption secret for recoverable push ingest keys (32+ chars recommended). */
  readonly INGEST_KEY_ENCRYPTION_SECRET?: string;
  readonly PROD: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
