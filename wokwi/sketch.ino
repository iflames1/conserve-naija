/**
 * Conserve Naija recycling machine firmware (ESP32 / Wokwi).
 *
 * Same HTTP protocol as `cn-simulator`:
 *   Authorization: Device <key>
 *   POST /iot/devices/me/heartbeat
 *   POST /iot/devices/me/telemetry
 *   POST /iot/devices/me/sessions/claim            { "code": "482731" }
 *   POST /iot/devices/me/sessions/{id}/measurement { "material": "plastic", "weightKg": 2.5 }
 *
 * State machine:
 *   IDLE → ENTER_CODE → AUTHENTICATING → READY_FOR_DEPOSIT
 *        → MEASURING → PROCESSING → SUCCESS → RESET → IDLE
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Keypad.h>

const char* WIFI_SSID = "Wokwi-GUEST";
const char* WIFI_PASS = "";
// Laptop (VS Code + Private IoT Gateway): http://host.wokwi.internal:8080
// Public viewer / wokwi.com: HTTPS origin of cn-server, no trailing slash.
const char* API_HOST = "https://conserve-naija-production.up.railway.app";
const char* DEVICE_KEY = "cn-dev-yaba-device-key";
const char* MATERIAL = "plastic";
const char* FIRMWARE = "wokwi-0.3.4";

const uint8_t PIN_WEIGHT = 34;
const uint8_t PIN_WEIGH_BTN = 18;

enum MachineState {
  ST_IDLE,
  ST_ENTER_CODE,
  ST_AUTHENTICATING,
  ST_READY,
  ST_MEASURING,
  ST_PROCESSING,
  ST_SUCCESS,
  ST_ERROR,
  ST_RESET
};

LiquidCrystal_I2C lcd(0x27, 20, 4);

const byte ROWS = 4;
const byte COLS = 3;
char keys[ROWS][COLS] = {
  {'1', '2', '3'},
  {'4', '5', '6'},
  {'7', '8', '9'},
  {'C', '0', '#'}
};
byte rowPins[ROWS] = {13, 12, 14, 27};
byte colPins[COLS] = {26, 25, 33};
Keypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);

byte enterGlyph[8] = {
  0b00001,
  0b00001,
  0b00001,
  0b00101,
  0b01101,
  0b11111,
  0b01100,
  0b00100
};

MachineState state = ST_IDLE;
String code;
String sessionId;
String lastError;
float lastWeightKg = 0;
int lastGreenPoints = 0;
unsigned long stateEntered = 0;
unsigned long lastHeartbeat = 0;

void showCodeScreen(const String& shown) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("YOUR CODE");
  lcd.setCursor(0, 1);
  lcd.print(shown);
  lcd.setCursor(0, 2);
  lcd.print("C cancel ");
  lcd.write((uint8_t)0);
  lcd.print(" enter");
  Serial.printf("[ENTER_CODE] YOUR CODE | %s | C cancel  ⏎ enter\n", shown.c_str());
}

const char* stateName();

void show(const char* l0, const char* l1, const char* l2 = "", const char* l3 = "") {
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print(l0);
  lcd.setCursor(0, 1); lcd.print(l1);
  lcd.setCursor(0, 2); lcd.print(l2);
  lcd.setCursor(0, 3); lcd.print(l3);
  Serial.printf("[%s] %s | %s | %s | %s\n", stateName(), l0, l1, l2, l3);
}

const char* stateName() {
  switch (state) {
    case ST_IDLE: return "IDLE";
    case ST_ENTER_CODE: return "ENTER_CODE";
    case ST_AUTHENTICATING: return "AUTHENTICATING";
    case ST_READY: return "READY";
    case ST_MEASURING: return "MEASURING";
    case ST_PROCESSING: return "PROCESSING";
    case ST_SUCCESS: return "SUCCESS";
    case ST_ERROR: return "ERROR";
    case ST_RESET: return "RESET";
  }
  return "?";
}

void enter(MachineState next) {
  state = next;
  stateEntered = millis();
  switch (state) {
    case ST_IDLE:
      code = "";
      sessionId = "";
      show("CONSERVE NAIJA", "TURN IN PLASTIC", "Get a code first", "Type it here");
      break;
    case ST_ENTER_CODE:
      showCodeScreen(code);
      break;
    case ST_AUTHENTICATING:
      show("CONNECTING...", "Please wait.", "", "");
      break;
    case ST_READY:
      show("YOU'RE IN", "0.00 KG", "Put it on the scale", "Press WEIGH");
      break;
    case ST_MEASURING:
      show("WEIGHING...", "", "Hold still", "");
      break;
    case ST_PROCESSING:
      show("COUNTING IT UP", "Hang on.", "", "");
      break;
    case ST_SUCCESS:
      show("THAT'S IN", "", "Thank you", "");
      break;
    case ST_ERROR:
      show("CANNOT CONTINUE", lastError.c_str(), "Resetting...", "");
      break;
    case ST_RESET:
      show("TURN IN PLASTIC", "Waiting for next", "person...", "");
      break;
  }
}

String jsonGet(const String& body, const char* key) {
  String needle = String("\"") + key + "\":";
  int at = body.indexOf(needle);
  if (at < 0) return "";
  at += needle.length();
  while (at < (int)body.length() && (body[at] == ' ' || body[at] == '"')) {
    if (body[at] == '"') {
      int end = body.indexOf('"', at + 1);
      return end > at ? body.substring(at + 1, end) : "";
    }
    at++;
  }
  int end = at;
  while (end < (int)body.length() && (isDigit(body[end]) || body[end] == '.' || body[end] == '-')) {
    end++;
  }
  return body.substring(at, end);
}

bool postJson(const String& path, const String& body, String* response) {
  HTTPClient http;
  String url = String(API_HOST) + path;
  WiFiClientSecure tls;
  if (url.startsWith("https://")) {
    tls.setInsecure();
    http.begin(tls, url);
  } else {
    http.begin(url);
  }
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Device ") + DEVICE_KEY);
  int codeHttp = http.POST(body);
  String payload = http.getString();
  Serial.printf("%s -> %d %s\n", path.c_str(), codeHttp, payload.c_str());
  if (response) *response = payload;
  http.end();
  return codeHttp >= 200 && codeHttp < 300;
}

void heartbeat() {
  postJson("/iot/devices/me/heartbeat",
           String("{\"latitude\":6.5095,\"longitude\":3.3711,\"firmwareVersion\":\"") + FIRMWARE + "\"}",
           nullptr);
}

void telemetry(float binKg, int fill) {
  String body = "{\"location\":{\"latitude\":6.5095,\"longitude\":3.3711},\"bins\":[";
  body += "{\"material\":\"plastic\",\"weightKg\":";
  body += String(binKg, 1);
  body += ",\"fillPercent\":";
  body += String(fill);
  body += "}]}";
  postJson("/iot/devices/me/telemetry", body, nullptr);
}

float readWeightKg() {
  int raw = analogRead(PIN_WEIGHT);
  if (raw < 0) raw = 0;
  if (raw > 4095) raw = 4095;
  // Knob at rest = empty scale. Full turn = 5 kg.
  return (raw / 4095.0f) * 5.0f;
}

void claimSession() {
  String response;
  String body = String("{\"code\":\"") + code + "\"}";
  if (!postJson("/iot/devices/me/sessions/claim", body, &response)) {
    lastError = jsonGet(response, "error");
    if (lastError.length() > 20) lastError = lastError.substring(0, 20);
    if (lastError.length() == 0) lastError = "BAD CODE";
    enter(ST_ERROR);
    return;
  }
  sessionId = jsonGet(response, "sessionId");
  if (sessionId.length() == 0) {
    lastError = "NO CODE";
    enter(ST_ERROR);
    return;
  }
  enter(ST_READY);
}

void submitMeasurement(float kg) {
  lastWeightKg = kg;
  String path = String("/iot/devices/me/sessions/") + sessionId + "/measurement";
  String body = String("{\"material\":\"") + MATERIAL + "\",\"weightKg\":" + String(kg, 2) + "}";
  String response;
  enter(ST_PROCESSING);
  if (!postJson(path, body, &response)) {
    lastError = jsonGet(response, "error");
    if (lastError.length() == 0) lastError = "DEPOSIT FAILED";
    enter(ST_ERROR);
    return;
  }
  lastGreenPoints = jsonGet(response, "greenPoints").toInt();
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("DEPOSIT COMPLETE");
  lcd.setCursor(0, 1); lcd.print(String(lastWeightKg, 2) + " KG");
  lcd.setCursor(0, 2); lcd.print(String("+") + lastGreenPoints + " GP");
  lcd.setCursor(0, 3); lcd.print("Thank you!");
  state = ST_SUCCESS;
  stateEntered = millis();
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_WEIGH_BTN, INPUT_PULLUP);
  lcd.init();
  lcd.backlight();
  lcd.createChar(0, enterGlyph);
  show("CONSERVE NAIJA", "Connecting WiFi", "", "");
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(250);
    Serial.print(".");
  }
  Serial.println("\nwifi up");
  heartbeat();
  enter(ST_IDLE);
}

void loop() {
  unsigned long now = millis();
  if (now - lastHeartbeat > 8000) {
    lastHeartbeat = now;
    heartbeat();
    if (state == ST_IDLE) telemetry(40.0 + (now / 1000 % 40), 40);
  }

  char key = keypad.getKey();
  if (state == ST_IDLE && key) {
    if (key >= '0' && key <= '9') {
      code = String(key);
      enter(ST_ENTER_CODE);
    }
  } else if (state == ST_ENTER_CODE && key) {
    if (key == 'C' || key == '*') {
      code = "";
      enter(ST_ENTER_CODE);
    } else if (key == '#') {
      if (code.length() == 6) {
        enter(ST_AUTHENTICATING);
        claimSession();
      }
    } else if (key >= '0' && key <= '9' && code.length() < 6) {
      code += key;
      String pretty = code;
      while (pretty.length() < 6) pretty += "_";
      showCodeScreen(pretty);
    }
  }

  if (state == ST_READY) {
    float kg = readWeightKg();
    lcd.setCursor(0, 1);
    lcd.print(String(kg, 2) + " KG          ");
    lcd.setCursor(0, 2);
    lcd.print(kg < 0.1f ? "Add material     " : "Turn the scale   ");
    if (digitalRead(PIN_WEIGH_BTN) == LOW && kg >= 0.1f) {
      lastWeightKg = kg;
      enter(ST_MEASURING);
    }
  }

  if (state == ST_MEASURING) {
    lcd.setCursor(0, 1);
    lcd.print(String(lastWeightKg, 2) + " KG      ");
    if (now - stateEntered > 800) {
      submitMeasurement(lastWeightKg);
    }
  }

  if (state == ST_SUCCESS && now - stateEntered > 4000) {
    enter(ST_RESET);
  }
  if (state == ST_ERROR && now - stateEntered > 3500) {
    enter(ST_RESET);
  }
  if (state == ST_RESET && now - stateEntered > 1500) {
    enter(ST_IDLE);
  }
}
