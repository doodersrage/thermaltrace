/**
 * ThermalTrace probe: DS18B20 → push ingest, configured after flashing.
 *
 * Unlike the sketches under sketches/, nothing is compiled in. The Wi-Fi
 * network and the device key are set either:
 *   - over USB serial, by the flasher page:  TTCFG<TAB>ssid<TAB>password<TAB>key
 *   - or through the "ThermalTrace-Setup" Wi-Fi portal (captive page).
 * Hold the BOOT button for 5 seconds to erase both and start over.
 *
 * Every line the device prints for the flasher page starts with "TT ".
 * Wiring: DS18B20 data on ONE_WIRE_PIN (GPIO 4) with a 4.7k pull-up to 3.3V.
 * Up to four probes on the bus report as temp1..temp4.
 */
#include <Arduino.h>
#include <DallasTemperature.h>
#include <HTTPClient.h>
#include <OneWire.h>
#include <Preferences.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WiFiManager.h>

#ifndef FIRMWARE_VERSION
#define FIRMWARE_VERSION "1.0.0"
#endif
#ifndef INGEST_HOST
#define INGEST_HOST "thermaltrace.dev"
#endif
#ifndef ONE_WIRE_PIN
#define ONE_WIRE_PIN 4
#endif
#ifndef RESET_PIN
#define RESET_PIN 0
#endif

static const unsigned long POST_INTERVAL_MS = 60UL * 1000UL;
static const unsigned long RESET_HOLD_MS = 5000UL;
static const unsigned long WIFI_JOIN_TIMEOUT_MS = 20000UL;
static const unsigned long FIRST_POST_RETRY_MS = 5000UL;
static const unsigned long PORTAL_TIMEOUT_S = 180UL;
static const unsigned long OFFLINE_RESTART_MS = 60UL * 1000UL;
static const uint8_t MAX_PROBES = 4;
static const size_t MAX_KEY_LEN = 128;

OneWire oneWire(ONE_WIRE_PIN);
DallasTemperature probes(&oneWire);
Preferences prefs;
WiFiManager wifiManager;
WiFiManagerParameter keyParam("key", "Device key (Dashboard → Devices)", "", MAX_KEY_LEN);

String deviceKey;
String serialLine;
unsigned long lastPost = 0;
unsigned long resetHeldSince = 0;
unsigned long offlineSince = 0;
bool firstPostDone = false;
bool postNow = false;

/** Accept a bare key or a pasted ingest URL; keep only the key. */
String normalizeKey(String raw) {
  raw.trim();
  int marker = raw.indexOf("/api/ingest/");
  if (marker >= 0) raw = raw.substring(marker + 12);
  int cut = raw.indexOf('?');
  if (cut >= 0) raw = raw.substring(0, cut);
  while (raw.endsWith("/")) raw.remove(raw.length() - 1);
  raw.trim();
  if (raw.length() > MAX_KEY_LEN) return "";
  return raw;
}

void saveKey(const String &raw) {
  String key = normalizeKey(raw);
  if (key.isEmpty()) return;
  deviceKey = key;
  prefs.putString("key", deviceKey);
  Serial.println("TT key saved");
}

void onPortalParamsSaved() { saveKey(keyParam.getValue()); }

/** TTCFG<TAB>ssid<TAB>password<TAB>key, sent by the flasher page over USB. */
void handleConfigLine(const String &line) {
  int a = line.indexOf('\t');
  int b = a < 0 ? -1 : line.indexOf('\t', a + 1);
  int c = b < 0 ? -1 : line.indexOf('\t', b + 1);
  if (a < 0 || b < 0 || c < 0) {
    Serial.println("TT config error: expected TTCFG<TAB>ssid<TAB>password<TAB>key");
    return;
  }
  String ssid = line.substring(a + 1, b);
  String pass = line.substring(b + 1, c);
  String key = line.substring(c + 1);
  if (ssid.isEmpty() || normalizeKey(key).isEmpty()) {
    Serial.println("TT config error: network name and device key are required");
    return;
  }
  saveKey(key);

  Serial.println("TT wifi joining");
  wifiManager.stopConfigPortal();
  WiFi.mode(WIFI_STA);
  WiFi.persistent(true);
  WiFi.begin(ssid.c_str(), pass.c_str());
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < WIFI_JOIN_TIMEOUT_MS) {
    delay(250);
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("TT wifi ok");
    postNow = true;
  } else {
    Serial.println("TT wifi failed: check the network name and password (2.4 GHz only)");
  }
}

void readSerial() {
  while (Serial.available() > 0) {
    char ch = (char)Serial.read();
    if (ch == '\r') continue;
    if (ch == '\n') {
      if (serialLine.startsWith("TTCFG\t")) handleConfigLine(serialLine);
      else if (serialLine == "TTSTATUS") postNow = true;
      serialLine = "";
    } else if (serialLine.length() < 400) {
      serialLine += ch;
    }
  }
}

void checkResetButton() {
  if (digitalRead(RESET_PIN) == LOW) {
    if (resetHeldSince == 0) resetHeldSince = millis();
    if (millis() - resetHeldSince >= RESET_HOLD_MS) {
      Serial.println("TT reset: clearing Wi-Fi and device key");
      prefs.clear();
      wifiManager.resetSettings();
      delay(500);
      ESP.restart();
    }
  } else {
    resetHeldSince = 0;
  }
}

void postReadings() {
  probes.requestTemperatures();
  uint8_t found = probes.getDeviceCount();
  if (found > MAX_PROBES) found = MAX_PROBES;

  String body = "{";
  uint8_t sent = 0;
  for (uint8_t i = 0; i < found; i++) {
    float c = probes.getTempCByIndex(i);
    if (c == DEVICE_DISCONNECTED_C) continue;
    char field[32];
    snprintf(field, sizeof(field), "\"temp%u\":%.2f,", (unsigned)(i + 1), c * 9.0f / 5.0f + 32.0f);
    body += field;
    sent++;
  }
  if (sent == 0) {
    Serial.println("TT no probe: check the DS18B20 wiring and the 4.7k pull-up on GPIO " + String(ONE_WIRE_PIN));
    return;
  }
  body += "\"rssi\":" + String(WiFi.RSSI()) + "}";

  // Same trust model as the sample sketches: TLS without certificate pinning.
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.setTimeout(15000);
  if (!http.begin(client, String("https://") + INGEST_HOST + "/api/ingest/" + deviceKey)) {
    Serial.println("TT post failed: could not open connection");
    return;
  }
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(body);
  http.end();

  Serial.printf("TT post %d probes=%u\n", code, (unsigned)sent);
  if (code == 401 || code == 403 || code == 404) {
    Serial.println("TT key rejected: copy the device key again from Dashboard → Devices");
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(RESET_PIN, INPUT_PULLUP);
  probes.begin();
  prefs.begin("thermaltrace", false);
  deviceKey = prefs.getString("key", "");

  Serial.println();
  Serial.println("TT firmware " FIRMWARE_VERSION);

  wifiManager.addParameter(&keyParam);
  wifiManager.setSaveParamsCallback(onPortalParamsSaved);
  wifiManager.setConfigPortalBlocking(false);
  wifiManager.setConfigPortalTimeout(PORTAL_TIMEOUT_S);
  wifiManager.setConnectTimeout(30);
  wifiManager.setDebugOutput(false);
  if (wifiManager.autoConnect("ThermalTrace-Setup")) {
    Serial.println("TT wifi ok");
  } else {
    Serial.println("TT setup: send settings over USB, or join the ThermalTrace-Setup Wi-Fi network");
  }
}

void loop() {
  wifiManager.process();
  readSerial();
  checkResetButton();

  unsigned long now = millis();

  // A router that boots slower than this board (after a power cut) must not
  // leave the probe parked in the setup portal: once the portal has timed out
  // and Wi-Fi is still down, restart and try the saved network again.
  if (WiFi.status() == WL_CONNECTED || wifiManager.getConfigPortalActive()) {
    offlineSince = 0;
  } else if (offlineSince == 0) {
    offlineSince = now == 0 ? 1 : now;
  } else if (now - offlineSince >= OFFLINE_RESTART_MS) {
    Serial.println("TT wifi lost: restarting to retry");
    delay(200);
    ESP.restart();
  }

  if (!postNow) {
    unsigned long interval = firstPostDone ? POST_INTERVAL_MS : FIRST_POST_RETRY_MS;
    if (lastPost != 0 && now - lastPost < interval) return;
  }
  postNow = false;
  lastPost = now == 0 ? 1 : now;

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("TT waiting for wifi");
    return;
  }
  if (deviceKey.isEmpty()) {
    Serial.println("TT waiting for device key");
    return;
  }
  postReadings();
  firstPostDone = true;
}
