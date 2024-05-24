/*
NodeMCU 0.9 (ESP-12 Module)  > blue 16 pins
NodeMCU 1.0 (ESP-12E Module) > black 22 pins

Remember: Brand new ESP-12 short GPIO0 to GND (flash mode) then UART TX/RX
*/

#include "semver/version.h"

#define DEBUG 0
#define THREADED 0
//#define ARDUINO_SIGNING 0
#define EEPROM_ID 0x3BDAB918  //Identify Sketch by EEPROM
#define ASYNCWEBSERVER_SSL 0
#define ASYNCWEBSERVER_DNS 0
/*
NOTE for HTTPS

   Need to fix ESPAsyncTCP library
   1) Modify line 5 in async_config.h to #define ASYNCWEBSERVER_SSL 1
   2) Modify line 279 in ESPAsyncTCP.cpp
   from

  return connect(IPAddress(addr.addr), port);

  to

  #if ASYNCWEBSERVER_SSL
      return connect(IPAddress(addr.addr), port, secure);
  #else
      return connect(IPAddress(addr.addr), port);
  #endif
*/

#define ASYNCWEBSERVER_REGEX 0  //<regex> will add 100k to binary
/*
  To Activate RegEx:
  
  MacOS: ~/Library/Arduino15/packages/esp8266/hardware/esp8266/3.1.1/platform.txt
  Windows: C:\Users\<username>\AppData\Local\Arduino15\packages\esp8266\hardware\esp8266\3.1.1\platform.txt

  compiler.cpp.extra_flags=-DASYNCWEBSERVER_REGEX=1
*/

#define SPIFFS LittleFS
#include <LittleFS.h>
#include <Updater.h>
//#define ATOMIC_FS_UPDATE  //gzip works with 4MB (FS: 1MB, OTA ~1019kB)
/*
  Notes: signed and gzip binary do not work well together, SDK 3.0.x seem to break gzip

  To Activate LittleFS gzip binary
  
  MacOS: ~/Library/Arduino15/packages/esp8266/hardware/esp8266/3.1.1/platform.txt
  Windows: C:\Users\<username>\AppData\Local\Arduino15\packages\esp8266\hardware\esp8266\3.1.1\platform.txt

  build.extra_flags=-DESP8266 -DATOMIC_FS_UPDATE
*/

/*
#if FLASH_MAP_SUPPORT && ADRUINO_SIGNING
  FLASH_MAP_SETUP_CONFIG(FLASH_MAP_OTA_FS) //-DFLASH_MAP_SUPPORT=1
#endif
*/
#if (ARDUINO_ESP8266_MAJOR <= 3 && ARDUINO_ESP8266_MINOR < 1)
#include <StreamString.h>
#endif
//#include <ArduinoOTA.h>
#include <EEPROM.h>
#ifdef ESP32
#include <ESP32Ticker.h>
#include <WiFi.h>
#include <AsyncTCP.h>
#include <AsyncUDP.h>
#elif defined(ESP8266)
#include <Ticker.h>
#include <ESP8266WiFi.h>
#include <ESPAsyncTCP.h>
#include <ESPAsyncUDP.h>
#endif
#include <NTPClient.h>
#include <WiFiUDP.h>
extern "C" {
#include "user_interface.h"
#include "wpa2_enterprise.h"
}
//#include <coredecls.h> //for disable_extra4k_at_link_timer()
#include <umm_malloc/umm_heap_select.h>

//IMPORTANT: ESP8266 that don't have external SRAM/PSRAM chip installed choose the MMU option 3, 16KB cache + 48KB IRAM and 2nd Heap (shared)
#include <ESP_Mail_Client.h>  //ESP-12E SRAM:64KB

//Must be defined globally, otherwise "Fatal exception 28(LoadProhibitedCause)"
SMTPSession smtp;
ESP_Mail_Session session;
SMTP_Message message;

#include <ESPAsyncWebServer.h>
#if ASYNCWEBSERVER_DNS
#include <ESPAsyncDNSServer.h>
#else
#include <ESP8266mDNS.h>
#endif
//#include <CapacitiveSensor.h>
//#include <time.h>

#if ASYNCWEBSERVER_SSL
String HTTPS_FQDN = "esp.tinyplant.ca";  //SSL certificate match CN

AsyncWebServer httpserver(80);
AsyncWebServer server(443);

const uint8_t SSLPrivateKey[] = {};   //0x71, ...
const uint8_t SSLCertificate[] = {};  //0xA9, ...
#else
AsyncWebServer server(80);
#endif

#if ASYNCWEBSERVER_DNS
AsyncDNSServer dnsServer;
#endif
//ESP-01
//Pin 1 = Rx = GPIO3
//Pin 8 = Tx = GPIO1

#if defined ARDUINO_ESP8266_NODEMCU_ESP12 || defined ARDUINO_ESP8266_NODEMCU_ESP12E || defined ARDUINO_ESP8266_GENERIC
#define pumpPin 5  //Output (D1 NodeMCU)
#else
#define pumpPin 3  //Output
#endif
#if defined ARDUINO_ESP8266_NODEMCU_ESP12 || defined ARDUINO_ESP8266_NODEMCU_ESP12E || defined ARDUINO_ESP8266_GENERIC
#define sensorPin 4  //Output (D2 NodeMCU)
#else
#define sensorPin 1  //Output
#endif
#if defined ARDUINO_ESP8266_NODEMCU_ESP12 || defined ARDUINO_ESP8266_NODEMCU_ESP12E || defined ARDUINO_ESP8266_GENERIC
#define watersensorPin_25 14  //Output (D5 NodeMCU)
#define watersensorPin_50 12  //Output (D6 NodeMCU)
#define watersensorPin_75 13  //Output (D7 NodeMCU)
#define watersensorPin_100 15 //Output (D8 NodeMCU)
#else
#define watersensorPin_25 3  //Output
#define watersensorPin_50 3  //Output
#define watersensorPin_75 3  //Output
#define watersensorPin_100 3 //Output
#endif
#if defined ARDUINO_ESP8266_NODEMCU_ESP12 || defined ARDUINO_ESP8266_NODEMCU_ESP12E || defined ARDUINO_ESP8266_GENERIC
#define ledPin 2  //Output (D4 NodeMCU)
#else
#define ledPin 1  //Output
#endif
#define moistureSensorPin A0  //Input
//#define deepsleepPin                16  //GPIO16 to RESET (D0 NodeMCU)

#define UART_BAUDRATE 115200

//ADC_MODE(ADC_TOUT); //Sensor input measuring
//ADC_MODE(ADC_VCC);  //Self voltage measuring
ADC_MODE(get_adc());  //Analog to Digital Converter (cannot be both)

//Executed very early on startup, variable defined within the get_adc function
uint32_t get_adc() {
  uint32_t adc_mode;
  ESP.rtcUserMemoryRead(100, &adc_mode, sizeof(adc_mode));
  if ((adc_mode != ADC_VCC) && (adc_mode != ADC_TOUT)) return ADC_TOUT;
  return adc_mode;
}
uint32_t ADCMODE;  //Global variable

#if THREADED
#include <Ticker.h>
void blinkThread();  //void ICACHE_RAM_ATTR
volatile uint16_t blinkDuration = 0;
Ticker blinkTick;
struct _blink {
  uint8_t toggle;
  uint16_t timer;
  uint16_t duration;
};
#else
static uint16_t blinkDuration = 0;
#endif
bool blinkEmpty = false;

#define text_html "text/html"
#define text_plain "text/plain"
#define text_json "application/json"
#define locked_html "Locked"
#define refresh_http "Refresh"
#define content_length "Content-Length"

/*
----------------
Integer Maximums
----------------
uint8 = 0 - 127
uint16 = 0 - 32,767
uint32 = 0 - 2,147,483,647
*/

/*
The total RTC memory of ESP8266 is 512 bytes, 0 to 127, 4 bytes each

The bootloader command will be stored into the first 128 bytes of user RTC memory,
then it will be retrieved by eboot on boot. That means that user data present there will be lost.
RTC offset: 128 / 4 = 32
*/
struct {
  uint32_t runTime;      //shedule tracking wifi on/off
  uint8_t ntpWeek;       //NTP day of week
  uint8_t ntpHour;       //NTP hour
  uint8_t emptyBottle;   //empty tracking
  uint16_t waterTime;    //pump tracking
  uint16_t moistureLog;  //moisture average tracking
  uint16_t alertTime;    //prevent email spam
} rtcData;

uint32_t loopTimer = 0;  //loop() slow down
uint32_t webTimer = 0;  //track last webpage access

bool testPump = false;
bool testSMTP = false;

#define _EEPROM_ID 0
#define _WIRELESS_MODE 1
#define _WIRELESS_HIDE 2
#define _WIRELESS_PHY_MODE 3
#define _WIRELESS_PHY_POWER 4
#define _WIRELESS_CHANNEL 5
#define _WIRELESS_SSID 6
#define _WIRELESS_USERNAME 7
#define _WIRELESS_PASSWORD 8
#define _DATA_LOG 9
#define _LOG_INTERVAL 10
#define _NETWORK_DHCP 11
#define _NETWORK_IP 12
#define _NETWORK_SUBNET 13
#define _NETWORK_GATEWAY 14
#define _NETWORK_DNS 15
#define _PLANT_POT_SIZE 16
#define _PLANT_SOIL_MOISTURE 17
#define _PLANT_MANUAL_TIMER 18
#define _PLANT_SOIL_TYPE 19
#define _PLANT_TYPE 20
#define _DEEP_SLEEP 21
#define _EMAIL_ALERT 22
#define _SMTP_SERVER 23
#define _SMTP_USERNAME 24
#define _SMTP_PASSWORD 25
#define _PLANT_NAME 26
#define _ALERTS 27
#define _DEMO_PASSWORD 28
#define _TIMEZONE_OFFSET 29
#define _DEMO_AVAILABILITY 30
#define _PNP_ADC 31

const int NVRAM_Map[] = {
  16,  //_EEPROM_ID
  8,   //_WIRELESS_MODE
  8,   //_WIRELESS_HIDE
  8,   //_WIRELESS_PHY_MODE
  8,   //_WIRELESS_PHY_POWER
  8,   //_WIRELESS_CHANNEL
  16,  //_WIRELESS_SSID
  32,  //_WIRELESS_USERNAME
  32,  //_WIRELESS_PASSWORD
  8,   //_DATA_LOG
  32,  //_LOG_INTERVAL
  8,   //_NETWORK_DHCP
  16,  //_NETWORK_IP
  16,  //_NETWORK_SUBNET
  16,  //_NETWORK_GATEWAY
  16,  //_NETWORK_DNS
  16,   //_PLANT_POT_SIZE
  16,   //_PLANT_SOIL_MOISTURE
  32,  //_PLANT_MANUAL_TIMER
  16,   //_PLANT_SOIL_TYPE
  16,   //_PLANT_TYPE
  32,  //_DEEP_SLEEP
  64,  //_EMAIL_ALERT
  64,  //_SMTP_SERVER
  32,  //_SMTP_USERNAME
  32,  //_SMTP_PASSWORD
  32,  //_PLANT_NAME
  16,  //_ALERTS
  32,  //_DEMO_PASSWORD
  16,  //_TIMEZONE_OFFSET
  16,  //_DEMO_AVAILABILITY
  16   //_PNP_ADC
};

uint8_t WIRELESS_MODE = 0;  //WIRELESS_AP = 0, WIRELESS_STA(WPA2) = 1, WIRELESS_STA(WPA2 ENT) = 2, WIRELESS_STA(WEP) = 3
//uint8_t WIRELESS_HIDE = 0;
uint8_t WIRELESS_PHY_MODE = 2;   //WIRELESS_PHY_MODE_11B = 1, WIRELESS_PHY_MODE_11G = 2, WIRELESS_PHY_MODE_11N = 3
uint8_t WIRELESS_PHY_POWER = 10;  //Max = 20.5dBm (some ESP modules 24.0dBm) should be multiples of 0.25
uint8_t WIRELESS_CHANNEL = 7;
//String WIRELESS_SSID = "Plant";
//char WIRELESS_USERNAME[] = "";
//char WIRELESS_PASSWORD[] = "";
uint8_t DATA_LOG = 0;        //data logger (enable/disable)
uint32_t LOG_INTERVAL = 30;  //loop() delay - seconds
//uint8_t NETWORK_DHCP = 0;
String NETWORK_IP = "192.168.8.8";
//String NETWORK_SUBNET = "255.255.255.0";
//char NETWORK_GATEWAY[] = "";
//char NETWORK_DNS[] = "";
uint16_t PLANT_POT_SIZE = 4;         //pump run timer - seconds
uint16_t PLANT_SOIL_MOISTURE = 480;  //ADC value
uint32_t PLANT_MANUAL_TIMER = 0;     //manual sleep timer - hours
uint16_t PLANT_SOIL_TYPE = 2;        //['Sand', 'Clay', 'Dirt', 'Loam', 'Moss'];
uint16_t PLANT_TYPE = 0;             //['Bonsai', 'Monstera', 'Palm'];
uint32_t DEEP_SLEEP = 4;             //auto sleep timer - minutes
//=============================
//String EMAIL_ALERT = "";
//String SMTP_SERVER = "";
//String SMTP_USERNAME = "";
//String SMTP_PASSWORD = "";
String PLANT_NAME = "";
char ALERTS[] = "000000000";  //dhcp-ip, low-power, low-sensor, pump-run, over-water, empty-water, internal-errors, high-priority, led-code
//=============================
String DEMO_PASSWORD = "";  //public demo
//String TIMEZONE_OFFSET = "-28800";       //UTC offset in seconds
char DEMO_AVAILABILITY[] = "00000000618";  //M, T, W, T, F, S, S + Time Range
//=============================
uint32_t WEB_SLEEP = 300000;  //5 minutes = 5 x 60x 1000
//=============================
uint16_t delayBetweenAlertEmails = 0;     //2 hours = 2 x 60 = 120 minutes = x4 30 min loops
uint16_t delayBetweenRefillReset = 0;     //2 hours = 2 x 60 = 120 minutes = x4 30 min loops
uint16_t delayBetweenOverfloodReset = 0;  //8 hours = 8 x 60 = 480 minutes = x16 30 min loops
uint8_t ON_TIME = 0;                      //from 6am
uint8_t OFF_TIME = 0;                     //to 6pm
uint16_t LOG_INTERVAL_S = 0;
uint16_t DEEP_SLEEP_S = 0;
char PNP_ADC[] = "010";                    //0=NPN|1=PNP, ADC sensitivity, Water Level Sensor 0=Disable|1=Enable
//uint8_t ADC_ERROR_OFFSET = 64;           //WAKE_RF_DISABLED offset

WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP);

void setup() {
  //pinMode(deepsleepPin, WAKEUP_PULLUP);

  pinMode(pumpPin, INPUT_PULLUP); //Float the pin until set NPN or PNP

  digitalWrite(sensorPin, LOW);
  pinMode(sensorPin, OUTPUT);

  //Needed after deepSleep for ESP8266 Core 3.0.x. Otherwise error: pll_cal exceeds 2ms
  //delay(1);

  //WPA2 Enterpise stability
  //disable_extra4k_at_link_time(); //use official/legacy ram location for user stack

  /*
    REANSON_DEFAULT_RST = 0, // normal startup by power on
    REANSON_WDT_RST = 1, // hardware watch dog reset
    REANSON_EXCEPTION_RST = 2, // exception reset, GPIO status won't change
    REANSON_SOFT_WDT_RST = 3, // software watch dog reset, GPIO status won't change
    REANSON_SOFT_RESTART = 4, // software restart ,system_restart , GPIO status won't change
    REANSON_DEEP_SLEEP_AWAKE = 5, // wake up from deep-sleep
    REANSON_HARDWARE_RST = 6, // wake up by RST to GND
  */

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
  Serial.setDebugOutput(true);
  //ESP8266 SDK 2.2.2 Deep Sleep is 32bit about 2,147,483,647 = 35 min
  //ESP8266 SDK 2.4.1 Deep Sleep is 64bit about 12,731,80,9786 = 3h 30min
  Serial.println("deepSleepMax: " + uint64ToString(ESP.deepSleepMax()));
  //printMemory();
#endif

  //======================
  //NVRAM type of Settings
  //======================
  EEPROM.begin(1024);
  long e = NVRAM_Read(_EEPROM_ID).toInt();
#if DEBUG
  Serial.print("EEPROM CRC Stored: 0x");
  Serial.println(e, HEX);
  Serial.print("EEPROM CRC Calculated: 0x");
  Serial.println(EEPROM_ID, HEX);
#endif
  if (e != EEPROM_ID) {
    //Check for multiple Plant SSIDs
    //WiFi.mode(WIFI_STA);
    //WiFi.disconnect();

    String WIRELESS_SSID = "Plant";
    uint8_t n = WiFi.scanNetworks();
    for (uint8_t i = 0; i < n; ++i) {
#if DEBUG
      Serial.println(WiFi.SSID(i));
#endif
      if (WiFi.SSID(i) == WIRELESS_SSID) {
        //strcat(WIRELESS_SSID, String("-" + i).c_str());  //avoid conflict
        WIRELESS_SSID += String("-" + i);
        break;
      }
    }
    WiFi.scanDelete();

    NVRAM_Erase();
    NVRAM_Write(_EEPROM_ID, String(EEPROM_ID));
    NVRAM_Write(_WIRELESS_MODE, String(WIRELESS_MODE));
    NVRAM_Write(_WIRELESS_HIDE, "0");
    NVRAM_Write(_WIRELESS_PHY_MODE, String(WIRELESS_PHY_MODE));
    NVRAM_Write(_WIRELESS_PHY_POWER, String(WIRELESS_PHY_POWER));
    NVRAM_Write(_WIRELESS_CHANNEL, String(WIRELESS_CHANNEL));
    NVRAM_Write(_WIRELESS_SSID, WIRELESS_SSID);
    NVRAM_Write(_WIRELESS_USERNAME, "");
    NVRAM_Write(_WIRELESS_PASSWORD, "");
    NVRAM_Write(_DATA_LOG, String(DATA_LOG));
    NVRAM_Write(_LOG_INTERVAL, String(LOG_INTERVAL));
    //==========
    NVRAM_Write(_NETWORK_DHCP, "0");
    NVRAM_Write(_NETWORK_IP, NETWORK_IP);
    NVRAM_Write(_NETWORK_SUBNET, "255.255.255.0");
    NVRAM_Write(_NETWORK_GATEWAY, NETWORK_IP);
    NVRAM_Write(_NETWORK_DNS, NETWORK_IP);
    //==========
    NVRAM_Write(_PLANT_POT_SIZE, String(PLANT_POT_SIZE));
    NVRAM_Write(_PLANT_SOIL_MOISTURE, String(PLANT_SOIL_MOISTURE));
    NVRAM_Write(_PLANT_MANUAL_TIMER, String(PLANT_MANUAL_TIMER));
    NVRAM_Write(_PLANT_SOIL_TYPE, String(PLANT_SOIL_TYPE));
    NVRAM_Write(_PLANT_TYPE, String(PLANT_TYPE));
    NVRAM_Write(_DEEP_SLEEP, String(DEEP_SLEEP));
    //==========
    NVRAM_Write(_ALERTS, ALERTS);
    NVRAM_Write(_EMAIL_ALERT, "");
    NVRAM_Write(_SMTP_SERVER, "");
    NVRAM_Write(_SMTP_USERNAME, "");
    NVRAM_Write(_SMTP_PASSWORD, "");
    NVRAM_Write(_PLANT_NAME, WIRELESS_SSID);
    //==========
    NVRAM_Write(_DEMO_PASSWORD, DEMO_PASSWORD);
    NVRAM_Write(_TIMEZONE_OFFSET, "-28800");
    NVRAM_Write(_DEMO_AVAILABILITY, DEMO_AVAILABILITY);
    //==========
    NVRAM_Write(_PNP_ADC,  PNP_ADC); //TODO: based in flash ID

    memset(&rtcData, 0, sizeof(rtcData));  //reset RTC memory
    LittleFS.format();
  } else {
    NVRAM_Read_Config();
    String nvram = NVRAM_Read(_ALERTS);
    nvram.toCharArray(ALERTS, sizeof(nvram));
    nvram = NVRAM_Read(_DEMO_AVAILABILITY);
    nvram.toCharArray(DEMO_AVAILABILITY, sizeof(nvram));
    ESP.rtcUserMemoryRead(32, (uint32_t *)&rtcData, sizeof(rtcData));
    ADCMODE = get_adc();
    if (ADCMODE == ADC_VCC) {                                               //Measure VCC this runtime
      ESP.rtcUserMemoryWrite(100, (uint32_t *)ADC_TOUT, sizeof(ADC_TOUT));  //Next time measure ADC sensor
    }
  }
  //EEPROM.end();

  ON_TIME = String(DEMO_AVAILABILITY).substring(7, 9).toInt();
  OFF_TIME = String(DEMO_AVAILABILITY).substring(9, 11).toInt();
  PLANT_NAME = NVRAM_Read(_PLANT_NAME);

  struct rst_info *rstInfo = system_get_rst_info();
  uint8_t wakeupReason = rstInfo->reason;

#if DEBUG
  Serial.printf("Wakeup Reason:%u\n", wakeupReason);
#endif

  if (wakeupReason == 5) {  // && WiFi.getMode() == WIFI_OFF) {
    LOG_INTERVAL = 0;       //going into sleep mode anyway, do not delay in loop()
    WEB_SLEEP = 0;
    if (DATA_LOG > 0)  //writing logs during sleep
      LittleFS.begin();
  } else {
    //Emergency Recover (RST to GND)
    if (wakeupReason == 6) {
      LOG_INTERVAL = 300;                    //prevent WiFi from sleeping 5 minutes
      ALERTS[0] = '1';                       //email DHCP IP
      ALERTS[1] = '0';                       //low voltage
      memset(&rtcData, 0, sizeof(rtcData));  //reset RTC memory (set all zero)
      blinky(2000, 1, 0);
      setupWiFi(22);
      //ArduinoOTA.begin();
    } else {
      setupWiFi(0);
    }
    setupWebServer();
  }
#if DEBUG
  Serial.printf("Boot calibration (milliseconds):%u\n", millis());
#endif
  offsetTiming();
  calibrateDeepSleep(); //compensate for processing delay during setup()
}

//This is a power expensive function 80+mA
void setupWiFi(uint8_t timeout) {

  blinky(200, 3, 0);  //Alive blink

  WIRELESS_MODE = NVRAM_Read(_WIRELESS_MODE).toInt();
  WIRELESS_CHANNEL = NVRAM_Read(_WIRELESS_CHANNEL).toInt();
  WIRELESS_PHY_MODE = NVRAM_Read(_WIRELESS_PHY_MODE).toInt();
  WIRELESS_PHY_POWER = NVRAM_Read(_WIRELESS_PHY_POWER).toInt();

  //Forcefull Wakeup
  //-------------------
  //WiFi.persistent(false);
  //WiFi.setSleepMode(WIRELESS_NONE_SLEEP);
  //WiFi.forceSleepWake();
  //-------------------
  IPAddress ip, gateway, subnet, dns;
  ip.fromString(NVRAM_Read(_NETWORK_IP));
  subnet.fromString(NVRAM_Read(_NETWORK_SUBNET));
  gateway.fromString(NVRAM_Read(_NETWORK_GATEWAY));
  dns.fromString(NVRAM_Read(_NETWORK_DNS));
  //-------------------

  WiFi.persistent(false);  //Do not write settings to memory
  WiFi.setPhyMode((WiFiPhyMode_t)WIRELESS_PHY_MODE);

  //0    (for lowest RF power output, supply current ~ 70mA
  //20.5 (for highest RF power output, supply current ~ 80mA
  WiFi.setOutputPower(WIRELESS_PHY_POWER);

  const String WIRELESS_SSID = NVRAM_Read(_WIRELESS_SSID);
  const String WIRELESS_PASSWORD = NVRAM_Read(_WIRELESS_PASSWORD);

  if (WIRELESS_MODE == 0) {
    //=====================
    //WiFi Access Point Mode
    //=====================
    uint8_t WIRELESS_HIDE = NVRAM_Read(_WIRELESS_HIDE).toInt();

    //WiFi.enableSTA(false);
    //WiFi.enableAP(true);
    WiFi.mode(WIFI_AP);
    WiFi.softAPConfig(ip, gateway, subnet);
    WiFi.softAP(WIRELESS_SSID, WIRELESS_PASSWORD, WIRELESS_CHANNEL, WIRELESS_HIDE, 3);  //max 3 clients

#if DEBUG
    Serial.println(WiFi.softAPIP());
    Serial.println(WiFi.macAddress());
    /*
    softap_config config;
    wifi_softap_get_config(&config);

    Serial.println(F("SoftAP Configuration"));
    Serial.println(F("-----------------------------"));
    Serial.print(F("ssid:            "));
    Serial.println((char *)config.ssid);
    Serial.print(F("password:        "));
    Serial.println((char *)config.password);
    Serial.print(F("ssid_len:        "));
    Serial.println(config.ssid_len);
    Serial.print(F("channel:         "));
    Serial.println(config.channel);
    Serial.print(F("authmode:        "));
    Serial.println(config.authmode);
    Serial.print(F("ssid_hidden:     "));
    Serial.println(config.ssid_hidden);
    Serial.print(F("max_connection:  "));
    Serial.println(config.max_connection);
    Serial.print(F("beacon_interval: "));
    Serial.println((String)config.beacon_interval + "(ms)");
    Serial.println(F("-----------------------------"));
    */
#endif
    //==========
    //DNS Server
    //==========
#if ASYNCWEBSERVER_DNS
    dnsServer.setTTL(300);
    dnsServer.setErrorReplyCode(AsyncDNSReplyCode::ServerFailure);
    dnsServer.start(53, "captive.apple.com", WiFi.softAPIP());
    //dnsServer.setErrorReplyCode(AsyncDNSReplyCode::NoError);
    //dnsServer.start(53, "*", WiFi.softAPIP());
#else
      MDNS.begin(WIRELESS_SSID);
#endif
    NETWORK_IP = WiFi.softAPIP().toString();

  } else {
    //================
    //WiFi Client Mode
    //================

    //WiFi.enableSTA(true);
    //WiFi.enableAP(false);
    WiFi.mode(WIFI_STA);
    WiFi.setAutoConnect(false);
    WiFi.disconnect();

    uint8_t NETWORK_DHCP = NVRAM_Read(_NETWORK_DHCP).toInt();
    if (NETWORK_DHCP == 0) {
      WiFi.config(ip, gateway, subnet, dns);
    }
    WiFi.hostname(PLANT_NAME);

    if (WIRELESS_MODE == 2) {  // WPA2-Enterprise
      typedef enum {
        EAP_TLS,
        EAP_PEAP,
        EAP_TTLS,
      } eap_method_t;
      eap_method_t method = EAP_PEAP;
      struct station_config wifi_config;
      memset(&wifi_config, 0, sizeof(wifi_config));
      strcpy((char *)wifi_config.ssid, WIRELESS_SSID.c_str());
      //memcpy(wifi_config.ssid, WIRELESS_SSID.c_str(), WIRELESS_SSID.length());
      //memcpy(wifi_config.password, WIRELESS_PASSWORD.c_str(), WIRELESS_PASSWORD.length());	// only for WPA2-PSK
      //memcpy(wifi_config.password, "", 0);	                                      // only for WPA2-Enterprise
      wifi_station_set_config(&wifi_config);
#if DEBUG
      Serial.printf("Beacon Interval: %d\n", wifi_config.beacon_interval);
      Serial.printf("Max Connections: %d\n", wifi_config.max_connection);
      Serial.printf("Threshold RSSI: %d\n", wifi_config.threshold.rssi);
      Serial.printf("Threshold Authmode: %d\n"), (uint8_t)wifi_config.threshold.authmode);
#endif
      wifi_station_set_wpa2_enterprise_auth(true);
      //wifi_station_set_reconnect_policy(true);
      //wifi_station_clear_enterprise_identity();
      //wifi_station_clear_enterprise_username();
      //wifi_station_clear_enterprise_password();
      //wifi_station_clear_enterprise_cert_key();
      //wifi_station_clear_enterprise_ca_cert();

      //Connecting to WPA2-ENTERPRISE AP needs more than 26 KB memory
      //HeapSelectDram ephemeral;
      //if (ESP.getFreeHeap() > 26624) { //ensure enough space
      const String WIRELESS_USERNAME = NVRAM_Read(_WIRELESS_USERNAME);
      //Must have @<domain.com> otherwise default anonymous@espressif.com is used
      wifi_station_set_enterprise_identity((u8 *)WIRELESS_USERNAME.c_str(), WIRELESS_USERNAME.length());
      //wifi_station_set_enterprise_identity((u8*)"esptest@domain.com", strlen("esptest@domain.com"));

      if (method == EAP_PEAP || method == EAP_TTLS) {
        wifi_station_set_enterprise_username((u8 *)WIRELESS_USERNAME.c_str(), WIRELESS_USERNAME.length());
        wifi_station_set_enterprise_password((u8 *)WIRELESS_PASSWORD.c_str(), WIRELESS_PASSWORD.length());
        //wifi_station_set_enterprise_username((u8*)"esptest@domain.com", strlen("esptest@domain.com"));
        //wifi_station_set_enterprise_password((u8*)"esptest0", strlen("esptest0"));
      }

      //ESP8266 does not support bigger than SHA256 certificate
      //WPA2-ENTERPRISE can only support unencrypted certificate and private key, and only in PEM format
      if (LittleFS.exists("/radius.cer")) {
        File file = LittleFS.open("/radius.cer", "r");
        size_t size = file.size();
        uint8_t cert[size];
        size_t offset = 0;
        while (size > 0) {
          size_t chunkSize = (size < 512) ? size : 512;
          file.read(cert + offset, chunkSize);
          offset += chunkSize;
          size -= chunkSize;
        }
        file.close();
        if (method == EAP_TLS) {
          if (LittleFS.exists("/radius.key")) {
            File file = LittleFS.open("/radius.key", "r");
            size_t size = file.size();
            uint8_t cert_key[size];
            size_t offset = 0;
            while (size > 0) {
              size_t chunkSize = (size < 512) ? size : 512;
              file.read(cert_key + offset, chunkSize);
              offset += chunkSize;
              size -= chunkSize;
            }
            file.close();
            wifi_station_set_enterprise_cert_key(cert, sizeof(cert), cert_key, sizeof(cert_key), NULL, 0);
          }
        } else if (method == EAP_TTLS) {
          wifi_station_set_enterprise_ca_cert(cert, sizeof(cert));  //This is an option for EAP_PEAP and EAP_TTLS.
        }
      }
      //wifi_station_disconnect();
      wifi_station_connect();
      //} else {
      //  timeout = 22;
      //}
    } else {

      if (WIRELESS_MODE == 3)
        WiFi.enableInsecureWEP();  //Old School

      WiFi.begin(WIRELESS_SSID, WIRELESS_PASSWORD);  //Connect to the WiFi network
    }

    //No wifi-scan required when RF channel and AP mac-address is provided
    //uint8_t WIRELESS_BSSID[6] = { 0xF8, 0x1E, 0xDF, 0xFE, 0xE9, 0x39 };
    //WiFi.begin(WIRELESS_SSID, WIRELESS_PASSWORD, WIRELESS_CHANNEL, WIRELESS_BSSID, true);

    if (WiFi.waitForConnectResult() != WL_CONNECTED) {
#if DEBUG
      /*
      0 = WL_IDLE_STATUS
      1 = WL_NO_SSID_AVAIL
      6 = WL_WRONG_PASSWORD
      */
      Serial.println(WiFi.status());
      //WiFi.printDiag();
#endif
      delay(1000);

      if (timeout > 21) {
#if DEBUG
        Serial.println("Connection Failed! Rebooting...");
#endif
        //If client mode fails ESP8266 will not be accessible
        //Set Emergency AP SSID for re-configuration
        //NVRAM_Write(_EEPROM_ID, "0");
        NVRAM_Write(_WIRELESS_MODE, "0");
        NVRAM_Write(_WIRELESS_HIDE, "0");
        NVRAM_Write(_WIRELESS_SSID, PLANT_NAME);
        NVRAM_Write(_WIRELESS_PASSWORD, "");
        NVRAM_Write(_LOG_INTERVAL, "60");
        NVRAM_Write(_NETWORK_DHCP, "0");
        //delay(100);
        ESP.restart();
      }
      WIRELESS_PHY_POWER++;  //auto tune wifi power (minimum power to reach AP)
      setupWiFi(timeout++);
      return;
    }
    NVRAM_Write(_WIRELESS_PHY_POWER, String(WIRELESS_PHY_POWER));  //save auto tuned wifi power

    WiFi.setAutoReconnect(true);

    //NTP Client to get time
    timeClient.begin();
    timeClient.update();
    timeClient.setTimeOffset(NVRAM_Read(_TIMEZONE_OFFSET).toInt());

    //Offset runtime as current minutes (more accurate availability count)
    rtcData.runTime = timeClient.getMinutes() * 60;
    rtcData.ntpWeek = timeClient.getDay();
    rtcData.ntpHour = timeClient.getHours();
#if DEBUG
    Serial.print(timeClient.getDay());
    Serial.print("|");
    Serial.print(timeClient.getHours());
    Serial.print("|");
    Serial.print(timeClient.getMinutes());
    Serial.print("\n");
    //Serial.println(timeClient.getFormattedTime());
#endif

    NETWORK_IP = WiFi.localIP().toString();

    if (ALERTS[0] == '1')
      smtpSend("DHCP IP", NETWORK_IP);

#if DEBUG
    Serial.println(WiFi.localIP().toString());
#endif
  }

  //TCP timer rate raised from 250ms to 3s
  //WiFi.setSleepMode(WIFI_LIGHT_SLEEP);   //Light sleep is like modem sleep, but also turns off the system clock.
  //WiFi.setSleepMode(WIFI_MODEM_SLEEP);   //Modem sleep disables WiFi between DTIM beacon intervals.
  WiFi.setSleepMode(WIFI_MODEM_SLEEP, 10);  //Station wakes up every (DTIM-interval * listenInterval) This saves power but station interface may miss broadcast data.
}

void setupWebServer() {
  //LittleFSConfig config;
  //LittleFS.setConfig(config);
  if (!LittleFS.begin()) {
#if DEBUG
    Serial.println("LittleFS Mount Failed");
#endif
    return;
  }
#if DEBUG
  FSInfo info;
  LittleFS.info(info);
  Serial.printf("Total: %u\nUsed: %u\nBlock: %u\nPage: %u\nMax open files: %u\nMax path len: %u\n",
                info.totalBytes,
                info.usedBytes,
                info.blockSize,
                info.pageSize,
                info.maxOpenFiles,
                info.maxPathLength);
#endif
  DEMO_PASSWORD = NVRAM_Read(_DEMO_PASSWORD);
  //==============================================
  //Async Web Server HTTP_GET, HTTP_POST, HTTP_ANY
  //==============================================
  server.on("/api", HTTP_GET, [](AsyncWebServerRequest *request) {
    if (request->hasParam("adc")) {
      uint8_t adc = request->getParam(0)->value().toInt();
      uint16_t moisture = 0;
      if (adc == 1) {
        #ifdef ESP8266
        moisture = sensorRead_ESP8266(sensorPin);
        #else
        moisture = sensorRead(sensorPin);
        #endif
      }else{
        moisture = waterLevelRead();
      }
      request->send(200, text_plain, String(moisture));
      /*}else if (request->hasParam("chipid", true)) {
        AsyncResponseStream *response = request->beginResponseStream(text_plain);
        response->printf("Chip ID = 0x%08X\n", ESP.getChipId());
        request->send(response);*/
    } else if (request->hasParam("ntp")) {
      rtcData.ntpWeek = request->getParam(0)->value().toInt();
      rtcData.ntpHour = request->getParam(1)->value().toInt();
      rtcData.runTime = request->getParam(2)->value().toInt() * 60;
#if DEBUG
      Serial.printf("NTP Week: %u\n", rtcData.ntpWeek);
      Serial.printf("NTP Hour: %u\n", rtcData.ntpHour);
      Serial.printf("NTP Seconds: %u\n", rtcData.runTime);
#endif
      request->send(200, text_plain, String(DEEP_SLEEP));
    } else if (DEMO_PASSWORD == "") {
      blinkDuration = 0;
      if (request->hasParam("reset")) {
        NVRAM_Erase();
        AsyncWebServerResponse *response = request->beginResponse(text_html, 3, [](uint8_t *buffer, size_t maxLen, size_t index) -> size_t {
          if (index) {
            //delay(100);
            NVRAM_Write(_PNP_ADC, PNP_ADC);
            ESP.restart();
            return 0;
          }
          return snprintf((char *)buffer, maxLen, ".....");  //must be +2 characters over length for restart to trigger
        });
        response->addHeader(content_length, "3");
        request->send(response);
        //request->send(200, text_plain, "...");
      } else if (request->hasParam("smtp")) {
        testSMTP = true;
        request->send(200, text_plain, "OK");
        //Cannot do inline with webserver, not enough ESP.getFreeHeap()
        //smtpSend("Test", String(EEPROM_ID));
      } else if (request->hasParam("pump")) {
        testPump = true;
        request->send(200, text_plain, String(PLANT_POT_SIZE));
        /*
        AsyncWebServerResponse *response = request->beginResponse(text_html, 3, [](uint8_t *buffer, size_t maxLen, size_t index) -> size_t {
          if (index) {
            runPump(); //Cannot delay() here, Fatal exception 9(LoadStoreAlignmentCause)
            return 0;
          }
          return snprintf((char *)buffer, maxLen, ".....");
        });
        response->addHeader(content_length, "3");
        request->send(response);
        */
      } else if (request->hasParam("empty")) {
        uint8_t water = request->getParam(0)->value().toInt();
        rtcData.emptyBottle = water;
        if (water > 3) {
          rtcData.waterTime = delayBetweenOverfloodReset + 1;
        }
        request->send(200, text_plain, String(rtcData.waterTime));
      }
    } else {
      request->send(200, text_html, locked_html);
    }
  });
  server.on("/svg", HTTP_GET, [](AsyncWebServerRequest *request) {
    String file = request->url();
    if (file.endsWith(".svg") || file.endsWith(".css")) {
      String contentType = getContentType(file);
      AsyncWebServerResponse *response = request->beginResponse(LittleFS, file, contentType);
      response->addHeader("Content-Encoding", "gzip");
      request->send(response);
    } else {
      String out = indexSVG("/svg");
      request->send(200, text_plain, out);
    }
  });
  /*
  server.on("/adc2", HTTP_GET, [](AsyncWebServerRequest *request) {
    //CapacitiveSensor cs = CapacitiveSensor(sensorPin, moistureSensorPin);
    //cs.set_CS_AutocaL_Millis(0xFFFFFFFF); // turn off autocalibrate
    uint16_t moisture = cs.capacitiveSensor(30);
    request->send(200, text_plain, String(moisture));
  });
  server.on("/adc-offset", HTTP_GET, [](AsyncWebServerRequest *request) {
    if (request->params() > 0) {
      int8_t i = request->getParam(0)->value().toInt();
      ADC_ERROR_OFFSET = i;
      NVRAM_Write(_ADC_ERROR_OFFSET, String(ADC_ERROR_OFFSET));
    }
    request->send(200, text_plain, String(ADC_ERROR_OFFSET));
  });
  */
  server.on("/data.log", HTTP_GET, [](AsyncWebServerRequest *request) {
    if (request->hasParam("clear")) {
      DATA_LOG = 0;
      LittleFS.remove("data.log");
      //NVRAM_Write(_DATA_LOG, "0");
      request->send(200, text_plain, "...");
    } else if (!LittleFS.exists(request->url())) {
      DATA_LOG = 1;
      //NVRAM_Write(_DATA_LOG, "1");
      request->send(200, text_plain, "...");
    } else {
      AsyncWebServerResponse *response = request->beginResponse(LittleFS, request->url(), text_plain);
      request->send(response);
    }
  });
  server.on("/login", HTTP_POST, [](AsyncWebServerRequest *request) {
    if (request->getParam(0)->value() == DEMO_PASSWORD) {
      DEMO_PASSWORD[0] = 0;  //reset
    }
    request->redirect("/index.html");
  });
  server.on("/nvram.json", HTTP_GET, [](AsyncWebServerRequest *request) {
    if (request->params() > 0) {
      if (DEMO_PASSWORD == "") {
        uint8_t i = request->getParam(0)->value().toInt();
        if (request->hasParam("alert")) {
          ALERTS[i] = request->getParam(1)->value().toInt();
          NVRAM_Write(_ALERTS, ALERTS);
        } else {
          NVRAM_Write(i, request->getParam(1)->value());
          NVRAM_Read_Config();
        }
        offsetTiming();
        request->send(200, text_plain, request->getParam(1)->value());
      } else {
        request->send(200, text_html, locked_html);
      }
    } else {
      uint8_t mask[] = { 8, 25, 28 };
      String out = NVRAM(1, 31, mask);
      request->send(200, text_json, out);
    }
  });
  server.on("/nvram", HTTP_POST, [](AsyncWebServerRequest *request) {
    if (DEMO_PASSWORD != "") {
      request->send(200, text_html, locked_html);
    } else {

      String out = "<pre>";
      uint8_t c = 1, from = 0, to = 0, skip = 32;

      if (request->hasParam("WiFiMode", true)) {
        //skip confirm password (9)
        if (request->hasParam("WiFiIP", true)) {
          from = 1, to = 16, skip = 9;
        } else {
          from = 1, to = 12, skip = 9;
        }
      } else if (request->hasParam("Alerts", true)) {
        from = 22, to = 28, skip = 26;
      } else if (request->hasParam("DemoPassword", true)) {
        from = 28, to = 31, skip = 29;
      }

      uint8_t n = 0;
      for (uint8_t i = from; i <= to; i++) {
        n = i;
        if (i > skip)
          n--;

        if (i != skip) {
          out += "[";
          out += n;
          out += +"] ";
          out += request->getParam(c)->name() + ": ";
          NVRAM_Write(n, request->getParam(c)->value());
          out += NVRAM_Read(n) + "\n";
        }
        c++;
      }
#if DEBUG
      Serial.println("NVRAM Forcig Restart");
#endif
      out += "\nRebooting...";
      out += "</pre> ";

      AsyncWebServerResponse *response = request->beginResponse(text_html, out.length(), [out](uint8_t *buffer, size_t maxLen, size_t index) -> size_t {
        if (index) {
          //delay(100);
          ESP.restart();
          return 0;
        }
        return snprintf((char *)buffer, maxLen, String(out + " ").c_str());  //must be +1 character over length for restart to trigger
      });
      response->addHeader(content_length, String(out.length()));

      String RefreshURL = "/";
      if (request->hasParam("WiFiIP", true)) {
        RefreshURL = "http://" + request->getParam("WiFiIP", true)->value();
      } else if (request->hasParam("WiFiMode", true)) {
        RefreshURL = "http://" + PLANT_NAME;
      }
      response->addHeader(refresh_http, "12; url=" + RefreshURL);
      request->send(response);
    }
  });
  server.on("/update", HTTP_GET, [](AsyncWebServerRequest *request) {
    webTimer = millis();
#ifndef ARDUINO_SIGNING
    if (DEMO_PASSWORD != "")
      if (!request->authenticate("", DEMO_PASSWORD.c_str()))
        return request->requestAuthentication();
#endif
    String updateURL = "http://" + NETWORK_IP + "/update";
    String updateHTML = "<!DOCTYPE html><html><body><form method=POST action='" + updateURL + "' enctype='multipart/form-data' accept-charset='UTF-8'><input type=file accept='.bin,.signed' name=firmware><input type=submit value='Update Firmware'></form><br><form method=POST action='" + updateURL + "' enctype='multipart/form-data'><input type=file accept='.bin,.signed' name=filesystem><input type=submit value='Update Filesystem'></form></body></html>";
    AsyncWebServerResponse *response = request->beginResponse(200, text_html, updateHTML);
    request->send(response);
  });
/*
    server.on("/format", HTTP_GET, [](AsyncWebServerRequest *request) {
      FSInfo fs_info;
      String result = LittleFS.format() ? "OK" : "Error";
      LittleFS.info(fs_info);
      request->send(200, text_plain, "<pre>Format " + result + "\nTotal Flash Size: " + String(ESP.getFlashChipSize()) + "\nFilesystem Size: " + String(fs_info.totalBytes) + "\nFilesystem Used: " + String(fs_info.usedBytes) + "</pre>");
    });
*/
#if ASYNCWEBSERVER_SSL
  //Web Updates only work over HTTP (TODO: Check Update Library)
  httpserver.on(
#else
  server.on(
#endif
    "/update", HTTP_POST, [&](AsyncWebServerRequest *request) {
#ifndef ARDUINO_SIGNING
      if (DEMO_PASSWORD != "")
        if (!request->authenticate("", DEMO_PASSWORD.c_str()))
          return request->requestAuthentication();
#endif
      String out = "Update Success! Rebooting....";
      if (Update.hasError()) {
#if (ARDUINO_ESP8266_MAJOR >= 3 && ARDUINO_ESP8266_MINOR >= 1)
        out = Update.getErrorString().c_str();  //3.1.x
#else
        StreamString str;
        Update.printError(str);
        out = str.c_str();
#endif
      }
      AsyncWebServerResponse *response = request->beginResponse(text_html, out.length(), [out](uint8_t *buffer, size_t maxLen, size_t index) -> size_t {
        if (index) {
          //delay(100);
          ESP.restart();
          return 0;
        }
        return snprintf((char *)buffer, maxLen, String(out + " ").c_str());  //must be +1 character over length for restart to trigger
      });
      //response->addHeader("Clear-Site-Data", "cache");
      response->addHeader(content_length, String(out.length()));
      response->addHeader(refresh_http, "15; url=/");
      request->send(response);
    },
    WebUpload);

  server.on(
    "/tls", HTTP_POST, [](AsyncWebServerRequest *request) {
      if (DEMO_PASSWORD != "")
        if (!request->authenticate("", DEMO_PASSWORD.c_str()))
          return request->requestAuthentication();
      request->redirect("/index.html");  //request->send(200);
    },
    onUpload);

  server.on("/", [](AsyncWebServerRequest *request) {
    if (LittleFS.exists("/index.html")) {
      blinkDuration = 0;
      request->redirect("/index.html");
    } else {
      AsyncWebServerResponse *response = request->beginResponse(200, text_html, "File System Not Found ...");
      response->addHeader(refresh_http, "4; url=/update");
      request->send(response);
    }
  });

  /*
    Captive portals
    ---------------
    - Apple /hotspot-detect.html
    - Android /generate_204
    - Firefox /canonical.html > /captive-portal
    - Microsoft /connecttest.txt > /redirect
  */
#if ASYNCWEBSERVER_REGEX
  //anchored start to ^ improves performance
  //server.on("(?is)^\\/(\bhotspot-detect\b|\bgenerate_204\b|\bconnecttest\b)", HTTP_GET, [](AsyncWebServerRequest *request) {
  server.on("(hotspot-detect\.html+)|(generate_204+)|(connecttest\.txt+)$", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->send(200, text_html, "<center><h1>http://" + NETWORK_IP + "</h1></center>");
  });
  //server.on("(?is)^\\/(\bredirect\b|\bcaptive-portal\b)", HTTP_GET, [](AsyncWebServerRequest *request) {
  server.on("(redirect+)|(captive-portal+)$", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->redirect("http://" + NETWORK_IP);
  });
  server.on("^\\/regex\\/([0-9]+)$", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->send(200, text_plain, "OK");
  });
#endif

  server.onNotFound([](AsyncWebServerRequest *request) {
    //Serial.println((request->method() == HTTP_GET) ? "GET" : "POST");

    webTimer = millis();

    String file = request->url();
#if DEBUG
    Serial.println("Request:" + file);
#endif

#if !ASYNCWEBSERVER_REGEX
    if (file.endsWith("detect.html") || file.endsWith("generate_204")) {  // || file.endsWith("test.txt")) {
      //if (!LittleFS.exists("/index.html")) {
      request->send(200, text_html, "<center><h1>http://" + NETWORK_IP + "</h1></center>");
      //}
    } else if (file.endsWith("redirect") || file.endsWith("portal")) {
      request->redirect("http://" + NETWORK_IP);
    } else
#endif
      if (LittleFS.exists(file)) {
      AsyncWebServerResponse *response = request->beginResponse(LittleFS, file, getContentType(file));
      response->addHeader("Content-Encoding", "gzip");
      //response->addHeader("Cache-Control", "max-age=3600");
      request->send(response);
    } else {
      request->send(404, text_plain, "404: Not Found");
    }
  });

#if ASYNCWEBSERVER_SSL
  server.onSslFileRequest([](void *arg, const char *filename, uint8_t **buf) -> int {
#if DEBUG
    Serial.printf("SSL File: %s\n", filename);
#endif
    if (LittleFS.exists(filename)) {
      File file = LittleFS.open(filename, "r");
      size_t size = file.size();
      uint8_t nbuf[size];
      size_t offset = 0;
      while (size > 0) {
        size_t chunkSize = (size < 512) ? size : 512;
        int n = file.read(nbuf + offset, chunkSize);
        if (n < 0) {
          break;
        }
        offset += n;
        size -= n;
      }
      file.close();

      *buf = nbuf;
    }
    return offset;
  });

  //Set time via NTP, as required for x.509 validation
  /*
  //configTime(String(TIMEZONE_OFFSET).toInt(), "pool.ntp.org");
  delay(1000);
  struct tm timeinfo;
  gmtime_r(&now, &timeinfo);
 #if DEBUG
  Serial.printf_P(PSTR("Current time (UTC):   %s"), asctime(&timeinfo));
  localtime_r(&now, &timeinfo);
  Serial.printf_P(PSTR("Current time (Local): %s"), asctime(&timeinfo));
#endif
  */
  server.beginSecure("/server.cer", "/server.key");

#if ASYNCWEBSERVER_REGEX
  // HTTP to HTTPS Redirect
  httpserver.on("^\\/([a-z0-9]+)$", HTTP_GET, [](AsyncWebServerRequest *request) {
    //HTTPS_FQDN = NETWORK_IP;
    request->redirect("https://" + HTTPS_FQDN + request->url());
  });
#else
  httpserver.onNotFound([](AsyncWebServerRequest *request) {
    //HTTPS_FQDN = NETWORK_IP;
    request->redirect("https://" + HTTPS_FQDN + request->url());
  });
#endif
  httpserver.begin();
#else
  server.begin();  // Web server start
#endif

  //server.serveStatic("/", LittleFS, "/");
  //server.onRequestBody(serverCompression);
}

void loop() {
  //delay(1);  //enable Modem-Sleep
  //ArduinoOTA.handle();
  //delay(LOG_INTERVAL);

 if (testPump) {
    testPump = false;
    runPump();
  } else if (testSMTP) {
    testSMTP = false;
    smtpSend("Test", String(EEPROM_ID, HEX));
  }

  if (millis() - loopTimer < LOG_INTERVAL) return;
  rtcData.runTime += LOG_INTERVAL_S;  //track time since NTP sync (as seconds)

  //Measure voltage every 10000s runtime (~2.5 hours)
  if (ALERTS[1] == '1' && rtcData.runTime % 10000 == 0) {
    if (ADCMODE == ADC_TOUT) {
      ESP.rtcUserMemoryWrite(100, (uint32_t *)ADC_VCC, sizeof(ADC_VCC));  //Next time measure VCC
    } else {
      //A0 pin needs to be free, not connected to anything in order for the internal measurement to work properly
      //A0 pin in NodeMCU is connected to (resistor/capacitor) and needs to be floating in order to use ADC_MODE(ADC_VCC)
      int vcc = ESP.getVcc();
      double dvcc = (float)vcc / 1024;
#if DEBUG
      Serial.println("Voltage: " + String(dvcc, 3) + "v");
#endif
      dataLog("v:" + String(dvcc, 3));
      //TODO: only send below 2.8 volt?
      //{
      smtpSend("Low Voltage", String(dvcc) + "v");
      //}
      ESP.rtcUserMemoryWrite(32, (uint32_t *)&rtcData, sizeof(rtcData));
    }
    ESP.restart();  //Reboot to switch ADC_MODE
  }

  /*
    IMPORTANT!
    Make sure that the input voltage on the A0 pin doesn’t exceed 1.0V
  */
  #ifdef ESP8266
  uint16_t moisture = sensorRead_ESP8266(sensorPin);
  #else
  uint16_t moisture = sensorRead(sensorPin);
  #endif

  if (ALERTS[8] == '1') {
#if THREADED
    blinkTick.once(1, blinkMorse, moisture);
#else
    blinkMorse(moisture);
#endif
  }

  dataLog(String(moisture));

  if (rtcData.emptyBottle >= 3) {  //Low Water LED
#if DEBUG
    Serial.printf("Empty Warning: %u, %u\n", rtcData.emptyBottle, rtcData.waterTime);
#endif

    //if (sensorless detection timeout or sensored detection timeout)
    if ((rtcData.emptyBottle < 10 && rtcData.waterTime > delayBetweenOverfloodReset) || (rtcData.emptyBottle > 10 && rtcData.waterTime > delayBetweenRefillReset)) {
#if DEBUG
      Serial.printf("Empty Reset: %u\n", delayBetweenRefillReset);
#endif
      dataLog("e:0");
      if (ALERTS[4] == '1')
        smtpSend("Flood Protection", String(delayBetweenOverfloodReset));
      blinkEmpty = false;
      rtcData.waterTime = 0;
      rtcData.emptyBottle = 0;
      rtcData.moistureLog = 0;
    } else if (!blinkEmpty) {
      blinkEmpty = true;
#if DEBUG
      Serial.printf("Empty Detection: %u\n", rtcData.emptyBottle);
#endif
      dataLog("e:" + String(rtcData.emptyBottle));
      if (ALERTS[5] == '1')
        smtpSend("Water Empty", String(rtcData.emptyBottle));
      blinky(900, 254, 1);
    }
  }

  byte WiFiClientCount = 0;
  if (millis() - webTimer < WEB_SLEEP) {  //track web activity for 5 minutes
    WiFiClientCount = 1;
  } else if (WiFi.getMode() == WIFI_AP) {
    WiFiClientCount = WiFi.softAPgetStationNum();  //counts all wifi clients (refresh may take 5 min to register station leave)
  }

#if DEBUG
  Serial.printf("WiFi Clients: %u\n", WiFiClientCount);
  Serial.printf("Runtime: %u\n", rtcData.runTime);
#endif

  if (WiFiClientCount == 0) {

    //Calculate current Day/Time. Works with WIFI_STA (NTP from server) and WIFI_AP (NTP from web-interface)
    //----------------------------------------
    uint8_t h = rtcData.ntpHour + rtcData.runTime / 3600;  //runtime in hours
    if (h >= 24) {                                         //day roll-over at 12pm
      rtcData.runTime = 0;
      rtcData.ntpHour = 0;
      rtcData.ntpWeek++;
      if (rtcData.ntpWeek > 6)  //week roll-over on saturday (sunday = 0)
        rtcData.ntpWeek = 0;
    }

#if DEBUG
    Serial.printf("Day: %u\n", rtcData.ntpWeek);
    Serial.printf("Hours: %u\n", h);
    Serial.printf("Minutes: %u\n", (rtcData.runTime / 60));
    for (uint8_t w = 0; w < 7; w++) {
      Serial.printf("ON/OFF: %c\n", DEMO_AVAILABILITY[w]);
    }
    Serial.printf("Week: %s\n", String(DEMO_AVAILABILITY).substring(0, 7));
    Serial.printf("Range: %u:%u\n", ON_TIME, OFF_TIME);
#endif
    //Always ON based on day of week (power cosumption AP = ~70mA STA = ~20mA)
    if (DEMO_AVAILABILITY[rtcData.ntpWeek] == '1' && h >= ON_TIME && h < OFF_TIME) {
      WiFi.forceSleepWake();  //try to get true mode as MODEM_SLEEP causes WIFI_OFF
      delay(1);               //must delay after WiFi.forceSleepWake()

      if (WiFi.getMode() == WIFI_OFF) {
#if DEBUG
        Serial.println("WiFi ON");
#endif
        LOG_INTERVAL = NVRAM_Read(_LOG_INTERVAL).toInt();
        DEEP_SLEEP = 0;
        offsetTiming();

        setupWiFi(0);
        setupWebServer();
      }
    } else if (DEEP_SLEEP_S == 0 && h >= OFF_TIME) {  //outside of working hours
#if DEBUG
      Serial.println("WiFi OFF");
#endif
      DEEP_SLEEP = NVRAM_Read(_DEEP_SLEEP).toInt() * 60;
      offsetTiming();
    }
    //----------------------------------------
    if (PLANT_MANUAL_TIMER == 0) {
      if (moisture <= 14) {  //Sensor Not in Soil
        blinky(200, 4, 0);
        if (ALERTS[2] == '1')
          smtpSend("Low Sensor", String(moisture));
      } else if (moisture < PLANT_SOIL_MOISTURE) {  //Water Plant
        if (rtcData.emptyBottle < 3) {
          rtcData.moistureLog += moisture;
          runPump();
        } else {
          uint16_t mm = rtcData.moistureLog / 3;  //Average 3
          if (mm > (moisture - 10) && mm < (moisture + 10)) {
            rtcData.emptyBottle = 11;  //Pump ran but no change in moisture
#if DEBUG
            Serial.printf("Empty Range +-10 %u\n", mm);
#endif
          }
        }
      } else {
        if (blinkEmpty && ALERTS[5] == '1') {
          smtpSend("Water Refilled", String(moisture));
        }
        blinkEmpty = false;
        rtcData.waterTime = 0;
        rtcData.emptyBottle = 0;
        rtcData.moistureLog = 0;
      }
    } else {
      dataLog("t:" + String(rtcData.waterTime));
#if DEBUG
      Serial.printf("Water Timer: %u\n", rtcData.waterTime);
#endif
      //We need to split deep sleep as 32-bit unsigned integer is 4294967295 or 0xffffffff max ~71 minutes
      if (rtcData.waterTime >= PLANT_MANUAL_TIMER) {
        rtcData.emptyBottle = 0;  //assume no sensor with manual timer
        rtcData.waterTime = 0;
        runPump();
      }
      rtcData.waterTime++;
    }
    readySleep();
  }
  loopTimer = millis();
}

void readySleep() {

  if (rtcData.alertTime > delayBetweenAlertEmails) {
    rtcData.alertTime = 0;  //prevent spam and server block (but send all in same cycle)
  } else {
    rtcData.alertTime++;  //count down alert timing
  }

  //GPIO16 (D0) needs to be tied to RST to wake from deepSleep
  if (DEEP_SLEEP_S > 1) {
    rtcData.runTime += DEEP_SLEEP_S;  //add sleep time, when we wake up will be accurate.
    ESP.rtcUserMemoryWrite(32, (uint32_t *)&rtcData, sizeof(rtcData));
    WiFi.disconnect();  //disassociate properly (easier to reconnect)
    delay(100);
    //https://github.com/esp8266/Arduino/issues/8728 (WAKE_RF_DISABLED changes ADC behaviour)
    ESP.deepSleep(DEEP_SLEEP, WAKE_RF_DISABLED);  //Will wake up without radio
    //TODO: Check state and use WAKE_RF_DEFAULT for second stage
    //ESP.deepSleep(DEEP_SLEEP, WAKE_RF_DEFAULT);
  }
}

/*
  uint16_t getAnalog() {

  uint16_t result = 0;

  uint16_t num_samples = 512;
  uint16_t adc_addr[num_samples]; // point to the address of ADC continuously fast sampling output
  uint16_t adc_num = num_samples; // sampling number of ADC continuously fast sampling, range [1, 65535]
  uint8_t adc_clk_div = 8; // ADC working clock = 80M/adc_clk_div, range [8, 32], the recommended value is 8

  WIRELESS_set_opmode(NULL_MODE);
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

String indexSVG(String dir) {
  String out = "";

  Dir files = LittleFS.openDir(dir);
  while (files.next()) {
    if (files.fileName().endsWith("svg")) {
      out += files.fileName() + "\n";
    }
  }
  out = out.substring(0, (out.length() - 2));
  return out;
}

void dataLog(String text) {
  if (DATA_LOG == 1) {
    FSInfo fs_info;
    LittleFS.info(fs_info);
    if ((fs_info.usedBytes + text.length() + 1) < fs_info.totalBytes) {
      File file = LittleFS.open("data.log", "a");
      file.print(text);
      file.print('\n');
      file.close();
    } else {
      LittleFS.remove("data.log");
    }
  }
}

void runPump() {
#if DEBUG
  Serial.println("MOISTURE LIMIT:" + String(PLANT_SOIL_MOISTURE));
  Serial.println("TIMER:" + String(PLANT_MANUAL_TIMER));
#endif

  uint32_t duration = PLANT_POT_SIZE;

  //Watering Map -  Different soils takes different time to soak the water
  //===================
  uint8_t moss[] = { 1, 0, 1, 0 };
  uint8_t loam[] = { 1, 1, 0, 1 };
  uint8_t sand[] = { 1, 1, 0, 0 };
  uint8_t pulse[duration];
  uint8_t arraymap = 0;

  for (uint8_t x = 0; x <= sizeof(pulse); x++) {
    if (arraymap == 4) {
      arraymap = 0;
    }
    if (PLANT_SOIL_TYPE == 0) {
      pulse[x] = moss[arraymap];
    } else if (PLANT_SOIL_TYPE == 1) {
      pulse[x] = loam[arraymap];
    } else if (PLANT_SOIL_TYPE > 3) {
      pulse[x] = sand[arraymap];
    } else {
      pulse[x] = 1;
    }
    arraymap++;
  }
  uint16_t water = 100;
  /*
    loopback wire from water jug to A0 powered from GPIO12
  */
  if (PNP_ADC[2] == '1') {
    water = waterLevelRead();
  }
  //===================
  if(water > 0) {
    turnNPNorPNP(1); //ON
    do {
      if (pulse[duration] == 1) {
        turnNPNorPNP(1); //ON
      } else {
        turnNPNorPNP(0); //OFF
      }
      delay(1000);
      duration--;
    } while (duration > 0);
    turnNPNorPNP(0); //OFF

    if (ALERTS[3] == '1')
    smtpSend("Run Pump", String(PLANT_POT_SIZE));

    dataLog("T:" + String(PLANT_MANUAL_TIMER) + ",M:" + String(PLANT_SOIL_MOISTURE));
  }
  rtcData.emptyBottle++;  //Sensorless Empty Detection

  calibrateDeepSleep(); //next sleep compensate for pump runtime
}

uint16_t waterLevelRead() {
  uint16_t level = 100;
  uint16_t water = sensorRead(watersensorPin_100);
  if(water < 1000) {
    level = 75;
    water = sensorRead(watersensorPin_75);
    if(water < 1000) {
      level = 50;
      water = sensorRead(watersensorPin_50);
      if(water < 1000) {
        level = 25;
        water = sensorRead(watersensorPin_25);
        if(water < 1000) {
          level = 0;
        }
      }
    }
  }
  return level;
}

#ifdef ESP8266
uint16_t sensorRead_ESP8266(uint16_t enablePin) {
    uint16_t result = 1024;

    //A0 conflicts with WiFi Module (to reflect accurate readings from GUI turn ON WiFi during ADC)
    //-----------------
    if (WiFi.getMode() == WIFI_OFF) {
      WiFi.mode(WIFI_AP); //WiFi.begin();
      result = sensorRead(enablePin);
      WiFi.mode(WIFI_OFF);
    }else{
      result = sensorRead(enablePin);
    }
    return result;
}
#endif

uint16_t sensorRead(uint16_t enablePin) {
  uint16_t result = 1024;

  if (ADCMODE == ADC_TOUT) {

    /*
      adcAttachPin(moistureSensorPin);
      analogReadResolution(11);
      analogSetAttenuation(ADC_6db);
    */
    for (uint8_t i = 0; i <= (uint8_t)PNP_ADC[1]; i++) {
      analogRead(moistureSensorPin);  //Discharge any capacitance
    }

    pinMode(moistureSensorPin, INPUT);
    digitalWrite(moistureSensorPin, LOW); //Internal pull-up OFF
    digitalWrite(enablePin, HIGH);  //ON

    result = analogRead(moistureSensorPin);  //readADC()
    /*
    if (WiFi.getMode() == WIFI_OFF) {
      result -= ADC_ERROR_OFFSET;
    }
    */
    digitalWrite(enablePin, LOW);  //OFF
    digitalWrite(moistureSensorPin, HIGH); //Internal pull-up ON (20k resistor)

#if DEBUG
    Serial.printf("Deep Sleep: %u\n", DEEP_SLEEP);
    Serial.printf("Plant Timer: %u\n", PLANT_MANUAL_TIMER);
    Serial.printf("Sensor: %u\n", result);
#endif
  }

  return result;
}
/*
uint16_t readADC() {
  //0.1uF (103 or 104) cap between ADC and GND
  //A0 sensitivity is different for ESP-Modules
  //ADC conversions in about 6-10 microseconds
  //A0 -> 10K to GND (20k for NodeMCU)

  //=============
  //Take Lowest
  //=============
  /
    uint16_t result = 1024;
    for (uint8_t i = 0; i < 8; i++) {
      //delay(1);
      int a = analogRead(moistureSensorPin);
      if (a < result) {
        result = a;
      }
    }
  /
  //=============
  //Average
  //=============
  uint16_t result = 0;
  for (uint8_t i = 0; i < 8; i++) {
    result += analogRead(moistureSensorPin);
  }
  result = result / 8;  //Average 8
  //result = (result >> 4); //Average 16 using Shift 4
  //result = (result >> 3); //Average 8 using Shift 3

  return  result;
}
*/
/*
  char* string2char(String command) {
  if (command.length() != 0) {
    char *p = const_cast<char*>(command.c_str());
    return p;
  }
  }
*/
#if THREADED
void blinkThread()  //ICACHE_RAM_ATTR void
{
  //All variables that are used by interrupt service routine declared as "volatile"
  if (blinkDuration == 0) {
    digitalWrite(ledPin, HIGH);  //OFF
    blinkTick.detach();
  } else {
    digitalWrite(ledPin, !digitalRead(ledPin));
  }
  blinkDuration--;
}
/*
void blinkLoop(_blink *src) {
  blinky(src->timer, src->duration, 1);
}
*/
#endif

void blinkMorse(uint16_t moisture) {
  //for (uint16_t i = 1000 ; i >= 1; i=div10(i)) {
  for (uint8_t i = 100; i >= 1; i /= 10) {
    uint8_t d = (moisture / i) % 10;
    blinky(600, d, 0);  //blink a zero with a quick pulse
    delay(1200);
    //_blink arg = {1, 400, d};
    //blinkTick.once(1200, blinkLoop, &arg);
  }
}

void blinky(uint16_t timer, uint16_t duration, uint8_t threaded) {

  if (duration == 0) {
    duration = 1;
    timer = 40;
  }
  pinMode(ledPin, OUTPUT);

#if THREADED
  if (threaded > 0) {
    blinkDuration = duration * 2;  //toggle style
    blinkTick.attach_ms(timer, blinkThread);
  } else {
#endif
    blinkDuration = duration;

    /*
        LED swapped HIGH with LOW
        LED is shared with GPIO2. ESP will need GPIO2 on HIGH level in order to boot.
      */
    //Note: This loop will Resume after restart if blinking was in progress
    while (blinkDuration > 0 && blinkDuration < 65535) {
      //digitalWrite(ledPin, HIGH); //ON
      digitalWrite(ledPin, LOW);  //ON
      delay(timer);
      //digitalWrite(ledPin, LOW); //OFF
      digitalWrite(ledPin, HIGH);  //OFF
      delay(timer);
      blinkDuration--;  //after restart will be uninitialized 65536
#if DEBUG
      Serial.printf("blink: %u\n", blinkDuration);
#endif
    }
#if THREADED
  }
#endif
}
//=============
// NVRAM CONFIG
//=============
String NVRAM(uint8_t from, uint8_t to, uint8_t *maskValues) {

  String out = "{\n\t\"nvram\": [\"";
  out += ESP.getCoreVersion();  //ESP.getFullVersion();
  out += "|";
  out += ESP.getSdkVersion();
  out += "|";
  out += LFS_VERSION;
  out += "|";
  out += _VERSION;
  out += "|";
  {
    HeapSelectIram ephemeral;
    out += ESP.getFreeHeap();
#if DEBUG
    Serial.printf("IRAM free: %6d bytes\r\n", ESP.getFreeHeap());
#endif
  }
  out += "|";
  {
    HeapSelectDram ephemeral;
    out += ESP.getFreeHeap();
#if DEBUG
    Serial.printf("DRAM free: %6d bytes\r\n", ESP.getFreeHeap());
#endif
  }
  out += "\",";

  for (uint8_t i = from; i <= to; i++) {
    bool masked = false;
    for (uint8_t m = 0; m <= sizeof(maskValues); m++) {
      if (maskValues[m] == i) {
        masked = true;
        break;
      }
    }
    if (masked) {
      if (DEMO_PASSWORD == "") {
        out += "\"\",";
      } else {
#if DEBUG
        Serial.printf("NVRAM Mask: %u\n", i);
#endif
        out += "\"*****\",";
      }
    } else {
      String escaped = NVRAM_Read(i);
      out += "\"";
      out += escaped;
      out += "\",";
    }
  }

  out = out.substring(0, (out.length() - 1));
  out += "]\n}";

  return out;
}

void NVRAM_Erase() {
  for (uint32_t i = 0; i < EEPROM.length(); i++) {
    EEPROM.write(i, 255);
  }
  EEPROM.commit();
}

uint8_t NVRAM_Offset(uint8_t index) {
  uint8_t offset = 0;
  for (uint8_t i = 0; i < index; i++) {
    offset += NVRAM_Map[i];  // + 1;
  }
  return offset;
}

void NVRAM_Write(uint8_t address, String txt) {

  char arrayToStore[32];
  memset(arrayToStore, 0, sizeof(arrayToStore));
  txt.toCharArray(arrayToStore, sizeof(arrayToStore));  // Convert string to array.
  EEPROM.put(address * sizeof(arrayToStore), arrayToStore);

  //#if DEBUG
  //Serial.printf("arrayToStore: %u > %u Offset: %u\n", address, NVRAM_Map[address], NVRAM_Offset(address));
  //#endif
  //char *arrayToStore = new char[NVRAM_Map[address]+1];
  //memset(arrayToStore, 0, sizeof(arrayToStore));
  //txt.toCharArray(arrayToStore, sizeof(arrayToStore));  // Convert string to array.
  //EEPROM.put(NVRAM_Offset(address), arrayToStore);

  //EEPROM.write(0, 0xde);

  EEPROM.commit();
}

String NVRAM_Read(uint8_t address) {

  char arrayToRead[32];
  EEPROM.get(address * sizeof(arrayToRead), arrayToRead);

  //#if DEBUG
  //Serial.printf("arrayToRead: %u > %u Offset: %u\n", address, NVRAM_Map[address], NVRAM_Offset(address));
  //#endif
  //char *arrayToRead = new char[NVRAM_Map[address]+1];
  //EEPROM.get(NVRAM_Offset(address), arrayToRead);

  //EEPROM.read(0);

  return String(arrayToRead);
}

void NVRAM_Read_Config() {

  DEEP_SLEEP = NVRAM_Read(_DEEP_SLEEP).toInt() * 60;
  LOG_INTERVAL = NVRAM_Read(_LOG_INTERVAL).toInt();

  DATA_LOG = NVRAM_Read(_DATA_LOG).toInt();
  PLANT_POT_SIZE = NVRAM_Read(_PLANT_POT_SIZE).toInt();
  PLANT_SOIL_MOISTURE = NVRAM_Read(_PLANT_SOIL_MOISTURE).toInt();
  PLANT_SOIL_TYPE = NVRAM_Read(_PLANT_SOIL_TYPE).toInt();
  PLANT_TYPE = NVRAM_Read(_PLANT_TYPE).toInt();

  //==========
  String nvram = NVRAM_Read(_PNP_ADC);
  nvram.toCharArray(PNP_ADC, sizeof(nvram));
  turnNPNorPNP(0);
}

void turnNPNorPNP(uint8_t state) {
  if (PNP_ADC[0] == '1' && state == 0) {
    pinMode(pumpPin, INPUT_PULLUP); //Float the pin for PNP off
  }else{
    digitalWrite(pumpPin, state);
    pinMode(pumpPin, OUTPUT);
  }
}

void calibrateDeepSleep() {
  if(DEEP_SLEEP > 1) {
    uint32_t internalRunTime = millis() * 1000; //microseconds micros()
    if(DEEP_SLEEP > internalRunTime)
      DEEP_SLEEP = DEEP_SLEEP - internalRunTime;
  }
}

void offsetTiming() {

  //ESP8266 Bootloader 2.2.2 - 1 hour interval = 2x 30 min intervals (double)
  //ESP8266 Bootloader 2.4.1 - 1 hour interval can be 1 to 1

  PLANT_MANUAL_TIMER = NVRAM_Read(_PLANT_MANUAL_TIMER).toInt();

  //if (ALERTS[8] == '1')
  //  DEEP_SLEEP = 900; //15 minutes

  //Sleep set and Logging is OFF
  /*
  if (DEEP_SLEEP > 1 && DATA_LOG < 1 && PLANT_MANUAL_TIMER > 0) {
    PLANT_MANUAL_TIMER = PLANT_MANUAL_TIMER * 2;  //calculate loop for ESP.deepSleep()
    delayBetweenAlertEmails = 1 * 60 / 30;        //2 hours as 30 min loops
    delayBetweenRefillReset = 2 * 60 / 30;        //2 hours as 30 min loops
    delayBetweenOverfloodReset = 8 * 60 / 30;     //8 hours as 30 min loops
    DEEP_SLEEP = 1800;                            //30 min
  } else {  //Always ON or Logging ON
  */
  uint16_t loopTime = (LOG_INTERVAL + DEEP_SLEEP); //as total seconds
  //if(loopTime == 0) //Warning: ESP8266 will crash if devided by zero
  //  loopTime = 1;
  PLANT_MANUAL_TIMER = (PLANT_MANUAL_TIMER * 3600) / loopTime; //wait hours (minus pump on time) to loops
  delayBetweenAlertEmails = 1 * 3600 / loopTime;             //1 hours as loops of seconds
  delayBetweenRefillReset = 2 * 3600 / loopTime;             //2 hours as loops of seconds
  delayBetweenOverfloodReset = 8 * 3600 / loopTime;          //8 hours as loops of seconds
  //}

  DEEP_SLEEP_S = DEEP_SLEEP;      //store in seconds - no need to convert in loop()
  LOG_INTERVAL_S = LOG_INTERVAL;  //store in seconds - no need to convert in loop()

  DEEP_SLEEP = DEEP_SLEEP * 1000;      //milliseconds millis()
  DEEP_SLEEP = DEEP_SLEEP * 1000;      //microseconds micros()
  LOG_INTERVAL = LOG_INTERVAL * 1000;  //milliseconds millis()
}

/*
char NVRAM_Read_Dynamic(uint32_t address) {
  char arrayToStore[32];
  EEPROM.get(address * sizeof(arrayToStore), arrayToStore);

  char result[] = "";
  String nvram = String(arrayToStore);
  nvram.toCharArray(result, nvram.length() + 1);

  char arrTest1[nvram.length() + 1];
  strcpy(arrTest1, result);

  return 0;
}
*/
String getContentType(String filename) {
  if (filename.endsWith("html"))
    return text_html;
  else if (filename.endsWith("css"))
    return "text/css";
  else if (filename.endsWith("js"))
    return "application/javascript";
  /*
  else if (filename.endsWith("png"))
    return "image/png";
  else if (filename.endsWith("jpg"))
    return "image/jpeg";
  */
  else if (filename.endsWith("ico"))
    return "image/x-icon";
  else if (filename.endsWith("svg"))
    return "image/svg+xml";
  return text_plain;
}

//===============
//Web OTA Updater
//===============
void WebUpload(AsyncWebServerRequest *request, String filename, size_t index, uint8_t *data, size_t len, bool final) {
  if (!index) {

    //WARNING: Do not save RTC memory after Update.begin(). "chksum" will be different after reboot, firmware will not flash
    /*
    memset(&rtcData, 0, sizeof(rtcData));  //reset RTC memory (set all zero)
    ESP.rtcUserMemoryWrite(32, (uint32_t *)&rtcData, sizeof(rtcData));
    */
    blinkDuration = 0;

    Update.runAsync(true);  // tell the updaterClass to run in async mode

    if (filename.indexOf("fs") != -1) {
      //if (request->hasParam("filesystem", true)) {
      close_all_fs();

#if (ARDUINO_ESP8266_MAJOR >= 3 && ARDUINO_ESP8266_MINOR >= 1)
      size_t fsSize = ((size_t)FS_end - (size_t)FS_start);  //3.1.x
#else
      size_t fsSize = ((size_t)&_FS_end - (size_t)&_FS_start);
#endif
#if DEBUG
      Serial.printf("Free Filesystem Space: %u\n", fsSize);
      Serial.printf("Filesystem Offset: %u\n", U_FS);
#endif
      if (!Update.begin(fsSize, U_FS))  //start with max available size
        Update.printError(Serial);
    } else {
      uint32_t maxSketchSpace = (ESP.getFreeSketchSpace() - 0x1000) & 0xFFFFF000;  //calculate sketch space required for the update
#if DEBUG
      Serial.printf("Free Scketch Space: %u\n", maxSketchSpace);
      Serial.printf("Flash Offset: %u\n", U_FLASH);
#endif
      if (!Update.begin(maxSketchSpace, U_FLASH))  //start with max available size
        Update.printError(Serial);
    }
  }

  if (!Update.hasError())
    if (Update.write(data, len) != len)
      Update.printError(Serial);

  if (final) {
    if (!Update.end(true)) {
      Update.printError(Serial);
    }
  }
}

void onUpload(AsyncWebServerRequest *request, String filename, size_t index, uint8_t *data, size_t len, bool final) {
  if (!index) {
    request->_tempFile = LittleFS.open(filename, "w");
  }
  if (len) {
    // stream the incoming chunk to the opened file
    request->_tempFile.write(data, len);
  }
  if (final) {
    request->_tempFile.close();
  }
}

void smtpSend(String subject, String body) {

#if DEBUG
  Serial.printf("Email: %s\n", subject);
#endif
  if (rtcData.alertTime < delayBetweenAlertEmails) {
#if DEBUG
    Serial.printf("Email Timeout: %u (%u)\n", delayBetweenAlertEmails, rtcData.alertTime);
#endif
    return;
  }
  /*
  WIRELESS_MODE = NVRAM_Read(_WIRELESS_MODE).toInt();
  if (WIRELESS_MODE == 0)  //cannot send email in AP mode
    return;
  */
  byte off = 0;
  if (WiFi.getMode() == WIFI_OFF)  //alerts during off cycle
  {
    setupWiFi(0);  //turn on temporary
    off = 1;
  }

#if DEBUG
  smtp.debug(1);
  Serial.printf("Unix time: %u\n", timeClient.getEpochTime());
#endif
  smtp.setSystemTime(timeClient.getEpochTime());  //timestamp (seconds since Jan 1, 1970)

  String smtpServer = NVRAM_Read(_SMTP_SERVER);
  uint8_t smtpPort = 25;
  uint8_t smtpPortIndex = smtpServer.indexOf(':');
  if (smtpPortIndex != -1) {
    smtpPort = smtpServer.substring(smtpPortIndex + 1, smtpServer.length()).toInt();
    smtpServer = smtpServer.substring(0, smtpPortIndex);
  }

  session.server.host_name = smtpServer;
  session.server.port = smtpPort;
  session.login.email = NVRAM_Read(_SMTP_USERNAME);
  File oauth = LittleFS.open("/oauth", "r");
  if (oauth) {
    session.login.accessToken = oauth.readString();  //XOAUTH2
  } else {
    session.login.password = NVRAM_Read(_SMTP_PASSWORD);
  }
  //session.login.user_domain = "";

  if (smtp.connect(&session)) {
    message.sender.name = PLANT_NAME;
    message.sender.email = NVRAM_Read(_SMTP_USERNAME);
    message.addRecipient("", NVRAM_Read(_EMAIL_ALERT));
    //message.addCc("");
    //message.addBcc("");
    message.subject = subject;
    message.text.content = body;
    if (ALERTS[7] == '1') {
      message.priority = esp_mail_smtp_priority::esp_mail_smtp_priority_high;
    } else {
      message.priority = esp_mail_smtp_priority::esp_mail_smtp_priority_normal;
    }

    if (!MailClient.sendMail(&smtp, &message, true)) {
#if DEBUG
      Serial.println(smtp.errorReason());
#endif
    }
    smtp.sendingResult.clear();  //clear sending result log
  }

  if (off == 1)
    WiFi.mode(WIFI_OFF);
}

/*
String uint64ToString(uint64_t input) {
  String result = "";
  uint8_t base = 10;

  do {
    char c = input % base;
    input /= base;

    if (c < 10)
      c +='0';
    else
      c += 'A' - 10;
    result = c + result;
  } while (input);
  return result;
}
*/
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
