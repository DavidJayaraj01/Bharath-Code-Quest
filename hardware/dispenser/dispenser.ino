#include <WiFi.h>
#include <HTTPClient.h>
#include <ESP32Servo.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <RTClib.h> // Simulating RTC module or NTP time check

// ── CONFIGURATION ──
#define SERVO_PIN 18
#define BTN_TAKE_PIN 19
#define LED_INDICATOR 2
#define TICK_INTERVAL_MS 1000

// BLE UUIDs for device pairing and WiFi provisioning
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define WIFI_SSID_CHAR_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define WIFI_PASS_CHAR_UUID "cba81900-36e1-4688-b7f5-ea07361b26a9"
#define DEVICE_ID_CHAR_UUID "dbb81901-36e1-4688-b7f5-ea07361b26aa"

// ── STATE VARIABLES ──
Servo dispenserServo;
RTC_Millis rtc;
String deviceId = "e11c5b51-1cdc-4e28-bfa1-1daf907e19e9"; // Hardcoded default or provisioning ID
String wifiSsid = "";
String wifiPass = "";
bool isProvisioned = false;
bool wifiConnected = false;
bool doseWindowOpen = false;

// Schedule: Dose hours (e.g. 08:00, 20:00)
const int scheduleHours[] = {8, 20};
const int scheduleSize = 2;
int lastDoseHour = -1;

BLECharacteristic *pSsidChar;
BLECharacteristic *pPassChar;
BLECharacteristic *pIdChar;

class ProvisioningCallbacks : public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
        std::string value = pCharacteristic->getValue();
        if (value.length() > 0) {
            if (pCharacteristic == pSsidChar) {
                wifiSsid = String(value.c_str());
                Serial.printf("SSID Received: %s\n", wifiSsid.c_str());
            } else if (pCharacteristic == pPassChar) {
                wifiPass = String(value.c_str());
                Serial.printf("Password Received: [REDACTED]\n");
                isProvisioned = true;
            } else if (pCharacteristic == pIdChar) {
                deviceId = String(value.c_str());
                Serial.printf("Device ID Registered: %s\n", deviceId.c_str());
            }
        }
    }
};

void setup() {
    Serial.begin(115200);
    
    // GPIO setup
    pinMode(BTN_TAKE_PIN, INPUT_PULLUP);
    pinMode(LED_INDICATOR, OUTPUT);
    digitalWrite(LED_INDICATOR, LOW);
    
    // Servo setup
    dispenserServo.attach(SERVO_PIN);
    dispenserServo.write(0); // Locked state (0 degrees)
    
    // RTC Setup (Starts at compile time, synced via NTP later)
    rtc.begin(DateTime(F(__DATE__), F(__TIME__)));
    Serial.println("RTC Initialized.");
    
    // BLE Provisioning Server Setup
    BLEDevice::init("VitalBridge_Dispenser");
    BLEServer *pServer = BLEDevice::createServer();
    BLEService *pService = pServer->createService(SERVICE_UUID);
    
    pSsidChar = pService->createCharacteristic(
        WIFI_SSID_CHAR_UUID,
        BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_WRITE
    );
    pPassChar = pService->createCharacteristic(
        WIFI_PASS_CHAR_UUID,
        BLECharacteristic::PROPERTY_WRITE
    );
    pIdChar = pService->createCharacteristic(
        DEVICE_ID_CHAR_UUID,
        BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_WRITE
    );
    
    ProvisioningCallbacks* callbacks = new ProvisioningCallbacks();
    pSsidChar->setCallbacks(callbacks);
    pPassChar->setCallbacks(callbacks);
    pIdChar->setCallbacks(callbacks);
    
    pService->start();
    BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(SERVICE_UUID);
    pAdvertising->setScanResponse(true);
    pAdvertising->setMinPreferred(0x06);
    pAdvertising->setMinPreferred(0x12);
    BLEDevice::startAdvertising();
    Serial.println("BLE Advertising started. Awaiting WiFi credentials...");
}

void connectToWiFi() {
    if (wifiSsid.length() == 0) return;
    
    Serial.printf("Connecting to WiFi: %s\n", wifiSsid.c_str());
    WiFi.begin(wifiSsid.c_str(), wifiPass.c_str());
    
    int retries = 0;
    while (WiFi.status() != WL_CONNECTED && retries < 15) {
        delay(1000);
        Serial.print(".");
        retries++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
        wifiConnected = true;
        Serial.println("\nWiFi Connected successfully!");
        digitalWrite(LED_INDICATOR, HIGH); // Steady light means connected
        delay(500);
        digitalWrite(LED_INDICATOR, LOW);
    } else {
        Serial.println("\nWiFi Connection failed.");
    }
}

void triggerDispenserUnlock() {
    Serial.println("Opening medication slot (unlocking hatch)...");
    dispenserServo.write(90); // 90 degrees = open hatch
    doseWindowOpen = true;
    
    // Slow blink LED to signal dose time
    for (int i = 0; i < 10; i++) {
        digitalWrite(LED_INDICATOR, HIGH);
        delay(300);
        digitalWrite(LED_INDICATOR, LOW);
        delay(300);
    }
}

void lockDispenser() {
    Serial.println("Locking medication slot...");
    dispenserServo.write(0); // 0 degrees = locked
    doseWindowOpen = false;
    digitalWrite(LED_INDICATOR, LOW);
}

void sendDoseConfirmationToBackend() {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("Cannot sync: WiFi not connected.");
        return;
    }
    
    HTTPClient http;
    String serverPath = "http://192.168.1.100:8000/api/iot/devices/" + deviceId + "/take-dose"; // Swap IP for backend URL
    
    Serial.printf("Sending dose confirmation to: %s\n", serverPath.c_str());
    http.begin(serverPath.c_str());
    
    int httpResponseCode = http.POST("");
    if (httpResponseCode > 0) {
        Serial.printf("HTTP Response code: %d\n", httpResponseCode);
    } else {
        Serial.printf("Error code: %s\n", http.errorString(httpResponseCode).c_str());
    }
    http.end();
}

void sendMissedDoseNotification() {
    if (WiFi.status() != WL_CONNECTED) return;
    
    HTTPClient http;
    String serverPath = "http://192.168.1.100:8000/api/iot/devices/" + deviceId + "/miss-dose";
    
    http.begin(serverPath.c_str());
    int httpResponseCode = http.POST("");
    http.end();
    Serial.printf("Missed dose event logged with code: %d\n", httpResponseCode);
}

void loop() {
    // 1. Check for newly written credentials via BLE
    if (isProvisioned && !wifiConnected) {
        connectToWiFi();
        isProvisioned = false; // Reset trigger
    }
    
    // Get current RTC time
    DateTime now = rtc.now();
    
    // 2. Schedule Check: Unlock dispenser if schedule is met
    for (int i = 0; i < scheduleSize; i++) {
        if (now.hour() == scheduleHours[i] && now.minute() == 0 && lastDoseHour != now.hour()) {
            lastDoseHour = now.hour();
            triggerDispenserUnlock();
            break;
        }
    }
    
    // 3. User interaction check
    if (doseWindowOpen) {
        // If button is pressed (hatch close / dose taken)
        if (digitalRead(BTN_TAKE_PIN) == LOW) {
            Serial.println("Dose Taken detected by physical button press.");
            lockDispenser();
            sendDoseConfirmationToBackend();
        }
        
        // Timeout: If dose is not taken within 30 minutes (simulated as 30 seconds for quick testing)
        // Check if 30 seconds have passed in open window
        static unsigned long windowStart = 0;
        if (windowStart == 0) {
            windowStart = millis();
        }
        
        if (millis() - windowStart > 30000) {
            Serial.println("Dose Window Expired. Marking as MISSED.");
            lockDispenser();
            sendMissedDoseNotification();
            windowStart = 0;
        }
    }
    
    delay(TICK_INTERVAL_MS);
}
