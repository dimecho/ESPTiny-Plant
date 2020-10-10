#include <EEPROM.h>
#include <LittleFS.h>
#include <StreamString.h>
#include <ESP8266WiFi.h>
#include <DNSServer.h>
#include <ESPAsyncTCP.h>
#include <ESPAsyncWebServer.h>
//#include <CapacitiveSensor.h>
#include <Ticker.h>
#include "version.h"

#define DEBUG                       false
#define EEPROM_ID                   0x3BDAB900 //Identify Sketch by EEPROM

//ESP-01
//Pin 1 = Rx = GPIO3
//Pin 8 = Tx = GPIO1

#ifdef ARDUINO_ESP8266_NODEMCU
#define pumpPin                     5  //Output (D1 NodeMCU)
#else
#define pumpPin                     3  //RX Output
#endif
#ifdef ARDUINO_ESP8266_NODEMCU
#define sensorPin                   4  //Output (D2 NodeMCU)
#else
#define sensorPin                   1  //TX Output
#endif
#ifdef ARDUINO_ESP8266_NODEMCU
#define watersensorPin              12  //Output (D6 NodeMCU)
#else
#define watersensorPin              3  //RX Output
#endif
#ifdef ARDUINO_ESP8266_NODEMCU
#define ledPin                      2  //Output (D4 NodeMCU)
#else
#define ledPin                      1  //Output
#endif
#define moistureSensorPin           A0  //Input
//#define deepsleepPin                16  //GPIO16 to RESET (D0 NodeMCU)

#define delayBetweenRefillReset     7200000000  //2 x 60 x 60 x 1000000 = 2 hours
#define delayBetweenOverfloodReset  28800000000 //8 x 60 x 60 x 1000000 = 8 hours
#define UART_BAUDRATE               115200

#define text_html "text/html"
#define text_plain "text/plain"
#define text_json  "application/json"

//The total RTC memory of ESP8266 is 512 bytes
struct {
  byte sleepReason;
  uint32_t syncTimer;
  uint8_t emptyBottle;
  uint16_t moistureLog;
  uint16_t errorCode;
} rtcData;

uint32_t syncTimer = 0; //Active loop slow down
uint32_t webTimer = 0; //Timer to track last webpage access
uint32_t wifiTimer = 0; //Timer to track SSID broadcast time

Ticker blinkTick;
volatile uint8_t blinkDuration;

AsyncWebServer server(80);
DNSServer dnsServer;

uint8_t WIFI_PHY_MODE = 1; //WIFI_PHY_MODE_11B = 1, WIFI_PHY_MODE_11G = 2, WIFI_PHY_MODE_11N = 3
uint8_t WIFI_PHY_POWER = 1; //Max = 20.5dBm (some ESP modules 24.0dBm)
uint8_t ACCESS_POINT_MODE = 0;
char ACCESS_POINT_SSID[] = "Plant";
char ACCESS_POINT_PASSWORD[] = "";
uint8_t ACCESS_POINT_CHANNEL = 7;
uint8_t ACCESS_POINT_HIDE = 0;
uint8_t DATA_LOG = 0; //Enable data logger
uint32_t LOG_INTERVAL = 30; //Seconds between data collection and write to Filesystem
uint8_t NETWORK_DHCP = 0;
char NETWORK_IP[] = "192.168.8.8";
char NETWORK_SUBNET[] = "255.255.255.0";
char NETWORK_GATEWAY[] = "192.168.8.8";
char NETWORK_DNS[] = "192.168.8.8";
uint8_t PLANT_POT_SIZE = 2; //Seconds of pump
uint16_t PLANT_SOIL_MOISTURE = 640; //ADC value
uint32_t PLANT_MANUAL_TIMER = 0; //Hours
uint8_t PLANT_SOIL_TYPE = 2; //['Sand', 'Clay', 'Dirt', 'Loam', 'Moss'];
uint8_t PLANT_LED = 0; //LED
uint32_t DEEP_SLEEP = 8; //8 seconds
int8_t ADC_ERROR_OFFSET = 0; //Wire length, resistance, etc - unit individual, not changed by user
//=============================
uint32_t WIFI_SLEEP = 4; //4 minutes
uint32_t WEB_SLEEP = 5; //5 minutes
//=============================
bool restartRequired = false;  // Set this flag in the callbacks to restart ESP in the main loop

const char update_html[] PROGMEM = "<!DOCTYPE html><html><head></head><body><form method='POST' action='/update' enctype='multipart/form-data'><input type='file' accept='.bin' name='firmware'><input type='submit' value='Update Firmware'></form><br><form method='POST' action='/update' enctype='multipart/form-data'><input type='file' accept='.bin' name='filesystem'><input type='submit' value='Update Filesystem'></form></body></html>";

ADC_MODE(ADC_TOUT);
//ADC_MODE(ADC_VCC);

uint8_t wakeupReason = 0;

uint16_t div3(uint16_t n);

void setup()
{
  //pinMode(deepsleepPin, WAKEUP_PULLUP);

  pinMode(pumpPin, OUTPUT);
  digitalWrite(pumpPin, LOW);

  pinMode(sensorPin, OUTPUT);
  digitalWrite(sensorPin, LOW);

  pinMode(ledPin, OUTPUT);
  digitalWrite(ledPin, HIGH);
  //digitalWrite(ledPin, LOW);

  /*
    REANSON_DEFAULT_RST = 0, // normal startup by power on
    REANSON_WDT_RST = 1, // hardware watch dog reset
    REANSON_EXCEPTION_RST = 2, // exception reset, GPIO status won't change
    REANSON_SOFT_WDT_RST = 3, // software watch dog reset, GPIO status won't change
    REANSON_SOFT_RESTART = 4, // software restart ,system_restart , GPIO status won't change
    REANSON_DEEP_SLEEP_AWAKE = 5, // wake up from deep-sleep
    REANSON_HARDWARE_RST = 6, // wake up by RST to GND
  */

  struct rst_info *rstInfo = system_get_rst_info();
  wakeupReason = rstInfo->reason;

  // Read struct from RTC memory
  //system_rtc_mem_read(0, &rtcData, sizeof(rtcData));
  ESP.rtcUserMemoryRead(0, (uint32_t*) &rtcData, sizeof(rtcData));

  /*
    Power Saving Tips:

    - CH-PD/EN with a 10k/12K resistor to VCC
    - Some ESP8266 (12E DOITING) require GPIO15 to GND (10k/12K to GND)
    - Use a Schottky Diode (preferred) between GPIO16 to RST or 470Ohm/680Ohm/1K
    - Change the beacon time inside ESP8266WiFiAp.cpp, search for beacon_interval, hardcode to 1000
  */

  /*
    uint16_t vdd = ESP.getVcc();
    #if DEBUG
      Serial.println("Internal Voltage:" + vdd);
    #endif
  */

#if DEBUG
  Serial.begin(UART_BAUDRATE, SERIAL_8N1);
  //Serial.setDebugOutput(true);
  Serial.println("Wakeup Reason:");
  Serial.println(wakeupReason);
  //printMemory();
#endif

  LittleFS.begin();

  //======================
  //NVRAM type of Settings
  //======================
  EEPROM.begin(1024);
  long e = NVRAM_Read(0).toInt();
#if DEBUG
  Serial.print("EEPROM CRC Stored: 0x");
  Serial.println(e, HEX);
  Serial.print("EEPROM CRC Calculated: 0x");
  Serial.println(EEPROM_ID, HEX);
#endif
  if (e != EEPROM_ID) {
    //Check for multiple Plant SSIDs
    uint8_t n = WiFi.scanNetworks();
    if (n != 0) {
      for (uint8_t i = 0; i < n; ++i) {
#if DEBUG
        Serial.println(WiFi.SSID(i));
#endif
        if (WiFi.SSID(i) == ACCESS_POINT_SSID) {
          strcat(ACCESS_POINT_SSID, String("-" + i).c_str()); //avoid conflict
          break;
        }
      }
    }
    NVRAM_Erase();
    NVRAM_Write(0, String(EEPROM_ID));
    NVRAM_Write(1, String(ACCESS_POINT_MODE));
    NVRAM_Write(2, String(ACCESS_POINT_HIDE));
    NVRAM_Write(3, String(WIFI_PHY_MODE));
    NVRAM_Write(4, String(WIFI_PHY_POWER));
    NVRAM_Write(5, String(ACCESS_POINT_CHANNEL));
    NVRAM_Write(6, ACCESS_POINT_SSID);
    NVRAM_Write(7, ACCESS_POINT_PASSWORD);
    NVRAM_Write(8, String(DATA_LOG));
    NVRAM_Write(9, String(LOG_INTERVAL));
    //==========
    NVRAM_Write(10, String(NETWORK_DHCP));
    NVRAM_Write(11, NETWORK_IP);
    NVRAM_Write(12, NETWORK_SUBNET);
    NVRAM_Write(13, NETWORK_GATEWAY);
    NVRAM_Write(14, NETWORK_DNS);
    //==========
    NVRAM_Write(15, String(PLANT_POT_SIZE));
    NVRAM_Write(16, String(PLANT_SOIL_MOISTURE));
    NVRAM_Write(17, String(PLANT_MANUAL_TIMER));
    NVRAM_Write(18, String(PLANT_SOIL_TYPE));
    NVRAM_Write(19, String(PLANT_LED));
    NVRAM_Write(20, String(DEEP_SLEEP));
    NVRAM_Write(21, String(ADC_ERROR_OFFSET));
    //==========

    LittleFS.format();
  } else {
    String nvram = "";
    ACCESS_POINT_MODE = NVRAM_Read(1).toInt();
    ACCESS_POINT_HIDE = NVRAM_Read(2).toInt();
    WIFI_PHY_MODE = NVRAM_Read(3).toInt();
    WIFI_PHY_POWER = NVRAM_Read(4).toInt();
    ACCESS_POINT_CHANNEL = NVRAM_Read(5).toInt();
    nvram = NVRAM_Read(6);
    nvram.toCharArray(ACCESS_POINT_SSID, nvram.length() + 1);
    nvram = NVRAM_Read(7);
    nvram.toCharArray(ACCESS_POINT_PASSWORD, nvram.length() + 1);
    DATA_LOG = NVRAM_Read(8).toInt();
    LOG_INTERVAL = NVRAM_Read(9).toInt();
    //==========
    NETWORK_DHCP = NVRAM_Read(10).toInt();
    nvram = NVRAM_Read(11);
    nvram.toCharArray(NETWORK_IP, nvram.length() + 1);
    nvram = NVRAM_Read(12);
    nvram.toCharArray(NETWORK_SUBNET, nvram.length() + 1);
    nvram = NVRAM_Read(13);
    nvram.toCharArray(NETWORK_GATEWAY, nvram.length() + 1);
    nvram = NVRAM_Read(14);
    nvram.toCharArray(NETWORK_DNS, nvram.length() + 1);
    //==========
    PLANT_POT_SIZE = NVRAM_Read(15).toInt();
    PLANT_SOIL_MOISTURE = NVRAM_Read(16).toInt();
    PLANT_MANUAL_TIMER = NVRAM_Read(17).toInt();
    PLANT_SOIL_TYPE = NVRAM_Read(18).toInt();
    PLANT_LED = NVRAM_Read(19).toInt();
    DEEP_SLEEP = NVRAM_Read(20).toInt();
    ADC_ERROR_OFFSET = NVRAM_Read(21).toInt();
  }
  //EEPROM.end();

  PLANT_MANUAL_TIMER = PLANT_MANUAL_TIMER * 60 * 1000000;
  DEEP_SLEEP = DEEP_SLEEP * 1000000;
  LOG_INTERVAL = LOG_INTERVAL * 1000;

  if (wakeupReason == 5 && rtcData.sleepReason == 0) {
    LOG_INTERVAL = 0;
    WIFI_SLEEP = 0;
    WEB_SLEEP = 0;

  } else {

    //Emergency Recover
    if (wakeupReason == 0 || wakeupReason == 6) {
      LOG_INTERVAL = 60 * 10 * 1000; //10 minutes do not shut off WiFi
      blinky(2000, 1, 0);
    }

    WIFI_SLEEP = WIFI_SLEEP * 60 * 1000;
    WEB_SLEEP = WEB_SLEEP * 60 * 1000;

    //Forcefull Wakeup
    //-------------------
    //WiFi.persistent(false);
    //WiFi.setSleepMode(WIFI_NONE_SLEEP);
    //WiFi.forceSleepWake();
    //-------------------

    WiFi.setPhyMode((WiFiPhyMode_t)WIFI_PHY_MODE);
    WiFi.setOutputPower(WIFI_PHY_POWER);

    IPAddress ip, gateway, subnet, dns;
    ip.fromString(NETWORK_IP);
    subnet.fromString(NETWORK_SUBNET);
    gateway.fromString(NETWORK_GATEWAY);
    dns.fromString(NETWORK_DNS);

    if (ACCESS_POINT_MODE == 0) {
      //=====================
      //WiFi Access Point Mode
      //=====================
      WiFi.mode(WIFI_AP);
      WiFi.softAPConfig(ip, gateway, subnet);
      WiFi.softAP(ACCESS_POINT_SSID, ACCESS_POINT_PASSWORD, ACCESS_POINT_CHANNEL, ACCESS_POINT_HIDE);

#if DEBUG
      Serial.println(WiFi.softAPIP());
      Serial.println(WiFi.macAddress());

      softap_config config;
      wifi_softap_get_config(&config);

      Serial.println(F("SoftAP Configuration"));
      Serial.println(F("-----------------------------"));
      Serial.print(F("ssid:            ")); Serial.println((char *) config.ssid);
      Serial.print(F("password:        ")); Serial.println((char *) config.password);
      Serial.print(F("ssid_len:        ")); Serial.println(config.ssid_len);
      Serial.print(F("channel:         ")); Serial.println(config.channel);
      Serial.print(F("authmode:        ")); Serial.println(config.authmode);
      Serial.print(F("ssid_hidden:     ")); Serial.println(config.ssid_hidden);
      Serial.print(F("max_connection:  ")); Serial.println(config.max_connection);
      Serial.print(F("beacon_interval: ")); Serial.println((String)config.beacon_interval + "(ms)");
      Serial.println(F("-----------------------------"));
#endif
      //==========
      //DNS Server
      //==========
      dnsServer.setErrorReplyCode(DNSReplyCode::NoError);
      dnsServer.start(53, "*", WiFi.softAPIP());
    } else {
      //================
      //WiFi Client Mode
      //================
      WiFi.mode(WIFI_STA);
      if (NETWORK_DHCP == 0) {
        WiFi.config(ip, dns, gateway, subnet);
      }
      WiFi.begin(ACCESS_POINT_SSID, ACCESS_POINT_PASSWORD);  //Connect to the WiFi network

      //WiFi.setAutoConnect(false);
      WiFi.setAutoReconnect(true);
      //WiFi.enableAP(0);
      while (WiFi.waitForConnectResult() != WL_CONNECTED) {
#if DEBUG
        Serial.println("Connection Failed! Rebooting...");
#endif
        //If client mode fails ESP8266 will not be accessible
        //Set Emergency AP SSID for re-configuration
        NVRAM_Write(1, "0");
        NVRAM_Write(6, "_" + String(ACCESS_POINT_SSID));
        delay(5000);
        ESP.restart();
      }
#if DEBUG
      Serial.println(WiFi.localIP());
#endif
    }

    //wifiTimer = millis();

    //===============
    //Async Web Server
    //===============
    server.on("/hotspot-detect.html", [](AsyncWebServerRequest * request) {
      if (LittleFS.exists("/index.html")) {
        AsyncWebServerResponse *response = request->beginResponse(LittleFS, "/index.html", text_html);
        response->addHeader("Content-Encoding", "gzip");
        request->send(response);
      } else {
        request->send_P(200, "text/html", update_html);
      }
    });
    server.on("/chipid", HTTP_GET, [](AsyncWebServerRequest * request) {
      AsyncResponseStream *response = request->beginResponseStream(text_plain);
      response->printf("Chip ID = 0x%08X\n", ESP.getChipId());
      request->send(response);
    });
    server.on("/format", HTTP_GET, [](AsyncWebServerRequest * request) {
      FSInfo fs_info;
      String result = LittleFS.format() ? "OK" : "Error";
      LittleFS.info(fs_info);
      request->send(200, text_plain, "<b>Format " + result + "</b><br/>Total Flash Size: " + String(ESP.getFlashChipSize()) + "<br>Filesystem Size: " + String(fs_info.totalBytes) + "<br>Filesystem Used: " + String(fs_info.usedBytes));
    });
    server.on("/pump", HTTP_GET, [](AsyncWebServerRequest * request) {
      runPump();
      request->send(200, text_plain, String(PLANT_POT_SIZE));
    });
    server.on("/adc", HTTP_GET, [](AsyncWebServerRequest * request) {
      uint16_t moisture = sensorRead(sensorPin);
      request->send(200, text_plain, String(moisture));
      //request->send(200, text_plain, String(moisture) + " (" + String(PLANT_SOIL_MOISTURE) + ")");
    });
    server.on("/adc2", HTTP_GET, [](AsyncWebServerRequest * request) {
     //CapacitiveSensor cs = CapacitiveSensor(sensorPin, moistureSensorPin);
     //cs.set_CS_AutocaL_Millis(0xFFFFFFFF); // turn off autocalibrate
     uint16_t moisture = 0; // cs.capacitiveSensor(30);
     
      request->send(200, text_plain, String(moisture));
    });
    server.on("/adc-offset", HTTP_GET, [](AsyncWebServerRequest * request) {
      if (request->params() > 0) {
        int8_t i = request->getParam(0)->value().toInt();
        ADC_ERROR_OFFSET = i;
        NVRAM_Write(21, String(ADC_ERROR_OFFSET));
      }
      request->send(200, text_plain, String(ADC_ERROR_OFFSET));
    });
    server.on("/reset", HTTP_GET, [](AsyncWebServerRequest * request) {
      NVRAM_Erase();
      //LittleFS.format();
      restartRequired = true;
      request->send(200, text_plain, "...");
    });
    server.on("/clearlog", HTTP_GET, [](AsyncWebServerRequest * request) {
      LittleFS.remove("data.log");
      request->send(200, text_plain, "...");
    });
    server.on("/nvram", HTTP_GET, [](AsyncWebServerRequest * request) {
      if (request->params() > 0) {
        int i = request->getParam(0)->value().toInt();
        String v = request->getParam(1)->value();
        NVRAM_Write(i, v);
        request->send(200, text_plain, v);
      } else {
        String out = NVRAM(1, 20, 7);
        request->send(200, text_json, out);
      }
    });
    server.on("/nvram", HTTP_POST, [](AsyncWebServerRequest * request) {

      String out = "<pre>";
      uint8_t c = 0, from = 0, to = 0;
      uint8_t skip = -1;

      //skip confirm password (8)
      from = 1, to = 14, skip = 8;

      for (uint8_t i = from; i <= to; i++) {

        String v = request->getParam(c)->value();

        if (skip == -1 || i < skip) {
          out += request->getParam(c)->name() + ": ";
          NVRAM_Write(i, v);
          out += NVRAM_Read(i) + "\n";
        } else if (i > skip) {
          out += request->getParam(c)->name() + ": ";
          NVRAM_Write(i - 1, v);
          out += NVRAM_Read(i - 1) + "\n";
        }

        c++;
      }

      out += "\n...Rebooting";
      out += "</pre>";

      restartRequired = true;

      AsyncWebServerResponse *response = request->beginResponse(200,  text_html, out);

      if (request->hasParam("WiFiIP", true)) { //IP has changed
        response->addHeader("Refresh", "12; url=http://" + request->getParam("WiFiIP", true)->value() + "/index.html");
      } else {
        response->addHeader("Refresh", "10; url=/index.html");
      }
      request->send(response);
    });

    server.on("/update", HTTP_GET, [](AsyncWebServerRequest * request) {
      webTimer = millis();
      request->send_P(200, text_html, update_html);
    });

    server.on("/update", HTTP_POST, [](AsyncWebServerRequest * request) {
      if (Update.hasError()) {
        StreamString str;
        Update.printError(str);
        request->send(200,  text_plain, String("Update error: ") + str.c_str());
      } else {

        restartRequired = true;

        AsyncWebServerResponse *response = request->beginResponse(200,  text_html, "Update Success! Rebooting...");
        response->addHeader("Refresh", "15; url=/");
        request->send(response);
      }
    }, WebUpload);

    server.on("/", [](AsyncWebServerRequest * request) {
      if (LittleFS.exists("/index.html")) {
        request->redirect("/index.html");
      } else {
        AsyncWebServerResponse *response = request->beginResponse(200, text_html, "File System Not Found ...");
        response->addHeader("Refresh", "6; url=/update");
        request->send(response);
      }
    });

    server.onNotFound([](AsyncWebServerRequest * request) {
      //Serial.println((request->method() == HTTP_GET) ? "GET" : "POST");

      webTimer = millis();

      String file = request->url();

#if DEBUG
      Serial.println("Request:" + file);
#endif

      if (LittleFS.exists(file))
      {
        String contentType = getContentType(file);

        AsyncWebServerResponse *response = request->beginResponse(LittleFS, file, contentType);
        if (!file.endsWith(".log")) {
          response->addHeader("Content-Encoding", "gzip");
        }
        //response->addHeader("Cache-Control", "max-age=3600");
        request->send(response);

      } else {
        request->send(404, text_plain, "404: Not Found");
      }
    });

    server.begin(); // Web server start

    //ArduinoOTA.begin();
    blinky(500, 2, 0); //Alive blink
  }
}

void loop()
{
  dnsServer.processNextRequest();

  yield();

  if (restartRequired) {
#if DEBUG
    Serial.println("Restarting ESP");
#endif
    delay(1000);
    //WiFi.disconnect(true);  //Erases SSID/password
    //ESP.eraseConfig();
    ESP.restart();
  }

  if (millis() - syncTimer < LOG_INTERVAL) return;

  /*
     IMPORTANT!
     Make sure that the input voltage on the A0 pin doesn’t exceed 1.0V
  */
  uint16_t moisture = sensorRead(sensorPin);
  //uint16_t moisture = getAnalog();

  if (PLANT_LED == 1) {
    //=======================
    //LED MORSE CODE
    //=======================
    //for (uint16_t i = 1000 ; i >= 1; i=div10(i)) {
    for (uint8_t i = 100 ; i >= 1; i /= 10) {
      uint8_t d = (moisture / i) % 10;
      blinky(400, d, 0); //blink a zero with a quick pulse
      delay(1200);
    }
  }

  if (PLANT_MANUAL_TIMER == 0 && moisture > 10) {

    if (moisture < PLANT_SOIL_MOISTURE) { //Water Plant
      //===================
      //Detect Empty Bottle (Sensor-less)
      //===================

      //uint8_t m = moisture / 10;
      rtcData.moistureLog = rtcData.moistureLog + moisture;

      uint16_t mm = div3(rtcData.moistureLog); //Average 3
      //uint16_t mm = (moistureLog >> 2); //Average 4

      if (mm > (moisture - 10) && mm < (moisture + 10)) {
        rtcData.emptyBottle = 11; //Pump ran but no change in moisture
        //continue; //force next wait loop
      }

      rtcData.errorCode = mm;

      //===================
      //Detect Empty Bottle (Sensored)
      //===================
      /*
          loopback wire from water jug to A0 powered from GPIO12
      */
      //moisture = sensorRead(watersensorPin);

      if (rtcData.emptyBottle < 3) { //Prevent flooding
        runPump();
        rtcData.emptyBottle++; //Sensorless Empty Detection
      } else {
        dataLog("O:" + String(rtcData.emptyBottle));
      }
      //}else if(moisture == 1024) { //Emergency reset (short two sensor electrodes)
      //  NVRAM_Erase();
      //  ESP.restart();
    } else {
      rtcData.syncTimer = 0;
      rtcData.emptyBottle = 0;
      rtcData.moistureLog = 0;
      rtcData.errorCode = 0;
    }
  }

  dataLog(String(moisture));
  //WiFi.printDiag();

  if (millis() - wifiTimer > WIFI_SLEEP)
  {
    int clientCount = 0;
    if (WIFI_SLEEP != 0) {
      clientCount = WiFi.softAPgetStationNum();
    }
    //Note: default station inactivity timer for soft-AP is set to 5 minutes
    if (clientCount == 0)
    {
      if (rtcData.emptyBottle >= 3) { //Low Water LED
        blinky(900, 254, 1);
        return;

        if ((rtcData.emptyBottle > 10 && (rtcData.syncTimer + millis()) > delayBetweenRefillReset) || (rtcData.emptyBottle < 10 && (rtcData.syncTimer + millis()) > delayBetweenOverfloodReset)) {
          blinkDuration = 0;
          rtcData.syncTimer = 0;
          rtcData.emptyBottle = 0;
          rtcData.moistureLog = 0;
        } else {
          uint32_t halfhour = 30 * 60 * 1000000; //30 minutes in millis
          rtcData.syncTimer += millis() + halfhour; //when it wakes up it will have proper time to compare
          rtcData.sleepReason = 0;
          ESP.rtcUserMemoryWrite(0, (uint32_t*) &rtcData, sizeof(rtcData));
          ESP.deepSleep(halfhour, WAKE_RF_DISABLED);
        }
      }

      rtcData.sleepReason = 0;
      //system_rtc_mem_write(0, &rtcData, sizeof(rtcData));
      ESP.rtcUserMemoryWrite(0, (uint32_t*) &rtcData, sizeof(rtcData));

      if (PLANT_MANUAL_TIMER == 0) {
        if (moisture <= 14) { //Sensor Not in Soil
          blinky(200, 6, 0);
          //WiFi.setSleepMode(WIFI_NONE_SLEEP); //wifi_set_sleep_type(NONE_SLEEP_T);
          //WiFi.setSleepMode(WIFI_LIGHT_SLEEP); //wifi_set_sleep_type(LIGHT_SLEEP_T);
          //WiFi.setSleepMode(WIFI_MODEM_SLEEP); //wifi_set_sleep_type(MODEM_SLEEP_T); //woken up automatically
          //WiFi.mode(WIFI_OFF);
          //WiFi.forceSleepBegin();

          rtcData.sleepReason = 1;
          //system_rtc_mem_write(0, &rtcData, sizeof(rtcData));
          ESP.rtcUserMemoryWrite(0, (uint32_t*) &rtcData, sizeof(rtcData));

          //GPIO16 needs to be tied to RST to wake from deepSleep
          //ESP.deepSleepInstant(DEEP_SLEEP, WAKE_RF_DEFAULT); //WAKE_RF_DEFAULT, WAKE_RFCAL, WAKE_NO_RFCAL, WAKE_RF_DISABLED
          ESP.deepSleep(DEEP_SLEEP, WAKE_NO_RFCAL); //Will wake up with radio
        } else {
          ESP.deepSleep(DEEP_SLEEP, WAKE_RF_DISABLED); //Will wake up without radio
        }
      } else {
        runPump();
        ESP.deepSleep(PLANT_MANUAL_TIMER, WAKE_RF_DISABLED); //Will wake up without radio
      }

    } else {
      wifiTimer = millis(); //Reset timer if client connected

      if (millis() - webTimer > WEB_SLEEP) //go to sleep after 10 minutes of web inactivity
      {
        rtcData.sleepReason = 1;
        //system_rtc_mem_write(0, &rtcData, sizeof(rtcData));
        ESP.rtcUserMemoryWrite(0, (uint32_t*) &rtcData, sizeof(rtcData));

        ESP.deepSleep(DEEP_SLEEP, WAKE_NO_RFCAL); //Will wake up with radio
      }
    }
  }

  syncTimer = millis();

  //Debug.handle();
  //server.handleClient();
  //ArduinoOTA.handle();
}

uint16_t div3(uint16_t n) {
  uint16_t q = 0;
  while (1) {
    if (!(n >>= 1)) return q;
    q += n;
    if (!(n >>= 1)) return q;
    q -= n;
  }
}

/*
uint16_t getAnalog() {

  uint16_t result = 0;

  uint16_t num_samples = 512;
  uint16_t adc_addr[num_samples]; // point to the address of ADC continuously fast sampling output
  uint16_t adc_num = num_samples; // sampling number of ADC continuously fast sampling, range [1, 65535]
  uint8_t adc_clk_div = 8; // ADC working clock = 80M/adc_clk_div, range [8, 32], the recommended value is 8

  wifi_set_opmode(NULL_MODE);
  system_soft_wdt_stop();
  ets_intr_lock(); //close interrup
  noInterrupts();

  //result = system_adc_read();
  system_adc_read_fast(adc_addr, adc_num, adc_clk_div);

  interrupts();
  ets_intr_unlock(); //open interrup
  system_soft_wdt_restart();

  for (int j = 0; j < adc_num;  j++) {
      #if DEBUG
        Serial.println(adc_addr[j]);
      #endif

      if (adc_addr[j] > result) {
        result = adc_addr[j];
      }
  }

  return result;
}
*/

void dataLog(String text)
{
  if (DATA_LOG == 1) {
    FSInfo fs_info;
    LittleFS.info(fs_info);
    if (fs_info.usedBytes < fs_info.totalBytes) {
      File file = LittleFS.open("data.log", "a");
      file.print(text);
      file.print('\n');
      file.close();
      //} else {
      //  LittleFS.remove("data.log");
    }
  }
}

void runPump()
{
#if DEBUG
  Serial.println("MOISTURE LIMIT:" + String(PLANT_SOIL_MOISTURE));
  Serial.println("TIMER:" + String(PLANT_MANUAL_TIMER));
#endif

  digitalWrite(pumpPin, HIGH); //ON
  uint8_t duration = PLANT_POT_SIZE;
  do {
    delay(1000);
    duration--;
  } while (duration > 0);
  digitalWrite(pumpPin, LOW); //OFF
 
 dataLog("T:" + String(PLANT_MANUAL_TIMER) + ",M:" + String(PLANT_SOIL_MOISTURE));
}

uint16_t sensorRead(uint8_t enablePin)
{
  //A0 conflicts with WiFi Module.
  //-----------------
  if(ADC_ERROR_OFFSET == -1) { //Use WiFi with A0 (20k resistor required)
    WiFi.disconnect();
    WiFi.setSleepMode(WIFI_NONE_SLEEP);
  }
  //WiFi.mode(WIFI_OFF);
  //-----------------

  /*
    adcAttachPin(moistureSensorPin);
    analogReadResolution(11);
    analogSetAttenuation(ADC_6db);
  */
  analogRead(moistureSensorPin); //Discharge any capacitance
  
  digitalWrite(enablePin, HIGH); //ON
  //uint16_t result = analogRead(moistureSensorPin) + ADC_ERROR_OFFSET;
  //uint16_t result  = getAnalog() + ADC_ERROR_OFFSET;
  uint16_t result = readADC() + ADC_ERROR_OFFSET;
  digitalWrite(enablePin, LOW); //OFF

  //WiFi.reconnect();

#if DEBUG
  Serial.println(result);
#endif

  return result;
}

uint16_t readADC()
{
  //0.1uF (103 or 104) cap between ADC and GND
  //A0 sensitivity is different for ESP-Modules
  //ADC conversions in about 6-10 microseconds 

  /*
    A0 -> 10K to GND (20k for NodeMCU)
  */
  //=============
  //Take Lowest
  //=============

  uint16_t result = 1024;
  for (uint8_t i = 0; i < 8; i++) {
    //delay(1);
    int a = analogRead(moistureSensorPin);
    if (a < result) {
      result = a;
    }
  }

  //=============
  //Average
  //=============
  /*
    uint16_t result = 0;
    for (uint8_t i = 0; i < 8; i++) {
    //if (i < 8) { //throw away first 8 conversions
     //   analogRead(moistureSensorPin);
    //} else { //average the other 8 conversions
      result += analogRead(moistureSensorPin);
    //}
    }
    //result = (result >> 4); //Average 16 using Shift 4
    result = (result >> 3); //Average 8 using Shift 3
  */

  return result;
}
/*
  char* string2char(String command) {
  if (command.length() != 0) {
    char *p = const_cast<char*>(command.c_str());
    return p;
  }
  }
*/

void blinkThread()
{
  //All variables that are used by interrupt service routine declared as "volatile"

  digitalWrite(ledPin, !digitalRead(ledPin));
  blinkDuration--;

  if (blinkDuration == 0) {
    blinkTick.detach();
  }
}

void blinky(uint16_t timer, uint8_t duration, uint8_t threaded)
{
  if (duration == 0) {
    duration = 2;
    timer = 1000;
  }

  if (threaded > 0 && blinkDuration == 0) { //skip if already blinking
    blinkDuration = duration * 2; //toggle style
    blinkTick.attach(timer, blinkThread);
  } else {

    /*
        LED swapped HIGH with LOW
        LED is shared with GPIO2. ESP will need GPIO2 on HIGH level in order to boot.
    */

    do  {
      //digitalWrite(ledPin, HIGH); //ON
      digitalWrite(ledPin, LOW); //ON
      delay(timer);
      //digitalWrite(ledPin, LOW); //OFF
      digitalWrite(ledPin, HIGH); //OFF
      delay(timer);
      duration--;
    } while (duration);
  }
}
//=============
// NVRAM CONFIG
//=============
String NVRAM(uint8_t from, uint8_t to, uint8_t skip)
{
  String out = "{\n";

  out += "\t\"nvram\": [\"";
  out += _VERSION;
  out += "\",";

  for (uint8_t i = from; i <= to; i++) {
    if (skip == -1 || i != skip) {
      out += "\"" + NVRAM_Read(i) + "\",";
    }
  }

  out = out.substring(0, (out.length() - 1));
  out += "]\n}";

  return out;
}

void NVRAM_Erase()
{
  for (uint16_t i = 0 ; i < EEPROM.length() ; i++) {
    EEPROM.write(i, 255);
  }
  EEPROM.commit();
}

void NVRAM_Write(uint32_t address, String txt)
{
  char arrayToStore[32];
  memset(arrayToStore, 0, sizeof(arrayToStore));
  txt.toCharArray(arrayToStore, sizeof(arrayToStore)); // Convert string to array.

  EEPROM.put(address * sizeof(arrayToStore), arrayToStore);
  EEPROM.commit();
}

String NVRAM_Read(uint32_t address)
{
  char arrayToStore[32];
  EEPROM.get(address * sizeof(arrayToStore), arrayToStore);

  return String(arrayToStore);
}

String getContentType(String filename)
{
  if (filename.endsWith(".htm")) return text_html;
  else if (filename.endsWith(".html")) return text_html;
  else if (filename.endsWith(".css")) return "text/css";
  else if (filename.endsWith(".js")) return "application/javascript";
  else if (filename.endsWith(".png")) return "image/png";
  else if (filename.endsWith(".jpg")) return "image/jpeg";
  else if (filename.endsWith(".ico")) return "image/x-icon";
  else if (filename.endsWith(".svg")) return "image/svg+xml";
  return text_plain;
}

//===============
//Web OTA Updater
//===============
void WebUpload(AsyncWebServerRequest *request, String filename, size_t index, uint8_t *data, size_t len, bool final)
{
  if (!index) {
    //Serial.print(request->params());

    if (filename.indexOf("fs") != - 1) {
      //if (request->hasParam("filesystem",true)) {
      size_t fsSize = ((size_t) &_FS_end - (size_t) &_FS_start);
#if DEBUG
      Serial.printf("Free Filesystem Space: %u\n", fsSize);
      Serial.printf("Filesystem Flash Offset: %u\n", U_FS);
#endif
      close_all_fs();

      Update.begin(fsSize, U_FS); //start with max available size

    } else {
      uint32_t maxSketchSpace = (ESP.getFreeSketchSpace() - 0x1000) & 0xFFFFF000; //calculate sketch space required for the update
#if DEBUG
      Serial.printf("Free Scketch Space: %u\n", maxSketchSpace);
#endif
      Update.begin(maxSketchSpace, U_FLASH); //start with max available size
    }
    Update.runAsync(true); // tell the updaterClass to run in async mode
  }

  Update.write(data, len);

  if (final) {
    if (!Update.end(true)) {
      Update.printError(Serial);
    }
  }
}

//prints all rtcMemory, including the leading crc32
/*
  void printMemory() {
  char buf[3];
  uint8_t *ptr = (uint8_t *)&rtcMemory;
  for (size_t i = 0; i < sizeof(rtcMemory); i++) {
    sprintf(buf, "%02X", ptr[i]);
    Serial.print(buf);
    if ((i + 1) % 32 == 0) {
      Serial.println();
    } else {
      Serial.print(" ");
    }
  }
  Serial.println();
  }
*/
