<p align="center"><img src="Web/img/icon.png?raw=true"></p>

# ESPTiny Plant (WiFi Edition)

Monitor soil moisture and water plant. Portable and high efficiency with lithium-ion batteries.

This is the next evolution from the original [ATtiny13 Plant](https://github.com/dimecho/ATtiny13-Plant).

- WiFi (Web Interface) :seedling: [View Demo](https://dimecho.github.io/ESPTiny-Plant/Web/index.html)
- Battery Deep Sleep (20μA)
- Modular PCB (ESP-12E Module, TP4056)

<p align="center">

![Photo](Web/img/photo.jpg?raw=true)

![Diagram](Web/img/diagram.png?raw=true)

</p>

## Download

[ESP8266 Firmware](../../releases/download/latest/ESPTiny-Plant-Firmware.zip)

## Connect

    SSID: Plant
    Password: (blank)
    Interface: http://192.168.8.8

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

## Technical

<p align="center">

![Technical](Web/img/technical.png?raw=true)

</p>

## Build

Sketch (Firmware)

1. Install [Arduino IDE](https://www.arduino.cc/en/main/software)
2. Arduino/File -> Preferences -> Additional Boards Manager URLs: http://arduino.esp8266.com/stable/package_esp8266com_index.json
3. Tools -> Boards -> Board Manager -> esp8266 -> Install
4. Tools -> Boards -> NodeMCU 1.0 -> Flash Size -> 4M (2M SPIFFS)
5. Sketch -> Export compiled Binary

Firmware Binary: `build/esp8266.esp8266.nodemcuv2/ESPTiny-Plant.ino.bin`

Additional Libraries

* https://github.com/me-no-dev/ESPAsyncWebServer
* https://github.com/devyte/ESPAsyncDNSServer
* https://github.com/me-no-dev/ESPAsyncTCP
* https://github.com/me-no-dev/ESPAsyncUDP
* https://github.com/mobizt/ESP-Mail-Client

File System (Web Interface)

1. Run "littlefs-build-mac" (Mac) or "littlefs-build-win.ps1" (Windows) to build. LittleFS Binary: `build/flash-littlefs.bin`

**Note:** Files must be GZIP'ed. HTTP server sends compressed code to the Browser for decompression.
```
response->addHeader("Content-Encoding", "gzip");
```

Flashing Options:

1. Wireless - Web Browser [http://192.168.8.8/update](http://192.168.8.8/update)
2. USB-Serial/TTL - [Arduino LittleFS Plugin](https://github.com/earlephilhower/arduino-esp8266littlefs-plugin)
3. USB-Serial/TTL - Script "littlefs-flash-mac" (Mac) or "littlefs-flash-win.ps1" (Windows)

![Flash](Web/img/flash.png?raw=true)

## License

[![CCSA](https://licensebuttons.net/l/by-sa/4.0/88x31.png)](https://creativecommons.org/licenses/by-sa/4.0/legalcode)