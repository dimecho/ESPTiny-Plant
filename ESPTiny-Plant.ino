/*
NodeMCU 0.9 (ESP-12 Module)  > blue 16 pins
NodeMCU 1.0 (ESP-12E Module) > black 22 pins

Remember: Brand new ESP-12 short GPIO0 to GND (flash mode) then UART TX/RX
*/

#include "semver/version.h"

#define DEBUG 0
#define TIMECLIENT_NTP 0
//#define ARDUINO_SIGNING 0
#define EEPROM_ID 0xAB02  //Identify Sketch by EEPROM
#define EMAILCLIENT_SMTP 0
#define ASYNCSERVER_DNS 0
#define SYNCSERVER_mDNS 0
#define WPA2ENTERPRISE 0
//-----------------------------
#define ASYNC_TCP_SSL_ENABLED 0  //ESP32 async HTTPS (ESP8266 SDK3.x removed OpenSSL)
// OR
#define SYNC_TCP_SSL_ENABLE 0  //ESP8266/ESP32 vanilla HTTPS
//-----------------------------
/*
Notes for Async HTTPS
  - For ESP8266 modify line 5 in async_config.h to "#define ASYNC_TCP_SSL_ENABLED 1"
  - For ESP32 use AsyncTCPSock library, may need to add "#define ASYNC_TCP_SSL_ENABLED 1" to all /src .cpp/.h files
*/
//#define ASYNCWEBSERVER_REGEX 1  //<regex> will add 100k to binary
/*
  To Activate RegEx:
  
  MacOS: ~/Library/Arduino15/packages/esp8266/hardware/esp8266/3.1.1/platform.txt
  Windows: C:\Users\<username>\AppData\Local\Arduino15\packages\esp8266\hardware\esp8266\3.1.1\platform.txt

  compiler.cpp.extra_flags=-DASYNCWEBSERVER_REGEX=1
*/
#include <LittleFS.h>
#define SPIFFS LittleFS

//#define ATOMIC_FS_UPDATE  //gzip works with 4MB (FS: 1MB, OTA ~1019kB)
/*
  Notes: signed and gzip binary do not work well together, SDK 3.0.x seem to break gzip

  To Activate LittleFS gzip binary
  
  MacOS: ~/Library/Arduino15/packages/esp8266/hardware/esp8266/3.1.2/platform.txt
  Windows: C:\Users\<username>\AppData\Local\Arduino15\packages\esp8266\hardware\esp8266\3.1.2\platform.txt

  build.extra_flags=-DESP8266 -DATOMIC_FS_UPDATE
*/
/*
#if FLASH_MAP_SUPPORT && ADRUINO_SIGNING
  FLASH_MAP_SETUP_CONFIG(FLASH_MAP_OTA_FS) //-DFLASH_MAP_SUPPORT=1
#endif
*/
#include <EEPROM.h>
#ifdef ESP32
#define LFS_VERSION 0x0002000b
#define U_FS U_SPIFFS
//#include <esp_chip_info.h>
//#define fs_info LittleFS
//#include <ESP32Ticker.h>
#include <WiFi.h>
#if WPA2ENTERPRISE
#include "esp_eap_client.h"  //WPA2 Enterprise
#endif
#if (ASYNC_TCP_SSL_ENABLED)
#define MBEDTLS_DEPRECATED_REMOVED
#define MBEDTLS_SSL_PROTO_TLS1_3
#undef MBEDTLS_SSL_PROTO_TLS1_2
#include <AsyncTCP_SSL.h>  //AsyncTCPSock over original AsyncTCP
#else
#include <AsyncTCP.h>
#endif
#include <AsyncUDP.h>
#include <Update.h>
#include <StreamString.h>
//#include "HTTP_Method.h"
#define WEBSERVER_H
#include "http_parser.h"
typedef enum http_method HTTPMethod;
#define HTTP_ANY (HTTPMethod)(255)
#elif defined(ESP8266)
#include <ESP8266WiFi.h>
#include <ESPAsyncTCP.h>
#include <ESPAsyncUDP.h>
#include <Updater.h>
#if (ARDUINO_ESP8266_MAJOR <= 3 && ARDUINO_ESP8266_MINOR < 1)
#include <StreamString.h>
#endif
extern "C" {
#include "user_interface.h"
#include "wpa2_enterprise.h"  //WPA2 Enterprise
}
/*
#if (ARDUINO_ESP8266_MAJOR >= 3)
//#include <coredecls.h> //for disable_extra4k_at_link_timer()
#include <umm_malloc/umm_heap_select.h>
#endif
*/
#endif
#if TIMECLIENT_NTP
#include <NTPClient.h>
#include <WiFiUDP.h>
#endif
/*
#ifdef ESP32
//#include <esp_bt.h>
#include "BluetoothSerial.h"
#if !defined(CONFIG_BT_ENABLED) || !defined(CONFIG_BLUEDROID_ENABLED)
#error Bluetooth is not enabled! Please run 'make menuconfig' to and enable it
#endif
#endif
*/
#if EMAILCLIENT_SMTP
//IMPORTANT: ESP8266 that don't have external SRAM/PSRAM chip installed choose the MMU option 3, 16KB cache + 48KB IRAM and 2nd Heap (shared)
#define DISABLE_PSRAM
#define esp_ssl_debug_print esp_ssl_debug_info
#include <ESP_Mail_Client.h>  //ESP-12E SRAM:64KB

//Must be defined globally, otherwise "Fatal exception 28(LoadProhibitedCause)"
SMTPSession smtp;
ESP_Mail_Session session;
SMTP_Message message;
#endif

#if ASYNCSERVER_DNS
#include <ESPAsyncDNSServer.h>
#else
#if SYNCSERVER_mDNS
#if defined(ESP8266)
#include <ESP8266mDNS.h>
#else
#include <ESPmDNS.h>
#endif
#endif
#endif
//#include <CapacitiveSensor.h>
//#include <time.h>

#if (ASYNC_TCP_SSL_ENABLED || SYNC_TCP_SSL_ENABLE)
String HTTPS_FQDN = "plant.local";  //SSL certificate match CN
uint8_t SSLPrivateKey[] = {
  0x30, 0x82, 0x02, 0x5b, 0x02, 0x01, 0x00, 0x02, 0x81, 0x81, 0x00, 0xc9, 0xb7, 0xd7, 0xa7, 0x01,
  0x8b, 0xe7, 0x87, 0x2d, 0x74, 0x34, 0x0a, 0xf4, 0xc7, 0xf6, 0x58, 0x30, 0x9f, 0x7e, 0x6c, 0xa5,
  0x48, 0xf4, 0x87, 0x4b, 0x32, 0x04, 0xf7, 0x6b, 0x86, 0x61, 0x4e, 0x54, 0x67, 0x64, 0x58, 0x4a,
  0xe5, 0x54, 0x85, 0x73, 0xc7, 0x88, 0x6a, 0x16, 0x8b, 0x67, 0x18, 0x27, 0x5f, 0xae, 0xed, 0xd9,
  0xff, 0xb8, 0x81, 0xd8, 0x67, 0xb7, 0x2f, 0xdb, 0x0c, 0xbf, 0x77, 0x63, 0x59, 0x06, 0x9b, 0xd9,
  0x7d, 0x11, 0x53, 0x11, 0xbb, 0x32, 0xad, 0x52, 0x77, 0x57, 0xf6, 0x47, 0xa7, 0x2b, 0x8a, 0x84,
  0xe8, 0x24, 0x95, 0x81, 0xaa, 0x59, 0x3e, 0xfa, 0xb6, 0x51, 0x46, 0x03, 0xcf, 0x11, 0xc0, 0x69,
  0x15, 0x13, 0x2b, 0x11, 0x27, 0x22, 0xa5, 0x06, 0x96, 0x33, 0x2d, 0xd5, 0xb3, 0x92, 0xd2, 0xbc,
  0xf5, 0x58, 0x1b, 0xf2, 0x69, 0x25, 0x50, 0x80, 0xef, 0xe0, 0x97, 0x02, 0x03, 0x01, 0x00, 0x01,
  0x02, 0x81, 0x80, 0x6c, 0xac, 0x21, 0x7f, 0x34, 0xa3, 0x15, 0xb1, 0xca, 0xb8, 0x1e, 0xcd, 0x84,
  0x40, 0x32, 0x24, 0x22, 0xd5, 0xda, 0x3b, 0x57, 0xf4, 0x6c, 0xe0, 0x72, 0x8f, 0x59, 0x03, 0x9e,
  0xa6, 0xff, 0xc7, 0x3e, 0x4b, 0x91, 0x50, 0xcb, 0xd0, 0xae, 0xef, 0x52, 0x87, 0xbd, 0xa3, 0x41,
  0xd0, 0x0a, 0x53, 0x85, 0xea, 0xd3, 0x88, 0x0a, 0x78, 0xed, 0x02, 0xee, 0xfe, 0x39, 0x3f, 0x8b,
  0xe8, 0x5b, 0x41, 0x55, 0xe5, 0xbd, 0x8c, 0xee, 0x71, 0xa3, 0x5f, 0x52, 0xb5, 0x4b, 0xa9, 0x8d,
  0xfb, 0x9e, 0x00, 0xd9, 0x39, 0xc9, 0xab, 0x98, 0x9f, 0x57, 0x58, 0xf5, 0x0c, 0x10, 0x00, 0x35,
  0x49, 0x3b, 0x35, 0x05, 0x42, 0x1b, 0xc6, 0x56, 0x3d, 0x86, 0xdc, 0x71, 0xf7, 0x9f, 0x08, 0x62,
  0xa3, 0x4e, 0x23, 0x20, 0x39, 0xd3, 0x5d, 0x4a, 0xc5, 0x24, 0xd5, 0xaf, 0xeb, 0x39, 0xbc, 0xb3,
  0x34, 0x36, 0x79, 0x02, 0x41, 0x00, 0xf5, 0xd3, 0x2b, 0xe8, 0x1b, 0x8d, 0xf7, 0xff, 0x0e, 0x39,
  0xa6, 0xf8, 0xd6, 0xdd, 0xc7, 0x2b, 0x84, 0xd0, 0x8f, 0xa3, 0xa3, 0xe1, 0x0b, 0x42, 0x0d, 0x7f,
  0x83, 0xca, 0x88, 0x38, 0xf2, 0xae, 0x01, 0x2d, 0x82, 0x4e, 0xc8, 0x9f, 0x48, 0xb5, 0xad, 0x45,
  0x89, 0x2d, 0x50, 0xca, 0xd5, 0x9a, 0xf4, 0x3e, 0x9f, 0x05, 0xca, 0x72, 0xba, 0x54, 0x85, 0x6a,
  0xeb, 0x35, 0xcf, 0xb0, 0xb0, 0x25, 0x02, 0x41, 0x00, 0xd2, 0x11, 0x4d, 0xb3, 0x4c, 0xb7, 0xb6,
  0x57, 0x92, 0xbd, 0x26, 0xa3, 0x86, 0xa9, 0xc5, 0x5e, 0xe2, 0x3a, 0xab, 0x52, 0x40, 0x97, 0x9c,
  0xd2, 0x81, 0x34, 0x33, 0x8b, 0x89, 0xe0, 0x93, 0xbb, 0x74, 0x9c, 0x67, 0xa4, 0x40, 0x40, 0x72,
  0x62, 0x79, 0x6f, 0xe3, 0x0f, 0xe1, 0xf7, 0xc3, 0x5b, 0x13, 0xa7, 0x58, 0xfb, 0xa9, 0x99, 0xf5,
  0x8a, 0xe4, 0x3d, 0x0e, 0x81, 0xa5, 0x32, 0x63, 0x0b, 0x02, 0x40, 0x6b, 0x2a, 0xfb, 0xba, 0x3d,
  0xc0, 0xff, 0xbb, 0xbe, 0xdc, 0xdd, 0x71, 0x20, 0x63, 0x21, 0x40, 0x54, 0xaf, 0x83, 0xdf, 0x68,
  0x43, 0x64, 0xe0, 0x0f, 0xf8, 0x66, 0x61, 0x36, 0x4f, 0xf5, 0x64, 0x6c, 0x79, 0x05, 0x95, 0x09,
  0x1b, 0x7f, 0xdc, 0x4c, 0x44, 0xc3, 0x4f, 0xf1, 0x27, 0xec, 0x45, 0x98, 0x73, 0x70, 0x6a, 0x5a,
  0xde, 0xf7, 0x62, 0x7f, 0xa3, 0xa4, 0x15, 0x1a, 0x8d, 0x41, 0xcd, 0x02, 0x40, 0x0b, 0xfc, 0xe8,
  0xce, 0x3e, 0xa6, 0x8d, 0x45, 0x5a, 0x1e, 0x69, 0x42, 0x13, 0xc1, 0x44, 0x7e, 0x31, 0xb2, 0xdf,
  0x6c, 0x06, 0x3b, 0xa0, 0xbb, 0x72, 0x9c, 0x24, 0x04, 0xe6, 0x8d, 0x66, 0x60, 0xe0, 0x3a, 0xbc,
  0xbf, 0x66, 0xdb, 0x46, 0xab, 0xcf, 0xfa, 0x4e, 0x9e, 0xed, 0x6a, 0x52, 0x3f, 0xb4, 0x53, 0x6c,
  0x84, 0x90, 0x1d, 0x35, 0x22, 0x03, 0xfc, 0x68, 0x03, 0x86, 0x05, 0xe6, 0x19, 0x02, 0x40, 0x25,
  0x61, 0xc9, 0x0a, 0x74, 0x18, 0xf8, 0xce, 0x5a, 0xf4, 0x99, 0x37, 0xca, 0x78, 0x59, 0x17, 0x6c,
  0x8d, 0xa4, 0x8c, 0x1b, 0xbb, 0x6e, 0x9e, 0x8b, 0x7e, 0xb1, 0x26, 0x07, 0x92, 0xa8, 0xc9, 0xe9,
  0x38, 0x5d, 0xa1, 0x53, 0x4a, 0xae, 0x8d, 0x75, 0x5d, 0x45, 0xb3, 0x24, 0x21, 0x57, 0x06, 0x1b,
  0xd2, 0xb9, 0x40, 0xe5, 0xe3, 0xe0, 0x61, 0x6e, 0xf7, 0x9d, 0x21, 0xd8, 0x11, 0xb4, 0x08
};
uint8_t SSLCertificate[] = {
  0x30, 0x82, 0x02, 0x05, 0x30, 0x82, 0x01, 0x6e, 0x02, 0x09, 0x00, 0xc4, 0x40, 0x42, 0xcc, 0x23,
  0x1e, 0xcd, 0x61, 0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x0b,
  0x05, 0x00, 0x30, 0x47, 0x31, 0x0b, 0x30, 0x09, 0x06, 0x03, 0x55, 0x04, 0x06, 0x13, 0x02, 0x43,
  0x41, 0x31, 0x0e, 0x30, 0x0c, 0x06, 0x03, 0x55, 0x04, 0x0b, 0x0c, 0x05, 0x50, 0x6c, 0x61, 0x6e,
  0x74, 0x31, 0x12, 0x30, 0x10, 0x06, 0x03, 0x55, 0x04, 0x0a, 0x0c, 0x09, 0x74, 0x69, 0x6e, 0x79,
  0x70, 0x6c, 0x61, 0x6e, 0x74, 0x31, 0x14, 0x30, 0x12, 0x06, 0x03, 0x55, 0x04, 0x03, 0x0c, 0x0b,
  0x70, 0x6c, 0x61, 0x6e, 0x74, 0x2e, 0x6c, 0x6f, 0x63, 0x61, 0x6c, 0x30, 0x1e, 0x17, 0x0d, 0x32,
  0x33, 0x30, 0x31, 0x32, 0x33, 0x30, 0x33, 0x34, 0x34, 0x35, 0x30, 0x5a, 0x17, 0x0d, 0x32, 0x34,
  0x30, 0x31, 0x32, 0x33, 0x30, 0x33, 0x34, 0x34, 0x35, 0x30, 0x5a, 0x30, 0x47, 0x31, 0x0b, 0x30,
  0x09, 0x06, 0x03, 0x55, 0x04, 0x06, 0x13, 0x02, 0x43, 0x41, 0x31, 0x0e, 0x30, 0x0c, 0x06, 0x03,
  0x55, 0x04, 0x0b, 0x0c, 0x05, 0x50, 0x6c, 0x61, 0x6e, 0x74, 0x31, 0x12, 0x30, 0x10, 0x06, 0x03,
  0x55, 0x04, 0x0a, 0x0c, 0x09, 0x74, 0x69, 0x6e, 0x79, 0x70, 0x6c, 0x61, 0x6e, 0x74, 0x31, 0x14,
  0x30, 0x12, 0x06, 0x03, 0x55, 0x04, 0x03, 0x0c, 0x0b, 0x70, 0x6c, 0x61, 0x6e, 0x74, 0x2e, 0x6c,
  0x6f, 0x63, 0x61, 0x6c, 0x30, 0x81, 0x9f, 0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7,
  0x0d, 0x01, 0x01, 0x01, 0x05, 0x00, 0x03, 0x81, 0x8d, 0x00, 0x30, 0x81, 0x89, 0x02, 0x81, 0x81,
  0x00, 0xc9, 0xb7, 0xd7, 0xa7, 0x01, 0x8b, 0xe7, 0x87, 0x2d, 0x74, 0x34, 0x0a, 0xf4, 0xc7, 0xf6,
  0x58, 0x30, 0x9f, 0x7e, 0x6c, 0xa5, 0x48, 0xf4, 0x87, 0x4b, 0x32, 0x04, 0xf7, 0x6b, 0x86, 0x61,
  0x4e, 0x54, 0x67, 0x64, 0x58, 0x4a, 0xe5, 0x54, 0x85, 0x73, 0xc7, 0x88, 0x6a, 0x16, 0x8b, 0x67,
  0x18, 0x27, 0x5f, 0xae, 0xed, 0xd9, 0xff, 0xb8, 0x81, 0xd8, 0x67, 0xb7, 0x2f, 0xdb, 0x0c, 0xbf,
  0x77, 0x63, 0x59, 0x06, 0x9b, 0xd9, 0x7d, 0x11, 0x53, 0x11, 0xbb, 0x32, 0xad, 0x52, 0x77, 0x57,
  0xf6, 0x47, 0xa7, 0x2b, 0x8a, 0x84, 0xe8, 0x24, 0x95, 0x81, 0xaa, 0x59, 0x3e, 0xfa, 0xb6, 0x51,
  0x46, 0x03, 0xcf, 0x11, 0xc0, 0x69, 0x15, 0x13, 0x2b, 0x11, 0x27, 0x22, 0xa5, 0x06, 0x96, 0x33,
  0x2d, 0xd5, 0xb3, 0x92, 0xd2, 0xbc, 0xf5, 0x58, 0x1b, 0xf2, 0x69, 0x25, 0x50, 0x80, 0xef, 0xe0,
  0x97, 0x02, 0x03, 0x01, 0x00, 0x01, 0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d,
  0x01, 0x01, 0x0b, 0x05, 0x00, 0x03, 0x81, 0x81, 0x00, 0x79, 0x6f, 0x2d, 0xdd, 0xe7, 0x1f, 0xdf,
  0x95, 0xd0, 0xcc, 0xa7, 0x3d, 0xe2, 0xd2, 0xd2, 0xd6, 0x9e, 0xbe, 0xff, 0xcb, 0x0d, 0xc1, 0x01,
  0x78, 0x38, 0x63, 0x8e, 0xab, 0x11, 0x3f, 0xc8, 0x2a, 0xa5, 0x3e, 0xd4, 0xa1, 0x9d, 0x67, 0x8d,
  0xba, 0x63, 0xf3, 0x8d, 0xe5, 0xea, 0xcf, 0xec, 0x96, 0x43, 0x48, 0x96, 0x67, 0xe8, 0xeb, 0xd8,
  0x26, 0xa9, 0xa6, 0x2e, 0x21, 0xa3, 0xcf, 0x3d, 0xb9, 0x40, 0xb2, 0x1c, 0x46, 0xe6, 0xb0, 0xba,
  0x6d, 0x9d, 0x10, 0xe3, 0x11, 0xff, 0x5a, 0xc3, 0x2d, 0x64, 0x3d, 0xd8, 0x11, 0xde, 0xc3, 0xa9,
  0x82, 0xbb, 0x77, 0xfd, 0x00, 0xef, 0x40, 0xba, 0xfd, 0xa5, 0x1d, 0x86, 0x20, 0x02, 0xd8, 0x2b,
  0x74, 0x8d, 0x25, 0x93, 0x06, 0xe1, 0x1e, 0x29, 0x88, 0x78, 0x2f, 0x05, 0xbb, 0xea, 0xca, 0x5d,
  0x5c, 0x96, 0x7b, 0xf6, 0x27, 0xaf, 0xa7, 0x8b, 0xf4
};
#define WEBSERVER_H
#endif

#if (ASYNC_TCP_SSL_ENABLED)
#include <ESPAsyncWebServer.h>  //Latest from (mathieucarbou/ESPAsyncWebServer)
static AsyncWebServer httpserver(80);
static AsyncWebServer server(443);
#else
#if (SYNC_TCP_SSL_ENABLE)
#ifdef ESP8266
#include <ESP8266WebServerSecure.h>
BearSSL::ESP8266WebServerSecure secureServer(443);
BearSSL::ServerSessions secureCache(4);
#else  //ESP32
//Note: (esp-idf v4.4 has openssl but 5.x removed it) replace #include <hwcrypto/sha.h> #include <esp32/sha.h>
//https://github.com/fhessel/esp32_https_server_compat
//#include <ESPWebServerSecure.hpp>
//BearSSL::ESPWebServerSecure secureServer(443);
//https://github.com/espressif/esp-idf/blob/v5.4-dev/examples/protocols/https_server/simple/main/main.c
#include <esp_https_server.h>
#endif
#endif
#include <ESPAsyncWebServer.h>  //Latest from (mathieucarbou/ESPAsyncWebServer)
static AsyncWebServer server(80);
#endif

#if (ASYNCSERVER_DNS)
AsyncDNSServer dnsServer;
#endif
//ESP-01
//Pin 1 = Rx = GPIO3
//Pin 8 = Tx = GPIO1

#if defined(ARDUINO_ESP8266_NODEMCU_ESP12) || defined(ARDUINO_ESP8266_NODEMCU_ESP12E) || defined(ARDUINO_ESP8266_GENERIC)
#define pumpPin 5  //Output (D1 NodeMCU)
#elif defined(CONFIG_IDF_TARGET_ESP32S2)
#define pumpPin 5  //Output
#else
#define pumpPin 16  //Output WROOM32
#endif
#if defined(ARDUINO_ESP8266_NODEMCU_ESP12) || defined(ARDUINO_ESP8266_NODEMCU_ESP12E) || defined(ARDUINO_ESP8266_GENERIC)
#define sensorPin 4  //Output (D2 NodeMCU)
#elif defined(CONFIG_IDF_TARGET_ESP32S2)
#define sensorPin 4  //Output
#else
#define sensorPin 4  //Output WROOM32
#endif
#ifdef ESP32
/*
  * ADC2 can not be used when using WiFi
  * GPIO 1 (Analog ADC1_CHANNEL_0)
  * GPIO 2 (Analog ADC1_CHANNEL_1)
  */
//#include <esp_adc_cal.h>
#if CONFIG_IDF_TARGET_ESP32S2
#define watersensorPin_25 14   //Output
#define watersensorPin_50 13   //Output
#define watersensorPin_75 10   //Output
#define watersensorPin_100 8   //Output
#define ledPin 15              //Output
#define analogDigitalPin 2     //ADC1_CHANNEL_1  //Input
#else                          //WROOM32
#define watersensorPin_25 32   //Output
#define watersensorPin_50 25   //Output
#define watersensorPin_75 27   //Output
#define watersensorPin_100 12  //Output
#define ledPin 23              //Output
#define analogDigitalPin 36    //ADC1_CHANNEL_0  //Input
#endif
#elif defined(ESP8266)
#ifdef ARDUINO_ESP8266_GENERIC
#define watersensorPin_25 14   //Output
#define watersensorPin_50 12   //Output
#define watersensorPin_75 13   //Output
#define watersensorPin_100 13  //Output
#define ledPin 2               //Output (D4 NodeMCU) //LED_BUILTIN
#elif defined(ARDUINO_ESP8266_NODEMCU_ESP12) || defined(ARDUINO_ESP8266_NODEMCU_ESP12E)
#define watersensorPin_25 14   //Output (D5 NodeMCU)
#define watersensorPin_50 12   //Output (D6 NodeMCU)
#define watersensorPin_75 13   //Output (D7 NodeMCU)
#define watersensorPin_100 15  //Output (D8 NodeMCU)
#define ledPin 2               //Output (D4 NodeMCU)
#endif
#define analogDigitalPin A0  //Input

uint32_t ADCMODE;  //Global variable
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
#endif

//#define deepsleepPin                16  //GPIO16 to RESET (D0 NodeMCU)

#define UART_BAUDRATE 115200

#include <Ticker.h>
Ticker thread;
void runPumpThread(const uint8_t *pattern);
volatile uint16_t runPumpThreadDuration = 0;  //ISR-safe
void blinkThread();
volatile uint16_t blinkDuration = 0;  //ISR-safe
static char logbuffer[64];

const char text_html[] PROGMEM = "text/html";
const char text_plain[] PROGMEM = "text/plain";
const char text_json[] PROGMEM = "application/json";
const char locked_html[] PROGMEM = "Locked";
const char refresh_http[] PROGMEM = "Refresh";
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
#ifdef ESP32
//ESP32, RTC memory is only retained across deep sleep.
RTC_DATA_ATTR struct {
  uint64_t runTime;      //shedule tracking wifi on/off
  uint8_t ntpWeek;       //NTP day of week
  uint8_t ntpHour;       //NTP hour
  uint8_t emptyBottle;   //empty tracking
  uint16_t drySoilTime;  //dry soil tracking timeout
  uint16_t waterTime;    //pump tracking
  uint16_t moistureLog;  //moisture average tracking
  uint16_t alertTime;    //prevent email spam
} rtcData;
uint64_t loopTimer = 0;  //loop() slow down
#else
//ESP8266, the RTC user memory is retained across deep sleep and soft reset.
struct {
  uint32_t runTime;      //shedule tracking wifi on/off
  uint8_t ntpWeek;       //NTP day of week
  uint8_t ntpHour;       //NTP hour
  uint8_t emptyBottle;   //empty tracking
  uint16_t drySoilTime;  //dry soil tracking timeout
  uint16_t waterTime;    //pump tracking
  uint16_t moistureLog;  //moisture average tracking
  uint16_t alertTime;    //prevent email spam
} rtcData;
uint32_t loopTimer = 0;              //loop() slow down
#endif

uint32_t webTimer = 0;  //track last webpage access

#define _EEPROM_ID 0
#define _WIRELESS_MODE 1
#define _WIRELESS_HIDE 2
#define _WIRELESS_PHY_MODE 3
#define _WIRELESS_PHY_POWER 4
#define _WIRELESS_CHANNEL 5
#define _WIRELESS_SSID 6
#define _WIRELESS_USERNAME 7
#define _WIRELESS_PASSWORD 8
#define _LOG_ENABLE 9
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
  0,     //_EEPROM_ID 16
  16,    //_WIRELESS_MODE 8
  24,    //_WIRELESS_HIDE 8
  32,    //_WIRELESS_PHY_MODE 8
  40,    //_WIRELESS_PHY_POWER 8
  48,    //_WIRELESS_CHANNEL 8
  64,    //_WIRELESS_SSID 16
  160,   //_WIRELESS_USERNAME 96
  192,   //_WIRELESS_PASSWORD 32
  200,   //_LOG_ENABLE 8
  232,   //_LOG_INTERVAL 32
  240,   //_NETWORK_DHCP 8
  304,   //_NETWORK_IP 64
  368,   //_NETWORK_SUBNET 64
  432,   //_NETWORK_GATEWAY 64
  496,   //_NETWORK_DNS 64
  512,   //_PLANT_POT_SIZE 16
  528,   //_PLANT_SOIL_MOISTURE 16
  560,   //_PLANT_MANUAL_TIMER 32
  576,   //_PLANT_SOIL_TYPE 16
  592,   //_PLANT_TYPE 16
  624,   //_DEEP_SLEEP 32
  688,   //_EMAIL_ALERT 64
  752,   //_SMTP_SERVER 64
  848,   //_SMTP_USERNAME 96
  880,   //_SMTP_PASSWORD 32
  912,   //_PLANT_NAME 32
  928,   //_ALERTS 16
  960,   //_DEMO_PASSWORD 32
  976,   //_TIMEZONE_OFFSET 16
  992,   //_DEMO_AVAILABILITY 16
  1008,  //_PNP_ADC 16
  1024   //+1
};

uint8_t WIRELESS_MODE = 0;  //WIRELESS_AP = 0, WIRELESS_STA(WPA2) = 1, WIRELESS_STA(WPA2 ENT) = 2, WIRELESS_STA(WEP) = 3
//uint8_t WIRELESS_HIDE = 0;
uint8_t WIRELESS_PHY_MODE = 2;    //WIRELESS_PHY_MODE_11B = 1, WIRELESS_PHY_MODE_11G = 2, WIRELESS_PHY_MODE_11N = 3
uint8_t WIRELESS_PHY_POWER = 10;  //Max = 20.5dBm (some ESP modules 24.0dBm) should be multiples of 0.25
uint8_t WIRELESS_CHANNEL = 7;
char WIRELESS_SSID[16] = "Plant";
//char WIRELESS_USERNAME[] = "";
//char WIRELESS_PASSWORD[] = "";
uint8_t LOG_ENABLE = 0;      //data logger (enable/disable)
uint32_t LOG_INTERVAL = 30;  //loop() delay - seconds
//uint8_t NETWORK_DHCP = 0;
char NETWORK_IP[64] = "192.168.8.8";
char NETWORK_SUBNET[64] = "255.255.255.0";
//char NETWORK_GATEWAY[] = "";
//char NETWORK_DNS[] = "";
uint16_t PLANT_POT_SIZE = 4;  //pump run timer - seconds
#ifdef ESP32
uint16_t PLANT_SOIL_MOISTURE = 600;  //ADC value
#else
uint16_t PLANT_SOIL_MOISTURE = 400;  //ADC value
#endif
uint32_t PLANT_MANUAL_TIMER = 0;  //manual sleep timer - hours
uint16_t PLANT_SOIL_TYPE = 2;     //['Sand', 'Clay', 'Dirt', 'Loam', 'Moss'];
uint16_t PLANT_TYPE = 0;          //['Bonsai', 'Monstera', 'Palm'];
int DEEP_SLEEP = 8;               //auto sleep timer - minutes
//=============================
//String EMAIL_ALERT = "";
//String SMTP_SERVER = "";
//String SMTP_USERNAME = "";
//String SMTP_PASSWORD = "";
char PLANT_NAME[32] = "";
char ALERTS[] = "000000000";  //dhcp-ip, low-power, low-sensor, pump-run, over-water, empty-water, internal-errors, high-priority, led-code
//=============================
char DEMO_PASSWORD[32] = "";  //public demo
//char TIMEZONE_OFFSET[] = "-28800";       //UTC offset in seconds
char DEMO_AVAILABILITY[] = "00000000618";  //M, T, W, T, F, S, S + Time Range
//=============================
uint16_t delayBetweenAlertEmails = 0;     //2 hours = 2 x 60 = 120 minutes = x4 30 min loops
uint16_t delayBetweenRefillReset = 0;     //2 hours = 2 x 60 = 120 minutes = x4 30 min loops
uint16_t delayBetweenDrySoilReset = 0;    //4 hours = 4 x 60 = 240 minutes = x8 30 min loops + 1
uint16_t delayBetweenOverfloodReset = 0;  //8 hours = 8 x 60 = 480 minutes = x16 30 min loops
uint8_t ON_TIME = 0;                      //from 6am
uint8_t OFF_TIME = 0;                     //to 6pm
uint16_t LOG_INTERVAL_S = 0;              //seconds
uint16_t DEEP_SLEEP_S = 0;                //seconds
uint32_t DEEP_SLEEP_MS = 0;               //milliseconds
char PNP_ADC[] = "010";                   //0=NPN|1=PNP, ADC sensitivity, Water Level Sensor 0=Disable|1=Enable
//uint8_t ADC_ERROR_OFFSET = 64;           //WAKE_RF_DISABLED offset
static const uint8_t sand[] = { 1, 1, 0, 0 };
static const uint8_t loam[] = { 1, 1, 0, 1 };
static const uint8_t moss[] = { 1, 0, 1, 0 };
static const uint8_t dirt[] = { 1, 1, 1, 1 };
#if TIMECLIENT_NTP
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP);
#endif
/*
#if (CONFIG_IDF_TARGET_ESP32S2 && ARDUINO_ESP32_MAJOR >= 3)
#include "driver/temperature_sensor.h"
temperature_sensor_handle_t temp_handle = NULL;
temperature_sensor_config_t temp_sensor = {
  .range_min = 0,
  .range_max = 50,
};
#endif
*/
void setup() {
  pinMode(ledPin, OUTPUT);
  pinMode(analogDigitalPin, INPUT);
  pinMode(pumpPin, INPUT_PULLUP);  //Float the pin until set NPN or PNP
  //digitalWrite(sensorPin, LOW);
  //pinMode(sensorPin, OUTPUT);

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
  //Serial.println("deepSleepMax: %lu", ESP.deepSleepMax());
  //printMemory();
#endif

  //======================
  //NVRAM type of Settings
  //======================
  EEPROM.begin(1024);
  long eid = fastAtoi(NVRAMRead(_EEPROM_ID));
#if DEBUG
  Serial.print("EEPROM CRC Stored: 0x");
  Serial.println(eid, HEX);
  Serial.print("EEPROM CRC Calculated: 0x");
  Serial.println(EEPROM_ID, HEX);
#endif
  if (eid != EEPROM_ID) {
    //Check for multiple Plant SSIDs
    //WiFi.mode(WIFI_STA);
    //WiFi.disconnect();

    uint8_t n = WiFi.scanNetworks();
    for (uint8_t i = 0; i < n; ++i) {
#if DEBUG
      Serial.println(WiFi.SSID(i));
#endif
      if (WiFi.SSID(i) == WIRELESS_SSID) {
        snprintf(WIRELESS_SSID, sizeof(WIRELESS_SSID), "%s-%u", WIRELESS_SSID, i);
        break;
      }
    }
    //WiFi.scanDelete();
#ifdef ESP32
    LittleFS.begin(true);
#else
    LittleFS.begin();
#endif
    LittleFS.format();

    NVRAM_Erase();
    NVRAMWrite(_EEPROM_ID, (char *)EEPROM_ID);
    NVRAMWrite(_WIRELESS_MODE, (char *)WIRELESS_MODE);
    NVRAMWrite(_WIRELESS_HIDE, "0");
    NVRAMWrite(_WIRELESS_PHY_MODE, (char *)WIRELESS_PHY_MODE);
    NVRAMWrite(_WIRELESS_PHY_POWER, (char *)WIRELESS_PHY_POWER);
    NVRAMWrite(_WIRELESS_CHANNEL, (char *)WIRELESS_CHANNEL);
    NVRAMWrite(_WIRELESS_SSID, WIRELESS_SSID);
    NVRAMWrite(_WIRELESS_USERNAME, "");
    NVRAMWrite(_WIRELESS_PASSWORD, "");
    NVRAMWrite(_LOG_ENABLE, (char *)LOG_ENABLE);
    NVRAMWrite(_LOG_INTERVAL, (char *)LOG_INTERVAL);
    //==========
    NVRAMWrite(_NETWORK_DHCP, "0");
    NVRAMWrite(_NETWORK_IP, NETWORK_IP);
    NVRAMWrite(_NETWORK_SUBNET, NETWORK_SUBNET);
    NVRAMWrite(_NETWORK_GATEWAY, NETWORK_IP);
    NVRAMWrite(_NETWORK_DNS, NETWORK_IP);
    //==========
    NVRAMWrite(_PLANT_POT_SIZE, (char *)PLANT_POT_SIZE);
    NVRAMWrite(_PLANT_SOIL_MOISTURE, (char *)PLANT_SOIL_MOISTURE);
    NVRAMWrite(_PLANT_MANUAL_TIMER, (char *)PLANT_MANUAL_TIMER);
    NVRAMWrite(_PLANT_SOIL_TYPE, (char *)PLANT_SOIL_TYPE);
    NVRAMWrite(_PLANT_TYPE, (char *)PLANT_TYPE);
    NVRAMWrite(_DEEP_SLEEP, (char *)DEEP_SLEEP);
    //==========
    NVRAMWrite(_ALERTS, ALERTS);
    NVRAMWrite(_EMAIL_ALERT, "");
    NVRAMWrite(_SMTP_SERVER, "");
    NVRAMWrite(_SMTP_USERNAME, "");
    NVRAMWrite(_SMTP_PASSWORD, "");
    NVRAMWrite(_PLANT_NAME, WIRELESS_SSID);
    //==========
    NVRAMWrite(_DEMO_PASSWORD, DEMO_PASSWORD);
    NVRAMWrite(_TIMEZONE_OFFSET, "-28800");
    NVRAMWrite(_DEMO_AVAILABILITY, DEMO_AVAILABILITY);
    //==========
    NVRAMWrite(_PNP_ADC, PNP_ADC);         //TODO: based in flash ID
    memset(&rtcData, 0, sizeof(rtcData));  //reset RTC memory
  } else {
    NVRAMRead_Config();
    strncpy(ALERTS, NVRAMRead(_ALERTS), sizeof(ALERTS));
    //String nvram = NVRAMRead(_ALERTS);
    //nvram.toCharArray(ALERTS, sizeof(nvram));
    strncpy(DEMO_AVAILABILITY, NVRAMRead(_DEMO_AVAILABILITY), sizeof(DEMO_AVAILABILITY));
    //nvram = NVRAMRead(_DEMO_AVAILABILITY);
    //nvram.toCharArray(DEMO_AVAILABILITY, sizeof(nvram));
#ifdef ESP8266
    ESP.rtcUserMemoryRead(32, (uint32_t *)&rtcData, sizeof(rtcData));
    //ADCMODE = get_adc();
    //if (ADCMODE == ADC_VCC) {                                               //Measure VCC this runtime
    //  ESP.rtcUserMemoryWrite(100, (uint32_t *)ADC_TOUT, sizeof(ADC_TOUT));  //Next time measure ADC sensor
    //}
//#else
//printf("Opening Non-Volatile Storage (NVS) ... ");
//nvs_handle_t rtcData;
//nvs_open("storage", NVS_READWRITE, &rtcData);
//nvs_set_i32(rtcData, "100", ADC_TOUT);
#endif
  }
  //EEPROM.end();

  ON_TIME = fastAtoi2(&DEMO_AVAILABILITY[7], 2);
  OFF_TIME = fastAtoi2(&DEMO_AVAILABILITY[9], 2);
  strncpy(PLANT_NAME, NVRAMRead(_PLANT_NAME), sizeof(PLANT_NAME));

#ifdef ESP32
  uint8_t wakeupReason = esp_reset_reason();  // ESP.getResetReason();
#if (CONFIG_IDF_TARGET_ESP32S2 && ARDUINO_ESP32_MAJOR >= 3)
  temperature_sensor_install(&temp_sensor, &temp_handle);
#endif
#else
  struct rst_info *rstInfo = system_get_rst_info();
  uint8_t wakeupReason = rstInfo->reason;
#endif

#if DEBUG
  Serial.printf("Wakeup Reason:%u\n", wakeupReason);
#endif
#ifdef ESP32
  if (wakeupReason == 8) {  //ESP_RST_DEEPSLEEP (8)
#else
  if (wakeupReason == 5) {    //REASON_DEEP_SLEEP_AWAKE (5)
#endif
    LOG_INTERVAL = 0;    //going into sleep mode anyway, do not delay in loop()
    if (LOG_ENABLE > 0)  //writing logs during sleep
      LittleFS.begin();
  } else {
    //Emergency Recover (RST to GND)
#ifdef ESP32
    if (wakeupReason == 2) {  //ESP_RST_EXT (2) ESP_RST_SW (3)
#else
    if (wakeupReason == 6) {  //REASON_EXT_SYS_RST (6)
#endif
      LOG_INTERVAL = 600;                    //prevent WiFi from sleeping 5 minutes
      ALERTS[0] = '1';                       //email DHCP IP
      ALERTS[1] = '0';                       //low voltage
      memset(&rtcData, 0, sizeof(rtcData));  //reset RTC memory (set all zero)
      setupWiFi(22);
      blinky(1000, 1);
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
  //calibrateDeepSleep();  //compensate for processing delay during setup()
}

//This is a power expensive function 80+mA
void setupWiFi(uint8_t timeout) {

  blinky(200, 3);  //Alive blink

  WIRELESS_MODE = fastAtoi(NVRAMRead(_WIRELESS_MODE));
  WIRELESS_CHANNEL = fastAtoi(NVRAMRead(_WIRELESS_CHANNEL));
  WIRELESS_PHY_MODE = fastAtoi(NVRAMRead(_WIRELESS_PHY_MODE));
  WIRELESS_PHY_POWER = fastAtoi(NVRAMRead(_WIRELESS_PHY_POWER));

  //Forcefull Wakeup
  //-------------------
  //WiFi.persistent(false);
  //WiFi.setSleepMode(WIRELESS_NONE_SLEEP);
  //WiFi.forceSleepWake();
  //-------------------
  IPAddress ip, gateway, subnet, dns;
  ip.fromString(NVRAMRead(_NETWORK_IP));
  subnet.fromString(NVRAMRead(_NETWORK_SUBNET));
  gateway.fromString(NVRAMRead(_NETWORK_GATEWAY));
  dns.fromString(NVRAMRead(_NETWORK_DNS));
  //-------------------

  WiFi.persistent(false);  //Do not write settings to memory
  //0    (for lowest RF power output, supply current ~ 70mA
  //20.5 (for highest RF power output, supply current ~ 80mA
#ifdef ESP8266
  WiFi.setPhyMode((WiFiPhyMode_t)WIRELESS_PHY_MODE);
  WiFi.setOutputPower(WIRELESS_PHY_POWER);
#else
  WiFi.setTxPower((wifi_power_t)WIRELESS_PHY_POWER);
#endif

  const char *WIRELESS_SSID = NVRAMRead(_WIRELESS_SSID);
  const char *WIRELESS_PASSWORD = NVRAMRead(_WIRELESS_PASSWORD);

  if (WIRELESS_MODE == 0) {
    //=====================
    //WiFi Access Point Mode
    //=====================
    uint8_t WIRELESS_HIDE = fastAtoi(NVRAMRead(_WIRELESS_HIDE));

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
#if ASYNCSERVER_DNS
    dnsServer.setTTL(300);
    dnsServer.setErrorReplyCode(AsyncDNSReplyCode::ServerFailure);
    dnsServer.start(53, "captive.apple.com", WiFi.softAPIP());
    //dnsServer.setErrorReplyCode(AsyncDNSReplyCode::NoError);
    //dnsServer.start(53, "*", WiFi.softAPIP());
#else
#if SYNCSERVER_mDNS
    MDNS.begin(PLANT_NAME);
#endif
#endif

    delay(100);  //Wait 100 ms for AP_START
    //NETWORK_IP = WiFi.softAPIP().toString();
    WiFi.softAPIP().toString().toCharArray(NETWORK_IP, sizeof(NETWORK_IP));

  } else {
    //================
    //WiFi Client Mode
    //================

    //WiFi.enableSTA(true);
    //WiFi.enableAP(false);
    WiFi.mode(WIFI_STA);
#ifdef ESP8266
    WiFi.setAutoConnect(false);
#else
    WiFi.setAutoReconnect(false);
#endif
    WiFi.disconnect();

    uint8_t NETWORK_DHCP = fastAtoi(NVRAMRead(_NETWORK_DHCP));
    if (NETWORK_DHCP == 0) {
      WiFi.config(ip, gateway, subnet, dns);
    }
#ifdef ESP8266
    WiFi.hostname(PLANT_NAME);

    if (WIRELESS_MODE == 2) {  // WPA2-Enterprise
      typedef enum {
        EAP_TLS,
        EAP_PEAP
      } eap_method_t;
      eap_method_t method = EAP_PEAP;
      struct station_config wifi_config;
      memset(&wifi_config, 0, sizeof(wifi_config));
      strcpy((char *)wifi_config.ssid, WIRELESS_SSID);
      //memcpy(wifi_config.ssid, WIRELESS_SSID.c_str(), WIRELESS_SSID.length());
      //memcpy(wifi_config.password, WIRELESS_PASSWORD.c_str(), WIRELESS_PASSWORD.length());	// only for WPA2-PSK
      //memcpy(wifi_config.password, "", 0);	                                      // only for WPA2-Enterprise
      wifi_station_set_config(&wifi_config);
#if DEBUG
      //Serial.printf("Beacon Interval: %d\n", wifi_config.beacon_interval);
      //Serial.printf("Max Connections: %d\n", wifi_config.max_connection);
      Serial.printf("Threshold RSSI: %d\n", wifi_config.threshold.rssi);
      //Serial.printf("Threshold Authmode: %d\n"), (uint8_t)wifi_config.threshold.authmode);
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
      const char *WIRELESS_USERNAME = NVRAMRead(_WIRELESS_USERNAME);
      //Must have @<domain.com> otherwise default anonymous@espressif.com is used
      wifi_station_set_enterprise_identity((u8 *)WIRELESS_USERNAME, strlen(WIRELESS_USERNAME));
      //wifi_station_set_enterprise_identity((u8*)"esptest@domain.com", strlen("esptest@domain.com"));

      if (method == EAP_PEAP) {
        wifi_station_set_enterprise_username((u8 *)WIRELESS_USERNAME, strlen(WIRELESS_USERNAME));
        wifi_station_set_enterprise_password((u8 *)WIRELESS_PASSWORD, strlen(WIRELESS_PASSWORD));
        //wifi_station_set_enterprise_username((u8*)"esptest@domain.com", strlen("esptest@domain.com"));
        //wifi_station_set_enterprise_password((u8*)"esptest0", strlen("esptest0"));
      } else if (method == EAP_TLS) {

        //ESP8266 does not support bigger than SHA256 certificate
        //WPA2-ENTERPRISE can only support unencrypted certificate and private key, and only in PEM format
        if (LittleFS.exists("/radius.cer") && LittleFS.exists("/radius.key")) {
          size_t offset = 0;
          File file = LittleFS.open("/radius.cer", "r");
          size_t size = file.size();
          uint8_t cert[size];
          while (size > 0) {
            size_t chunkSize = (size < 512) ? size : 512;
            file.read(cert + offset, chunkSize);
            offset += chunkSize;
            size -= chunkSize;
          }
          file.close();

          offset = 0;
          file = LittleFS.open("/radius.key", "r");
          size = file.size();
          uint8_t cert_key[size];
          while (size > 0) {
            size_t chunkSize = (size < 512) ? size : 512;
            file.read(cert_key + offset, chunkSize);
            offset += chunkSize;
            size -= chunkSize;
          }
          file.close();
          wifi_station_set_enterprise_cert_key(cert, sizeof(cert), cert_key, sizeof(cert_key), NULL, 0);
        }
      }
      //wifi_station_disconnect();
      wifi_station_connect();
      //} else {
      //  timeout = 22;

    } else {
      if (WIRELESS_MODE == 3)
        WiFi.enableInsecureWEP();  //Old School

      //TCP timer rate raised from 250ms to 3s
      //WiFi.setSleepMode(WIFI_LIGHT_SLEEP);   //Light sleep is like modem sleep, but also turns off the system clock.
      //WiFi.setSleepMode(WIFI_MODEM_SLEEP);   //Modem sleep disables WiFi between DTIM beacon intervals.
      WiFi.setSleepMode(WIFI_MODEM_SLEEP, 10);  //Station wakes up every (DTIM-interval * listenInterval) This saves power but station interface may miss broadcast data.

      WiFi.begin(WIRELESS_SSID, WIRELESS_PASSWORD);  //Connect to the WiFi network
    }
#else  //ESP32
    //char hname[19]; // 5+12+1 - don't forget the \0
    //snprintf(hname, 19, "ESP32-%012llX", ESP.getEfuseMac());
    //char hname[] = "Plant"; // the compiler will append a null automagically.
    //WiFi.setHostname(hname);
    //WiFi.setHostname(PLANT_NAME.c_str());

#if WPA2ENTERPRISE
    if (WIRELESS_MODE == 2) {  // WPA2-Enterprise
      const char *WIRELESS_USERNAME = NVRAMRead(_WIRELESS_USERNAME);
      String root_ca = "";
      if (LittleFS.exists("/radius.cer")) {
        File file = LittleFS.open("/radius.cer", "r");
        root_ca = file.readString();
        file.close();
      }
      WiFi.begin(WIRELESS_SSID, WPA2_AUTH_PEAP, WIRELESS_USERNAME, WIRELESS_USERNAME, WIRELESS_PASSWORD, root_ca);

      // WPA2 Enterprise with PEAP
      //WiFi.begin(ssid, WPA2_AUTH_PEAP, EAP_IDENTITY, EAP_USERNAME, EAP_PASSWORD, root_ca, client_cert, client_key);

      // TLS with cert-files and no password
      //WiFi.begin(ssid, WPA2_AUTH_TLS, EAP_IDENTITY, NULL, NULL, root_ca, client_cert, client_key);

    } else {
      WiFi.begin(WIRELESS_SSID, WIRELESS_PASSWORD);
    }
#else
    WiFi.begin(WIRELESS_SSID, WIRELESS_PASSWORD);
#endif
#endif

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
      delay(500);

      if (timeout > 21) {
#if DEBUG
        Serial.println("Connection Failed! Rebooting...");
#endif
        //If client mode fails ESP8266 will not be accessible
        //Set Emergency AP SSID for re-configuration
        //NVRAMWrite(_EEPROM_ID, "0");
        NVRAMWrite(_WIRELESS_MODE, "0");
        NVRAMWrite(_WIRELESS_HIDE, "0");
        NVRAMWrite(_WIRELESS_SSID, PLANT_NAME);
        NVRAMWrite(_WIRELESS_PASSWORD, "");
        NVRAMWrite(_LOG_INTERVAL, "60");
        NVRAMWrite(_NETWORK_DHCP, "0");
        //delay(100);
        ESP.restart();
      }
      WIRELESS_PHY_POWER++;  //auto tune wifi power (minimum power to reach AP)
      setupWiFi(timeout++);
      return;
    }
    NVRAMWrite(_WIRELESS_PHY_POWER, (char *)WIRELESS_PHY_POWER);  //save auto tuned wifi power

    WiFi.setAutoReconnect(true);

    //NTP Client to get time
#if TIMECLIENT_NTP
    timeClient.begin();
    timeClient.update();
    timeClient.setTimeOffset(fastAtoi(NVRAMRead(_TIMEZONE_OFFSET)));
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
#endif
    //NETWORK_IP = WiFi.localIP().toString();
    WiFi.localIP().toString().toCharArray(NETWORK_IP, sizeof(NETWORK_IP));
#if EMAILCLIENT_SMTP
    if (ALERTS[0] == '1')
      smtpSend("DHCP IP", NETWORK_IP, 1);
#endif
#if DEBUG
    Serial.println(WiFi.localIP().toString());
#endif
  }
}

void setupWebServer() {
  //LittleFSConfig config;
  //LittleFS.setConfig(config);
#ifdef ESP32
  if (!LittleFS.begin(true)) {
#else
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
  if (!LittleFS.begin()) {
#endif
#if DEBUG
    Serial.println("LittleFS Mount Failed");
#endif
    //return;
  }
  strncpy(DEMO_PASSWORD, NVRAMRead(_DEMO_PASSWORD), sizeof(DEMO_PASSWORD));
  //==============================================
  //Async Web Server HTTP_GET, HTTP_POST, HTTP_ANY
  //==============================================
  server.on("/api", HTTP_GET, [](AsyncWebServerRequest *request) {
    AsyncResponseStream *response = request->beginResponseStream(FPSTR(text_plain));
    webTimer = millis();
    if (request->hasParam("adc")) {
      uint8_t adc = fastAtoi(request->getParam("adc")->value().c_str());
      if (adc == 1) {
#ifdef ESP32
        response->printf("%u|%llu", sensorRead(sensorPin), rtcData.runTime);
#else
          response->printf("%u|%lu", sensorRead(sensorPin), rtcData.runTime);
#endif
      } else {
        response->printf("%u", waterLevelRead(adc));
      }
#ifdef ESP32
    } else if (request->hasParam("temp")) {
      float tempC = 0;
      /*
#if (CONFIG_IDF_TARGET_ESP32S2 && ARDUINO_ESP32_MAJOR >= 3)
      temperature_sensor_enable(temp_handle);
      temperature_sensor_get_celsius(temp_handle, &tempC);
      temperature_sensor_disable(temp_handle);
#endif
      */
      response->printf("%.2f", tempC);
#endif
    } else if (request->hasParam("stream")) {
      uint8_t stream = fastAtoi(request->getParam("stream")->value().c_str());
      for (uint16_t i = 0; i < stream; i++) {
        response->printf("%u:%u\n", waterLevelRead(2), sensorRead(sensorPin));
      }
    } else if (request->hasParam("ntp")) {
      rtcData.ntpWeek = fastAtoi(request->getParam("week")->value().c_str());
      rtcData.ntpHour = fastAtoi(request->getParam("hour")->value().c_str());
      rtcData.runTime = fastAtoi(request->getParam("minute")->value().c_str()) * 60;
#if DEBUG
      Serial.printf("NTP Week: %u\n", rtcData.ntpWeek);
      Serial.printf("NTP Hour: %u\n", rtcData.ntpHour);
      Serial.printf("NTP Seconds: %u\n", rtcData.runTime);
#endif
      response->printf("%d", DEEP_SLEEP);
    } else if (request->hasParam("svg")) {
#ifdef ESP8266
      Dir files = LittleFS.openDir("/svg");
      while (files.next()) {
        if (files.fileName().endsWith("vg")) {
          response->printf("%s\n", files.fileName().c_str());
        }
      }
#else
        File root = LittleFS.open("/svg");
        File file = root.openNextFile();
        while (file) {
          //if (!file.isDirectory()) {
          const char *name = file.name();
          if (strstr(name, "vg")) {
            response->printf("%s\n", name);
          }
          //}
          file = root.openNextFile();
        }
#endif
    } else if (strlen(DEMO_PASSWORD) == 0) {
      blinkDuration = 0;
      if (request->hasParam("reset")) {
        NVRAM_Erase();
        NVRAMWrite(_PNP_ADC, PNP_ADC);
        thread.attach(2, []() {
          ESP.restart();
        });
        response->print(F("..."));
      } else if (request->hasParam("smtp")) {
#if EMAILCLIENT_SMTP
        thread.once(1, []() {
          smtpSend("Test", "OK", 1);
        });
        response->print(F("..."));
#else
          response->print(F("No SMTP"));
#endif
      } else if (request->hasParam("pump")) {
        const AsyncWebParameter *testPump = request->getParam(0);
        /*
#ifdef ESP32
        snprintf(logbuffer, sizeof(logbuffer), "P:%llu", rtcData.runTime);
#else
        snprintf(logbuffer, sizeof(logbuffer), "P:%lu", rtcData.runTime);
#endif
        dataLog(logbuffer);
        */
        //0 = stop, 1= run (timed), 2 = run (continues)
        if (testPump->value() == "1") {
          runPumpThreadDuration = PLANT_POT_SIZE;
          runPump(true);
        } else if (testPump->value() == "2") {
          thread.attach(1, []() {
            runPumpThreadDuration = UINT16_MAX;
            runPumpThread(dirt);
          });
        } else {
          thread.detach();
          runPumpFinish();
          //runPumpThreadDuration = 0;
        }
        response->print(F("..."));
      } else if (request->hasParam("empty")) {
        uint8_t water = fastAtoi(request->getParam("empty")->value().c_str());
        rtcData.emptyBottle = water;
        if (water > 3) {
          rtcData.waterTime = delayBetweenOverfloodReset + 1;
        }
        response->printf("%u", rtcData.waterTime);
      }
    } else {
      response->print(FPSTR(locked_html));
    }
    request->send(response);
  });
  /*
  server.on("/adc2", HTTP_GET, [](AsyncWebServerRequest *request) {
    //CapacitiveSensor cs = CapacitiveSensor(sensorPin, analogDigitalPin);
    //cs.set_CS_AutocaL_Millis(0xFFFFFFFF); // turn off autocalibrate
    uint16_t moisture = cs.capacitiveSensor(30);
    request->send(200, FPSTR(text_plain), String(moisture));
  });
  server.on("/adc-offset", HTTP_GET, [](AsyncWebServerRequest *request) {
    if (request->params() > 0) {
      int8_t i = request->getParam(0)->value().toInt();
      ADC_ERROR_OFFSET = i;
      NVRAMWrite(_ADC_ERROR_OFFSET, String(ADC_ERROR_OFFSET));
    }
    request->send(200, FPSTR(text_plain), String(ADC_ERROR_OFFSET));
  });
  */
  server.on("/log", HTTP_GET, [](AsyncWebServerRequest *request) {
    if (request->hasParam("end")) {
      LOG_ENABLE = 0;
      LittleFS.remove("/l");
      //NVRAMWrite(_LOG_ENABLE, "0");
    } else if (request->hasParam("start")) {
      LOG_ENABLE = 1;
      dataLog("l");
      //NVRAMWrite(_LOG_ENABLE, "1");
    } else if (LittleFS.exists("/l")) {
      AsyncWebServerResponse *response = request->beginResponse(LittleFS, "/l", FPSTR(text_plain));
      request->send(response);
      return;
    }
    request->send(200, FPSTR(text_plain), F("..."));
  });
  server.on("/login", HTTP_POST, [](AsyncWebServerRequest *request) {
    if (request->getParam("password", true)->value() == DEMO_PASSWORD) {
      DEMO_PASSWORD[0] = 0;  //reset
    }
    request->redirect("/");
  });
  server.on("/reboot", HTTP_GET, [](AsyncWebServerRequest *request) {
    if (strlen(DEMO_PASSWORD) > 0) {
      request->send(200, FPSTR(text_plain), FPSTR(locked_html));
    } else {
      thread.attach(1, []() {
        ESP.restart();
      });
      request->send(200, FPSTR(text_plain), F("..."));
    }
  });
  server.on("/nvram.json", HTTP_GET, [](AsyncWebServerRequest *request) {
    if (request->params() > 0) {
      if (strlen(DEMO_PASSWORD) == 0) {
        uint8_t i = fastAtoi(request->getParam("offset")->value().c_str());
        if (request->hasParam("alert")) {
          ALERTS[i] = fastAtoi(request->getParam("alert")->value().c_str());
          NVRAMWrite(_ALERTS, ALERTS);
        } else {
          NVRAMWrite(i, request->getParam("value")->value().c_str());
          NVRAMRead_Config();
        }
        offsetTiming();
        request->send(200, FPSTR(text_plain), request->getParam("value")->value());
      } else {
        request->send(200, FPSTR(text_plain), FPSTR(locked_html));
      }
    } else {
      AsyncResponseStream *response = request->beginResponseStream(FPSTR(text_json));
      response->print(F("{\"nvram\": [\""));
#ifdef ESP8266
      response->printf("%s ESP8266", ESP.getCoreVersion());
#else
        //esp_chip_info_t chip_info;
        //esp_chip_info(&chip_info);
        response->printf("%d.%d.%d %s", ESP_ARDUINO_VERSION_MAJOR, ESP_ARDUINO_VERSION_MINOR, ESP_ARDUINO_VERSION_PATCH, ESP.getChipModel());
#if (ASYNC_TCP_SSL_ENABLED)
        response->print(MBEDTLS_VERSION_NUMBER);
#endif
#endif
      //uint16_t major = (LFS_VERSION >> 16) & 0xFFFF; // 0x0002
      //uint16_t minor = LFS_VERSION & 0xFFFF;         // 0x0005
      //response->printf("%u.%u", major, minor);
      response->printf("|%s|%u|%s|%u|%u\"", ESP.getSdkVersion(), LFS_VERSION, _VERSION, ESP.getFreeSketchSpace(), ESP.getFreeHeap());  //esp_himem_get_free_size()
#if DEBUG
      Serial.printf("Flash free: %6d bytes\r\n", ESP.getFreeSketchSpace());
      Serial.printf("DRAM free: %6d bytes\r\n", ESP.getFreeHeap());
#endif
      for (uint8_t i = 1; i <= 31; i++) {
        if (i == 8 || i == 25 || i == 28) {
          if (strlen(DEMO_PASSWORD) == 0) {
            response->print(F(",\"\""));
          } else {
            response->print(F(",\"****\""));
          }
        } else {
          response->printf(",\"%s\"", NVRAMRead(i));
        }
      }
      response->print(F("]}"));
      request->send(response);
    }
  });
  /*
  server.on("/nvram", HTTP_GET, [](AsyncWebServerRequest *request) {
    char out[2048];
    size_t len = 0;
    for (uint32_t i = 0; i < EEPROM.length(); i++) {
      len += snprintf(out + len, sizeof(out) - len, "%02X", EEPROM.read(i));
    }
    request->send(200, FPSTR(text_plain), out);
  });
  */
  server.on("/nvram", HTTP_POST, [](AsyncWebServerRequest *request) {
    AsyncResponseStream *response = request->beginResponseStream(FPSTR(text_plain));
    if (strlen(DEMO_PASSWORD) > 0) {
      response->print(FPSTR(locked_html));
    } else {
      const AsyncWebParameter *param0 = request->getParam(0);
      if (!param0) return;

      char buf[64];
      size_t len = 0;
      uint8_t n = 1, skip = 32;

      len = snprintf(buf, sizeof(buf), "6;url=/");
      if (param0->name() == "wifi") {
        const AsyncWebParameter *modeParam = request->getParam("Mode", true);
        const AsyncWebParameter *dhcpParam = request->getParam("DHCP", true);
        if (modeParam->value() == "0") {
          thread.attach(2, []() {
            ESP.restart();
          });
        } else if (dhcpParam->value() == "1") {
          len += snprintf(buf + len, sizeof(buf) - len, "find.html");
        } else {
          const AsyncWebParameter *ipParam = request->getParam("WiFiIP", true);
          if (ipParam) {
            len--;  // remove last character
            len += snprintf(buf + len, sizeof(buf) - len, "http://%s", ipParam->value());
          }
        }
      } else if (param0->name() == "alert") {
        n = 22;
        skip = 5;
      } else if (param0->name() == "demo") {
        n = 28;
      }
      response->addHeader(FPSTR(refresh_http), buf);

      for (size_t i = 1; i < request->params(); i++) {
        if (i != skip) {
          NVRAMWrite(n, request->getParam(i)->value().c_str());
          response->printf("[%d] %s:%s\n", n, request->getParam(i)->name().c_str(), NVRAMRead(n));
          n++;
        }
      }
#if DEBUG
      Serial.println("NVRAM Forcig Restart");
#endif
    }
    request->send(response);
  });
#if (ASYNC_TCP_SSL_ENABLED)
  httpserver.on(
#else
  server.on(
#endif
    "/update", HTTP_GET, [](AsyncWebServerRequest *request) {
      webTimer = millis();
#ifndef ARDUINO_SIGNING
      if (strlen(DEMO_PASSWORD) > 0)
        if (!request->authenticate("", DEMO_PASSWORD))
          return request->requestAuthentication();
#endif
      AsyncResponseStream *response = request->beginResponseStream(FPSTR(text_html));
      response->print(F("<!DOCTYPE html><html><body>"));
      //if (request->hasParam("boot")) {
      //  response->print("<script>fetch('reboot').then((async()=>{for(;;){if((await fetch('update')).ok){location='/'}await new Promise(r=>setTimeout(r,999))}})())</script>...");
      //} else {
      const char *labels[] = { "Firmware", "Filesystem" };
      for (uint8_t i = 0; i < 2; i++) {
        response->print(F("<form action=http://"));
        response->print(NETWORK_IP);
        response->print(request->url());
        response->print(F(" method=post enctype='multipart/form-data'><input type=file accept='.bin,.signed' name="));
        response->print(labels[i]);
        response->print(F("><input type=submit value='Update "));
        response->print(labels[i]);
        response->print(F("'></form><br>"));
        //}
      }
      response->print(F("</body></html>"));
      request->send(response);
    });
  /*
    server.on("/format", HTTP_GET, [](AsyncWebServerRequest *request) {
      FSInfo fs_info;
      String result = LittleFS.format() ? "OK" : "Error";
      LittleFS.info(fs_info);
      request->send(200, FPSTR(text_plain), "<pre>Format " + result + "\nTotal Flash Size: " + String(ESP.getFlashChipSize()) + "\nFilesystem Size: " + String(fs_info.totalBytes) + "\nFilesystem Used: " + String(fs_info.usedBytes) + "</pre>");
    });
    */
#if (ASYNC_TCP_SSL_ENABLED)
  //Web Updates only work over HTTP (TODO: Check Update Library)
  httpserver.on(
#else
  server.on(
#endif
    //"/update", HTTP_POST, [&](AsyncWebServerRequest *request) {
    "/update", HTTP_POST, [](AsyncWebServerRequest *request) {
#ifndef ARDUINO_SIGNING
      if (strlen(DEMO_PASSWORD) > 0)
        if (!request->authenticate("", DEMO_PASSWORD))
          return request->requestAuthentication();
#endif
      AsyncResponseStream *response = request->beginResponseStream(FPSTR(text_html));

      if (Update.hasError()) {
#if (ARDUINO_ESP8266_MAJOR >= 3 && ARDUINO_ESP8266_MINOR >= 1)
        response->print(Update.getErrorString());  //3.1.x
#else
        StreamString str;
        Update.printError(str);
        response->print(str);
#endif
      } else {
        response->print(F("Update Success! ..."));
      }
      response->addHeader(FPSTR(refresh_http), "6;url=/");
      thread.attach(2, []() {
        ESP.restart();
      });
      request->send(response);
    },
    WebUpload);

  server.on(
    "/upload", HTTP_POST, [](AsyncWebServerRequest *request) {
      if (strlen(DEMO_PASSWORD) > 0)
        if (!request->authenticate("", DEMO_PASSWORD))
          return request->requestAuthentication();
      request->redirect("/");  //request->send(200);
    },
    onUpload);

  server.on("/", [](AsyncWebServerRequest *request) {
    if (LittleFS.exists("/index.html")) {
      blinkDuration = 0;
      bool isPhone = false;
      if (request->hasHeader("User-Agent")) {
        const char *ua = request->getHeader("User-Agent")->value().c_str();
        if (strstr(ua, "iPhone")) {
          isPhone = true;
        } else if (strstr(ua, "Android") && strstr(ua, "Mobile")) {
          isPhone = true;
        }
      }
      if (isPhone) {
        request->redirect("/mobile/index.html");
      } else {
        request->redirect("/index.html");
      }
    } else {
      AsyncWebServerResponse *response = request->beginResponse(200, FPSTR(text_html), F("File System Not Found ..."));
      response->addHeader(FPSTR(refresh_http), "4;url=/update");
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
    request->send(200, FPSTR(text_html), "<center><h1>http://" + String(NETWORK_IP) + "</h1></center>");
  });
  //server.on("(?is)^\\/(\bredirect\b|\bcaptive-portal\b)", HTTP_GET, [](AsyncWebServerRequest *request) {
  server.on("(redirect+)|(captive-portal+)$", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->redirect("http://" + String(NETWORK_IP));
  });
  server.on("^\\/regex\\/([0-9]+)$", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->send(200, FPSTR(text_plain), "OK");
  });
#endif

  server.onNotFound([](AsyncWebServerRequest *request) {
  //Serial.println((request->method() == HTTP_GET) ? "GET" : "POST");

#if DEBUG
    Serial.printf("\nRequest: %s\n", request->url().c_str());
#endif
    const char *file = request->url().c_str();
#if !ASYNCWEBSERVER_REGEX
    if (strstr(file, "detect") != 0 || strstr(file, "generate_204") != 0) {  //|| strstr(file, "test") != 0) {
      //if (!LittleFS.exists("/index.html")) {
      request->send(200, FPSTR(text_html), "<center><h1>http://" + String(NETWORK_IP) + "</h1></center>");
      //}
    } else if (strstr(file, "redirect") != 0 || strstr(file, "portal") != 0) {
      request->redirect("http://" + String(NETWORK_IP));
    } else
#endif
      if (LittleFS.exists(file)) {
      AsyncWebServerResponse *response = request->beginResponse(LittleFS, file, getContentType(file));
      if (strstr(file, "find") != 0) {
        response->addHeader(F("Access-Control-Allow-Origin"), "*");  // Allow all origins
      }
      response->addHeader(F("Content-Encoding"), "gzip");
      request->send(response);
    } else {
      request->send(404, FPSTR(text_plain), F("404: Not Found"));
    }
  });

#if (ASYNC_TCP_SSL_ENABLED)
  server.onSslFileRequest([](void *arg, const char *filename, uint8_t **buf) -> int {
    size_t size = 0;
    *buf = 0;

    if (LittleFS.exists(filename)) {
      File file = LittleFS.open(filename, "r");
      if (file) {
        size = file.size();
        file.read(*buf, size);
        //uint8_t *nbuf = (uint8_t *)calloc(size, sizeof(uint8_t));
        //file.read(nbuf, size);
        //*buf = nbuf;
#if DEBUG
        Serial.print("SSL File: ");
        Serial.print(filename);
        Serial.println(" OK");
        Serial.print("SSL Size: ");
        Serial.print(size);
#endif
        file.close();
      }
    } else {  // DEFAULT CERTIFICATE
#if DEBUG
      Serial.print("SSL DEFAULT CERTIFICATE");
#endif
      if (filename == "/server.key") {  // Private Key
        size = sizeof(SSLPrivateKey);
        *buf = SSLPrivateKey;
#if DEBUG
        Serial.print("SSL Private Key Size: ");
        Serial.print(size);
#endif
      } else {  // Certificate
        size = sizeof(SSLCertificate);
        *buf = SSLCertificate;
#if DEBUG
        Serial.print("SSL Certificate Size: ");
        Serial.print(size);
#endif
      }
    }
    return size;
  },
                          NULL);

  server.beginSecure("/server.der", "/server.key", NULL);

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
#if SYNC_TCP_SSL_ENABLE
#ifdef ESP8266
  secureServer.getServer().setRSACert(new BearSSL::X509List((const char *)SSLCertificate), new BearSSL::PrivateKey((const char *)SSLPrivateKey));
  /*
  secureServer.getServer().setServerKeyAndCert(
    SSLPrivateKey,      // Raw DER key data as byte array
    sizeof(SSLPrivateKey),  // Length of the key array
    SSLCertificate,     // Raw DER certificate (no certificate chain!) as byte array
    sizeof(SSLCertificate)  // Length of the certificate array
  );
  */
  // Cache SSL sessions to accelerate the TLS handshake.
  secureServer.getServer().setCache(&secureCache);
  secureServer.on("/", []() {
    secureServer.sendHeader("Location", String("http://" + String(NETWORK_IP)), true);
    secureServer.send(302, FPSTR(text_plain), "");
  });
  //secureServer.onNotFound(handleNotFound);
  secureServer.begin();
#else
  httpd_handle_t secureServer = NULL;
  httpd_ssl_config_t configSSL = HTTPD_SSL_CONFIG_DEFAULT();
  //configSSL.httpd.uri_match_fn = httpd_uri_match_wildcard;

  configSSL.servercert = SSLCertificate;
  configSSL.servercert_len = sizeof(SSLCertificate);
  configSSL.prvtkey_pem = SSLPrivateKey;
  configSSL.prvtkey_len = sizeof(SSLPrivateKey);
  configSSL.port_secure = 443;

  const httpd_uri_t root = {
    .uri = "/",  //"/*",
    .method = HTTP_GET,
    .handler = root_get_handler,
    .user_ctx = (void *)NETWORK_IP  //.c_str()
  };
  httpd_ssl_start(&secureServer, &configSSL);
  httpd_register_uri_handler(secureServer, &root);
#endif
#endif
  server.begin();  // Web server start
#endif

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
}

#if SYNC_TCP_SSL_ENABLE
#ifdef ESP32
static int root_get_handler(httpd_req_t *req) {
  //httpd_resp_set_type(req, FPSTR(text_html));
  //httpd_resp_send(req, "<h1>Hello World</h1>", HTTPD_RESP_USE_STRLEN);

  //static char buf[64];
  //snprintf(buf, sizeof(buf),"http://%s/index.html%s", (char*)req->user_ctx, req->uri);
  String buf = "http://";
  buf += (char *)req->user_ctx;
  buf += "/index.html";
  if (req->uri)
    buf += req->uri + 1;

  httpd_resp_set_status(req, "302");
  httpd_resp_set_hdr(req, "Location", buf.c_str());
  httpd_resp_send(req, "", 0);
  //httpd_resp_send(req, buf.c_str(), HTTPD_RESP_USE_STRLEN);
}
#endif
#endif

void loop() {
//ArduinoOTA.handle();
#if (SYNC_TCP_SSL_ENABLE && ESP8266)
  secureServer.handleClient();
#endif
#ifdef ESP8266
  delay(1);  //enable Modem-Sleep
#else
  vTaskDelay(1);   // yields CPU
#endif

  if (millis() - loopTimer < LOG_INTERVAL) return;
  rtcData.runTime += LOG_INTERVAL_S;  //track time since NTP sync (as seconds)

#ifdef ESP8266
  //Measure voltage every 10000s runtime (~2.5 hours)
  if (ALERTS[1] == '1' && rtcData.runTime % 10000 == 0) {
    if (ADCMODE == ADC_TOUT) {
      ESP.rtcUserMemoryWrite(100, (uint32_t *)ADC_VCC, sizeof(ADC_VCC));  //Next time measure VCC
    } else {
      //A0 pin needs to be free, not connected to anything in order for the internal measurement to work properly
      //A0 pin in NodeMCU is connected to (resistor/capacitor) and needs to be floating in order to use ADC_MODE(ADC_VCC)
      float dvcc = ESP.getVcc() / 1024.0f;
#if DEBUG
      Serial.println("Voltage: " + String(dvcc) + "v");
#endif
      snprintf(logbuffer, sizeof(logbuffer), "v:%.2f", dvcc);
      dataLog(logbuffer);
      //TODO: only send below 2.8 volt?
      //{
#if EMAILCLIENT_SMTP
      smtpSend("Low Voltage", String(dvcc) + "v", 0);
#endif
      //}
#ifdef ESP8266
      ESP.rtcUserMemoryWrite(32, (uint32_t *)&rtcData, sizeof(rtcData));
#endif
    }
    ESP.restart();  //Reboot to switch ADC_MODE
  }
#endif

/*
    IMPORTANT for ESP8266!
    Make sure that the input voltage on the A0 pin doesn’t exceed 1.0V
  */
#ifdef ESP8266
  uint16_t moisture = sensorRead_ESP8266(sensorPin);
#else
  uint16_t moisture = sensorRead(sensorPin);
#endif
  if (ALERTS[8] == '1') {
    blinkMorse(moisture);
    //thread.once(1, blinkMorse, moisture);
  }
  snprintf(logbuffer, sizeof(logbuffer), "%u", moisture);
  dataLog(logbuffer);

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
#if EMAILCLIENT_SMTP
      if (ALERTS[4] == '1')
        smtpSend("Flood Protection", (char *)delayBetweenOverfloodReset, 0);
#endif
      rtcData.waterTime = 0;
      rtcData.moistureLog = 0;
      rtcData.emptyBottle = 0;
    } else {
#if DEBUG
      Serial.printf("Empty Detection: %u\n", rtcData.emptyBottle);
#endif
      snprintf(logbuffer, sizeof(logbuffer), "e:%u", rtcData.emptyBottle);
      dataLog(logbuffer);
#if EMAILCLIENT_SMTP
      if (ALERTS[5] == '1')
        smtpSend("Water Empty", (char *)rtcData.emptyBottle, 0);
#endif
      blinky(900, 30);
      delay(900 * 30 * 2);
    }
  }

  byte WiFiClientCount = 0;
  if ((millis() - webTimer) < DEEP_SLEEP_MS) {  //track web activity for 5 minutes
    WiFiClientCount = 1;
    //} else if (WiFi.getMode() == WIFI_AP) {
    //  WiFiClientCount = WiFi.softAPgetStationNum();  //counts all wifi clients (refresh may take 5 min to register station leave)
  }

#if DEBUG
  Serial.printf("WiFi Clients: %u\n", WiFiClientCount);
  Serial.printf("Runtime: %u\n", rtcData.runTime);
#endif

  if (WiFiClientCount == 0) {

    //Calculate current Day/Time. Works with WIFI_STA (NTP from server) and WIFI_AP (NTP from web-interface)
    //----------------------------------------
    uint32_t h = rtcData.ntpHour + rtcData.runTime / 3600;  //runtime in hours
    if (h >= 24) {                                          //day roll-over at 12pm
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
#ifdef ESP8266
      WiFi.forceSleepWake();  //try to get true mode as MODEM_SLEEP causes WIFI_OFF
#else
      if (WiFi.getSleep() == true)
        WiFi.setSleep(false);  //try to get true mode as MODEM_SLEEP causes WIFI_OFF
#endif
      delay(1);  //must delay after WiFi.forceSleepWake()

      if (WiFi.getMode() == WIFI_OFF) {
#if DEBUG
        Serial.println("WiFi ON");
#endif
        LOG_INTERVAL = fastAtoi(NVRAMRead(_LOG_INTERVAL));
        DEEP_SLEEP = 0;
        offsetTiming();

        setupWiFi(0);
        setupWebServer();
      }
    } else if (DEEP_SLEEP_S == 0 && h >= OFF_TIME) {  //outside of working hours
#if DEBUG
      Serial.println("WiFi OFF");
#endif
      DEEP_SLEEP = fastAtoi(NVRAMRead(_DEEP_SLEEP)) * 60;
      offsetTiming();
    }
    //----------------------------------------
    if (PLANT_MANUAL_TIMER == 0) {
#ifdef ESP8266
      if (moisture < 20) {  //Sensor Not in Soil
#elif defined(CONFIG_IDF_TARGET_ESP32S2)
      if (moisture < 200) {    //Sensor Not in Soil
#else
          if (moisture < 90) {  //Sensor Not in Soil
#endif
        // Soil dryed out too fast or missed oportunity to water (empty)
        if (rtcData.drySoilTime > delayBetweenDrySoilReset) {
          if (rtcData.emptyBottle >= 2) {
            rtcData.drySoilTime = 0;
            rtcData.emptyBottle = 0;
            runPump(false);
          } else {
            rtcData.emptyBottle++;  //Prevent false-positive low moisture sensor readings
          }
        } else {
          blinky(200, 4);
        }
#if EMAILCLIENT_SMTP
        if (ALERTS[2] == '1')
          smtpSend("Low Sensor", (char *)moisture, 0);
#endif
      } else if (moisture < PLANT_SOIL_MOISTURE) {  //Water Plant
        if (rtcData.emptyBottle < 3 && rtcData.drySoilTime > delayBetweenDrySoilReset) {
          rtcData.drySoilTime = 0;
          rtcData.moistureLog += moisture;
          runPump(false);
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
#if EMAILCLIENT_SMTP
        if (rtcData.emptyBottle >= 3 && ALERTS[5] == '1') {
          smtpSend("Water Refilled", (char *)moisture, 0);
        }
#endif
        rtcData.waterTime = 0;
        rtcData.moistureLog = 0;
        rtcData.emptyBottle = 0;
      }
      rtcData.drySoilTime++;  //Wait for soil to absorb moisture
    } else {
      snprintf(logbuffer, sizeof(logbuffer), "t:%u", rtcData.waterTime);
      dataLog(logbuffer);
#if DEBUG
      Serial.printf("Water Timer: %u\n", rtcData.waterTime);
#endif
      //ESP8266 - We need to split deep sleep as 32-bit unsigned integer is 4294967295 or 0xffffffff max ~71 minutes
      if (rtcData.waterTime >= PLANT_MANUAL_TIMER) {
        rtcData.emptyBottle = 0;  //assume no sensor with manual timer
        rtcData.waterTime = 0;
        runPump(false);
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
    WiFi.disconnect(true);            //disassociate properly (easier to reconnect)
    WiFi.mode(WIFI_OFF);

#ifdef ESP32
    esp_sleep_disable_wifi_wakeup();
    esp_sleep_enable_timer_wakeup(DEEP_SLEEP);
    //Special Hibernate Mode
    if (DEEP_SLEEP_S == LOG_INTERVAL_S) {
      esp_sleep_pd_config(ESP_PD_DOMAIN_RTC_SLOW_MEM, ESP_PD_OPTION_OFF);
      esp_sleep_pd_config(ESP_PD_DOMAIN_RTC_FAST_MEM, ESP_PD_OPTION_OFF);
      esp_sleep_pd_config(ESP_PD_DOMAIN_RTC_PERIPH, ESP_PD_OPTION_OFF);
    }
    esp_deep_sleep_start();
#else
    ESP.rtcUserMemoryWrite(32, (uint32_t *)&rtcData, sizeof(rtcData));
    //https://github.com/esp8266/Arduino/issues/8728 (WAKE_RF_DISABLED changes ADC behaviour)
    ESP.deepSleep(DEEP_SLEEP, WAKE_RF_DISABLED);  //Will wake up without radio
#endif
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

void dataLog(const char *text) {
  if (LOG_ENABLE == 1) {
#ifdef ESP8266
    FSInfo fs_info;
    LittleFS.info(fs_info);
    size_t flashsize = fs_info.totalBytes - fs_info.usedBytes - strlen(text);
#else
    size_t flashsize = LittleFS.totalBytes() - LittleFS.usedBytes() - strlen(text);
#endif
    if (flashsize > 1) {
      File file = LittleFS.open("/l", "a");
      if (file) {
        file.println(text);
        file.close();
      }
    } else {
      LittleFS.remove("/l");
    }
  }
}

void runPumpThread(const uint8_t *pattern) {
  if (runPumpThreadDuration == 0) {
    thread.detach();
    runPumpFinish();
    return;
  }
  static uint8_t idx = 0;
  turnNPNorPNP(pattern[idx]);  // ON or OFF
  idx = (idx + 1) & 0x03;      // fast modulo 4
  runPumpThreadDuration--;
}

void runPumpFinish() {
  turnNPNorPNP(0);  // OFF
#if EMAILCLIENT_SMTP
  if (ALERTS[3] == '1')
    smtpSend("Run Pump", (char *)PLANT_POT_SIZE, 0);
#endif
  snprintf(logbuffer, sizeof(logbuffer), "T:%lu,M:%u", PLANT_MANUAL_TIMER, PLANT_SOIL_MOISTURE);
  dataLog(logbuffer);

  rtcData.emptyBottle++;  // Sensorless Empty Detection
  //calibrateDeepSleep();  // Next sleep compensate for pump runtime
}

void runPump(bool threaded) {
#if DEBUG
  Serial.printf("MOISTURE LIMIT: %u\n", PLANT_SOIL_MOISTURE);
  Serial.printf("TIMER: %lu\n", PLANT_MANUAL_TIMER);
#endif
  uint16_t water = 100;
  if (PNP_ADC[2] == '1') {
    water = waterLevelRead(2);  // Loopback wire from water jug to A0 powered from GPIO12
  }
  //===================
  if (water > 0) {
    // Watering Map -  Different soils takes different time to soak the water
    const uint8_t *pattern = dirt;
    if (PLANT_SOIL_TYPE == 0) pattern = sand;
    else if (PLANT_SOIL_TYPE == 3) pattern = loam;
    else if (PLANT_SOIL_TYPE == 4) pattern = moss;

    if (threaded) {
      thread.attach(1, [pattern]() {
        runPumpThread(pattern);
      });
    } else {
      uint16_t duration = PLANT_POT_SIZE;
      uint8_t idx = 0;
      while (duration--) {
        turnNPNorPNP(pattern[idx]);  // ON or OFF
        idx = (idx + 1) & 0x03;      // fast modulo 4
        delay(1000);
      }
      runPumpFinish();
    }
  }
}

uint16_t waterLevelRead(uint8_t sensor) {
  uint16_t level = 100;
#ifdef ESP32
#if CONFIG_IDF_TARGET_ESP32S2
  uint16_t threshold = 800;
#else
  uint16_t threshold = 4080;
#endif
#else
  uint16_t threshold = 255;
#endif
  uint16_t water = sensorRead(watersensorPin_100);
  if (water < threshold) {
    level = 75;
    water = sensorRead(watersensorPin_75);
    if (water < threshold) {
      level = 50;
      water = sensorRead(watersensorPin_50);
      if (water < threshold) {
        level = 25;
        water = sensorRead(watersensorPin_25);
        if (water < threshold) {
          level = 0;
        }
      }
    }
  }

#if DEBUG
  Serial.printf("Water Level: %u\n", level);
  Serial.printf("Water Sensor: %u\n", water);
#endif
  if (sensor == 3) {
    return water;
  } else {
    return level;
  }
}

#ifdef ESP8266
uint16_t sensorRead_ESP8266(uint16_t enablePin) {
  uint16_t result = 1024;

  //A0 conflicts with WiFi Module (to reflect accurate readings from GUI turn ON WiFi during ADC)
  //-----------------
  if (WiFi.getMode() == WIFI_OFF) {
    WiFi.mode(WIFI_AP);  //WiFi.begin();
    result = sensorRead(enablePin);
    WiFi.mode(WIFI_OFF);
  } else {
    result = sensorRead(enablePin);
  }
  return result;
}
#endif

uint16_t sensorRead(uint8_t enablePin) {
  uint16_t result = 0;
  /*
  * ESP8266 ADC pin 0 to 1.1 volt
  * ESP32 ADC pin 0 to 3.3 volt
  */
  //pinMode(analogDigitalPin, INPUT);
  pinMode(enablePin, OUTPUT);
  digitalWrite(enablePin, HIGH);  //ON

#ifdef ESP32
  analogReadResolution(12);  // Sets the sample bits and read resolution, default is 12-bit (0 - 4095), range is 9 - 12 bits
// 9-bit gives an ADC range of 0-511
// 10-bit gives an ADC range of 0-1023
// 11-bit gives an ADC range of 0-2047
// 12-bit gives an ADC range of 0-4095
//analogSetCycles(8);                 // Set number of cycles per sample, default is 8 and provides an optimal result, range is 1 - 255
//analogSetSamples(1);                // Set number of samples in the range, default is 1, it has an effect on sensitivity has been multiplied
//analogSetClockDiv(1);               // Set the divider for the ADC clock, default is 1, range is 1 - 255
//analogSetPinAttenuation(analogDigitalPin, ADC_6db);  // Sets the input attenuation, default is ADC_11db, range is ADC_0db, ADC_2_5db, ADC_6db, ADC_11db
// ADC_0db provides no attenuation so IN/OUT = 1 / 1 an input of 3 volts remains at 3 volts before ADC measurement
// ADC_2_5db provides an attenuation so that IN/OUT = 1 / 1.34 an input of 3 volts is reduced to 2.238 volts before ADC measurement
// ADC_6db provides an attenuation so that IN/OUT = 1 / 2 an input of 3 volts is reduced to 1.500 volts before ADC measurement
// ADC_11db provides an attenuation so that IN/OUT = 1 / 3.6 an input of 3 volts is reduced to 0.833 volts before ADC measurement
//analogSetVRefPin(25);               // Set pin to use for ADC calibration if the esp is not already calibrated (25, 26 or 27)
//analogSetClockDiv(255);             // Set the divider for the ADC clock. Default is 1, Range is 1 - 255
//adcAttachPin(analogDigitalPin);     // Attach a pin to ADC (also clears any other analog mode that could be on), returns TRUE/FALSE result
//adcStart(analogDigitalPin);         // Starts an ADC conversion on attached pin's bus
//adcBusy(analogDigitalPin);          // Check if conversion on the pin's ADC bus is currently running, returns TRUE/FALSE result
//adcEnd(analogDigitalPin);           // Get the result of the conversion (will wait if it have not finished), returns 16-bit integer result
//digitalWrite(analogDigitalPin, HIGH);  //Internal pull-up ON (20k resistor)

// Sets the input attenuation for ALL ADC inputs, default is ADC_11db, range is ADC_0db, ADC_2_5db, ADC_6db, ADC_11db
#if CONFIG_IDF_TARGET_ESP32S2
  if (enablePin == sensorPin) {
    analogSetAttenuation(ADC_11db);
  } else {
    analogSetAttenuation(ADC_0db);
  }
  result = analogRead(analogDigitalPin);
#else
  analogSetAttenuation(ADC_11db);
  uint8_t sensitivity = ((uint8_t)PNP_ADC[1] + 1) * 100;
  uint16_t minResult = 4095;
  for (uint8_t i = 0; i < sensitivity; i++) {
    result = analogRead(analogDigitalPin);
    if (result < minResult) {  //Lowest
      minResult = result;
    }
  }
  result = minResult;
#endif
#else
  result = analogRead(analogDigitalPin);
#endif
  /*
  uint16_t minResult = 0;
  for (uint8_t i = 0; i <= sensitivity; i++) {
    result = analogRead(analogDigitalPin);
    if (result > minResult) { //Highest
      minResult = result;
    }
  }
  result = minResult;
  */
  /*
  for (uint8_t i = 0; i < sensitivity; i++) {
    result += analogRead(analogDigitalPin);
  }
  result /= sensitivity;         //Average
  */
  /*
  if (WiFi.getMode() == WIFI_OFF) {
    result -= ADC_ERROR_OFFSET;
  }
  */
  digitalWrite(enablePin, LOW);  //OFF
  pinMode(enablePin, INPUT);     //Prevent from leaving floating to GND
#if DEBUG
  Serial.printf("Sensor Pin: %u\n", enablePin);
  Serial.printf("Analog Pin: %u\n", analogDigitalPin);
  Serial.printf("Deep Sleep: %u\n", DEEP_SLEEP);
  Serial.printf("Plant Timer: %u\n", PLANT_MANUAL_TIMER);
  Serial.printf("Sensor: %u\n", result);
#endif

  return result;
}
/*
uint32_t readADC_Cal(int ADC_Raw)
{
  esp_adc_cal_characteristics_t adc_chars;
  esp_adc_cal_characterize(ADC_UNIT_1, ADC_ATTEN_DB_0, ADC_WIDTH_BIT_13, 1100, &adc_chars);
  return(esp_adc_cal_raw_to_voltage(ADC_Raw, &adc_chars));
}
*/
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
      int a = analogRead(analogDigitalPin);
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
    result += analogRead(analogDigitalPin);
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

void blinkThread() {
#if DEBUG
  Serial.printf("blink: %u\n", blinkDuration);
#endif
  //All variables that are used by interrupt service routine declared as "volatile"
  if (blinkDuration == 0) {
    thread.detach();
    /*
    Most ESP8266 LED swapped HIGH with LOW
    LED is shared with GPIO2. ESP8266 will need GPIO2 on HIGH level in order to boot.
    */
#ifdef ESP32
    digitalWrite(ledPin, LOW);  // OFF
#else
    digitalWrite(ledPin, HIGH); // OFF
#endif
  } else {
    //digitalWrite(ledPin, !digitalRead(ledPin));
#ifdef ESP32
    digitalWrite(ledPin, (blinkDuration & 1) ? HIGH : LOW);
#else
    digitalWrite(ledPin, (blinkDuration & 1) ? LOW : HIGH); // inverted logic
#endif
    blinkDuration--;
  }
}

void blinkMorse(uint16_t moisture) {
  for (uint8_t i = 100; i >= 1; i /= 10) {
    uint8_t d = (moisture / i) % 10;
    blinky(600, d);  //blink a zero with a quick pulse
    delay(1200 + 600 * d * 2);
  }
}

void blinky(uint16_t timer, uint16_t duration) {
  thread.detach();
  if (duration == 0) {
    duration = 1;
    timer = 40;
  }
  blinkDuration = duration * 2;  //toggle style
  thread.attach_ms(timer, blinkThread);
}
//=============
// NVRAM CONFIG
//=============
void NVRAM_Erase() {
  for (uint32_t i = 0; i < EEPROM.length(); i++) {
    EEPROM.write(i, 0xFF);
  }
  EEPROM.commit();
}

void NVRAMWrite(uint8_t address, const char *txt) {
  /*
  int EEPROM_SIZE = 32;
  char buffer[EEPROM_SIZE];
  memset(buffer, 0, EEPROM_SIZE);
  txt.toCharArray(buffer, EEPROM_SIZE);
  EEPROM.put(address * EEPROM_SIZE, buffer);
  free(buffer);
  */
  //const int EEPROM_SIZE = 32;
  const int EEPROM_SIZE = (NVRAM_Map[(address + 1)] - NVRAM_Map[address]);
#if DEBUG
  Serial.printf("NVRAMWrite: %u > %u:%u\n", address, NVRAM_Map[address], EEPROM_SIZE);
#endif
  int len = strlen(txt);
  for (int i = 0; i < EEPROM_SIZE; i++) {
    if (i < len) {
      EEPROM.write(NVRAM_Map[address] + i, txt[i]);
      //EEPROM.write(address * EEPROM_SIZE + i, txt[i]);
    } else {
      EEPROM.write(NVRAM_Map[address] + i, 0xFF);
      //EEPROM.write(address * EEPROM_SIZE + i, 0xFF);
      break;
    }
  }
  EEPROM.commit();
}

char* NVRAMRead(uint8_t address) {
  /*
  int EEPROM_SIZE = 32;
  char buffer[EEPROM_SIZE];
  EEPROM.get(address * EEPROM_SIZE, buffer);
  */
  //const int EEPROM_SIZE = 32;
  const int EEPROM_SIZE = (NVRAM_Map[(address + 1)] - NVRAM_Map[address]);
  static char buffer[96];

  int i = 0;
  for (i = 0; i < EEPROM_SIZE; i++) {
    char byte = EEPROM.read(NVRAM_Map[address] + i);
    //char byte = EEPROM.read(address * EEPROM_SIZE + i);
    if (byte == 0xFF) break;  // stop at empty byte
    buffer[i] = byte;
  }
  buffer[i] = '\0';
#if DEBUG
  Serial.printf("\nNVRAMRead: %u > %u:%u\n", address, NVRAM_Map[address], EEPROM_SIZE);
  for (int i = 0; i < EEPROM_SIZE; i++) {
    Serial.printf("%02X", (uint8_t)buffer[i]);  // 2-digit uppercase hex with leading zero
  }
  Serial.print(" > ");
  Serial.print(buffer);
  Serial.print("\n");
#endif

  return buffer;
}

void NVRAMRead_Config() {

  DEEP_SLEEP = fastAtoi(NVRAMRead(_DEEP_SLEEP)) * 60;
  LOG_INTERVAL = fastAtoi(NVRAMRead(_LOG_INTERVAL));

  LOG_ENABLE = fastAtoi(NVRAMRead(_LOG_ENABLE));
  PLANT_POT_SIZE = fastAtoi(NVRAMRead(_PLANT_POT_SIZE));
  PLANT_SOIL_MOISTURE = fastAtoi(NVRAMRead(_PLANT_SOIL_MOISTURE));
  PLANT_SOIL_TYPE = fastAtoi(NVRAMRead(_PLANT_SOIL_TYPE));
  PLANT_TYPE = fastAtoi(NVRAMRead(_PLANT_TYPE));

  //==========
  strncpy(PNP_ADC, NVRAMRead(_PNP_ADC), sizeof(PNP_ADC));
  turnNPNorPNP(0);
}

void turnNPNorPNP(const uint8_t state) {
#if DEBUG
  Serial.printf("[%u]", state);
#endif
  if (PNP_ADC[0] == '1' && state == 0) {
    // Float the pin for PNP off (true high-impedance)
    pinMode(pumpPin, INPUT_PULLUP);
  } else {
    pinMode(pumpPin, OUTPUT);
    digitalWrite(pumpPin, state);
  }
}
/*
void calibrateDeepSleep() {
  if (DEEP_SLEEP > 1) {
    uint32_t internalRunTime = millis() * 1000;  //microseconds micros()
    if (DEEP_SLEEP > internalRunTime)
      DEEP_SLEEP = DEEP_SLEEP - internalRunTime;
  }
}
*/
void offsetTiming() {

  //ESP8266 Bootloader 2.2.2 - 1 hour interval = 2x 30 min intervals (double)
  //ESP8266 Bootloader 2.4.1 - 1 hour interval can be 1 to 1

  PLANT_MANUAL_TIMER = fastAtoi(NVRAMRead(_PLANT_MANUAL_TIMER));

  //if (ALERTS[8] == '1')
  //  DEEP_SLEEP = 900; //15 minutes

  //Sleep set and Logging is OFF
  /*
  if (DEEP_SLEEP > 1 && LOG_ENABLE < 1 && PLANT_MANUAL_TIMER > 0) {
    PLANT_MANUAL_TIMER = PLANT_MANUAL_TIMER * 2;  //calculate loop for ESP.deepSleep()
    delayBetweenAlertEmails = 1 * 60 / 30;        //2 hours as 30 min loops
    delayBetweenRefillReset = 2 * 60 / 30;        //2 hours as 30 min loops
    delayBetweenOverfloodReset = 8 * 60 / 30;     //8 hours as 30 min loops
    DEEP_SLEEP = 1800;                            //30 min
  } else {  //Always ON or Logging ON
  */
  uint16_t loopTime = (LOG_INTERVAL + DEEP_SLEEP);  //as total seconds
  //if(loopTime == 0) //Warning: ESP8266 will crash if devided by zero
  //  loopTime = 1;
  PLANT_MANUAL_TIMER = (PLANT_MANUAL_TIMER * 3600) / loopTime;       //wait hours (minus pump on time) to loops
  delayBetweenAlertEmails = 1 * 3600 / loopTime;                     //1 hours as loops of seconds
  delayBetweenRefillReset = 2 * 3600 / loopTime;                     //2 hours as loops of seconds
  delayBetweenDrySoilReset = (PLANT_POT_SIZE * 900 / loopTime) + 1;  //proportion pump run time (pot size as hours) converted to loops of seconds
  delayBetweenOverfloodReset = 8 * 3600 / loopTime;                  //8 hours as loops of seconds
  //}

  DEEP_SLEEP_S = DEEP_SLEEP;      //store in seconds - no need to convert in loop()
  LOG_INTERVAL_S = LOG_INTERVAL;  //store in seconds - no need to convert in loop()

  DEEP_SLEEP_MS = DEEP_SLEEP * 1000;   //milliseconds millis()
  DEEP_SLEEP = DEEP_SLEEP_MS * 1000;   //microseconds micros()
  LOG_INTERVAL = LOG_INTERVAL * 1000;  //milliseconds millis()
}

String getContentType(String filename) {
  if (filename.endsWith("ml"))
    return FPSTR(text_html);
  else if (filename.endsWith("ss"))
    return F("text/css");
  else if (filename.endsWith("js"))
    return F("application/javascript");
  /*
  else if (filename.endsWith("ng"))
    return "image/png";
  else if (filename.endsWith("pg"))
    return "image/jpeg";
  */
  else if (filename.endsWith("co"))
    return F("image/x-icon");
  else if (filename.endsWith("vg"))
    return F("image/svg+xml");
  return FPSTR(text_plain);
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
#ifdef ESP8266
    Update.runAsync(true);  // tell the updaterClass to run in async mode
#endif
    if (filename.indexOf("fs") != -1) {
      //if (request->hasParam("filesystem", true)) {
#ifdef ESP8266
      close_all_fs();
//#else
//     LittleFS.end();
//     LittleFS.begin();
#endif

#ifdef ESP32
      //https://github.com/ayushsharma82/ElegantOTA/blob/master/src/ElegantOTA.cpp
      size_t fsSize = UPDATE_SIZE_UNKNOWN;
#elif defined(ESP8266)
#if (ARDUINO_ESP8266_MAJOR >= 3 && ARDUINO_ESP8266_MINOR >= 1)
      size_t fsSize = ((size_t)FS_end - (size_t)FS_start);  //3.1.x
#else
      size_t fsSize = ((size_t)&_FS_end - (size_t)&_FS_start);
#endif
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
    if (filename.endsWith("vg") || filename.endsWith("ss"))
      filename = "svg/" + filename;
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

#if EMAILCLIENT_SMTP
void smtpSend(const char *subject, const char *body, uint8_t now) {

#if DEBUG
  Serial.printf("Email: %s\n", subject);
#endif

  if (now == 0 && rtcData.alertTime < delayBetweenAlertEmails) {
#if DEBUG
    Serial.printf("Email Timeout: %u (%u)\n", delayBetweenAlertEmails, rtcData.alertTime);
#endif
    return;
  }
  /*
  WIRELESS_MODE = NVRAMRead(_WIRELESS_MODE).toInt();
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
#if TIMECLIENT_NTP
  smtp.setSystemTime(timeClient.getEpochTime());  //timestamp (seconds since Jan 1, 1970)
//#else
//  session.time.ntp_server = F("pool.ntp.org");
//  session.time.gmt_offset = -8;
//  session.time.day_light_offset = 0;
#endif

  const char *smtpURL = NVRAMRead(_SMTP_SERVER);
  char smtpServer[64] = { 0 };
  uint16_t smtpPort = 25;
  const char *colon = strchr(smtpURL, ':');  // Find the colon
  if (colon) {
    size_t hostLen = colon - smtpURL;
    memcpy(smtpServer, smtpURL, hostLen);

    const char *portStr = colon + 1;  //points one character after the colon
    smtpPort = fastAtoi(portStr);     // assumes only digits
  } else {
    // No colon found, copy full string as hostname
    strncpy(smtpServer, smtpURL, sizeof(smtpServer));
  }
  session.server.host_name = smtpServer;
  session.server.port = smtpPort;
  session.login.email = NVRAMRead(_SMTP_USERNAME);
  File oauth = LittleFS.open("/oauth", "r");
  if (oauth) {
    session.login.accessToken = oauth.readString();  //XOAUTH2
  } else {
    session.login.password = NVRAMRead(_SMTP_PASSWORD);
  }
  //session.login.user_domain = F("127.0.0.1");
  /*
  if(smtpPort > 25) {
    session.secure.mode = esp_mail_secure_mode_ssl_tls;
  }else{
    session.secure.mode = esp_mail_secure_mode_nonsecure;
  }
  */
  //File mlog = LittleFS.open("/l", "w");

  if (smtp.connect(&session)) {
    message.sender.name = PLANT_NAME;
    message.sender.email = NVRAMRead(_SMTP_USERNAME);
    message.addRecipient("", NVRAMRead(_EMAIL_ALERT));
    //message.addCc("");
    //message.addBcc("");
    message.subject = subject;
    message.text.content = body;
    if (ALERTS[7] == '1') {
      message.priority = esp_mail_smtp_priority::esp_mail_smtp_priority_high;
    } else {
      message.priority = esp_mail_smtp_priority::esp_mail_smtp_priority_normal;
    }
#if DEBUG
    if (!MailClient.sendMail(&smtp, &message, true)) {
      Serial.println(smtp.errorReason());
    }
#else
    MailClient.sendMail(&smtp, &message, true);
    //mlog.print(smtp.errorReason());
#endif
    smtp.sendingResult.clear();  //clear sending result log
    //}else{
    //  mlog.print(String(smtp.statusCode()));
    //  mlog.print(String(smtp.errorCode()));
    //  mlog.print(smtp.errorReason());
  }
  //mlog.close();

  if (off == 1)
    WiFi.mode(WIFI_OFF);
}
#endif

static inline int fastAtoi(const char *s) {
  int v = 0;
  while (*s) {
    v = v * 10 + (*s++ - '0');
  }
  return v;
}

static inline int fastAtoi2(const char *s, int len) {
  int v = 0;
  for (int i = 0; i < len; i++) {
    v = v * 10 + (s[i] - '0');
  }
  return v;
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
