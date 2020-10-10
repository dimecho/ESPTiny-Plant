<p align="center"><img src="Web/img/icon.png?raw=true"></p>

# ESPTiny Plant (WiFi Edition)

Monitor soil moisture and water plant. Portable and high efficiency with lithium-ion batteries.

This is the next evolution from the original [ATtiny13 Plant](https://github.com/dimecho/ATtiny13-Plant).

- WiFi (Web Interface)
- Battery Deep Sleep (20μA)
- Modular PCB (ESP-12E Module, TP4056)

![Photo](Web/img/photo.jpg?raw=true)

![GUI](Web/img/interface.png?raw=true)

## Download

[ESP8266 Firmware](../../releases/download/1.0/ESPTiny-Plant-Firmware.zip)

## Connect

    SSID: Plant
    Password: (blank)
    Interface: http://192.168.8.8

## Update

    1) Connect to ESP8266 WiFi
    2) Go to http://192.168.8.8/update

## BOM (Bill of Materials)

| Part  | Value       | Function      |
| ----- |:-----------:| -------------:|
| IC1   | ESP-12E/F/S | WiFi		  |
| R1    | 10k         | CPU Enable	  |
| R2 	| 470R		  | Deep Sleep	  |
| R3 	| 220k   	  | Sensor        |
| R4 	| 10k   	  | Sensor (A0)   |
| R5 	| 1.2k   	  | Pump	      |
| T1    | 2N4401 NPN  | Pump          |
| REG1 	| HT7333 LDO  | Regulator     |
| -     | 3.7-4.2V    | Battery		  |
| -     | TP4056      | Charger		  |

For 12V Battery use HT7533**-2** Regulator

## Diagram

![Diagram](Web/img/diagram.png?raw=true)

![Technical](Web/img/technical.png?raw=true)

## Build

Sketch (Firmware)

1. Install [Arduino IDE](https://www.arduino.cc/en/main/software)
2. Arduino/File -> Preferences -> Additional Boards Manager URLs: http://arduino.esp8266.com/stable/package_esp8266com_index.json
3. Tools -> Boards -> Board Manager -> esp8266 -> Install
4. Tools -> Boards -> NodeMCU 1.0 -> Flash Size -> 4M (3M SPIFFS)
5. Sketch -> Export compiled Binary

FileSystem (Web Interface)

1. Run "littlefs-build-mac" (Mac) to build LittleFS "/data"

**Note:** Files must be GZIP'ed. HTTP server sends compressed code to the Browser for decompression.
```
response->addHeader("Content-Encoding", "gzip");
```

Flashing Options:

1. [Wireless - Web Interface](http://192.168.8.8/update)
2. [USB-Serial/TTL - Arduino LittleFS Plugin](https://github.com/earlephilhower/arduino-esp8266littlefs-plugin)
3. USB-Serial/TTL - Script "littlefs" (Mac)

![Flash](Web/img/flash.png?raw=true)

## Bootloader (SDK)

The ESP requires a bootloader, normally loaded by the manufacturer.

Two Options:

1. [Espressif NONOS SDK](https://www.espressif.com/en/support/download/sdks-demos) (Original)
2. [NodeMCU with ADC](https://nodemcu-build.com) (Open-Source)

Run "bootloader" (Mac)

## License

[![CCSA](https://licensebuttons.net/l/by-sa/4.0/88x31.png)](https://creativecommons.org/licenses/by-sa/4.0/legalcode)