function Elevate() {
  # Get the ID and security principal of the current user account
  $myWindowsID=[System.Security.Principal.WindowsIdentity]::GetCurrent()
  $myWindowsPrincipal = New-Object System.Security.Principal.WindowsPrincipal($myWindowsID)

  # Check to see if we are currently running "as Administrator"
  if (!$myWindowsPrincipal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)){
        Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -File ""$PSCommandPath""" -verb runas
    exit
  }
}

cd $PSScriptRoot
#==============
#Copy Files
#==============
Remove-Item -Recurse -Force .\data -ErrorAction SilentlyContinue
Copy-Item -Path .\Web\ -Filter *.* -Destination .\data\ -Recurse
Remove-Item -Recurse -Force .\data\img -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .\data\svg\extra -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .\data\nvram.json -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .\data\svg\index.html -ErrorAction SilentlyContinue
New-Item -ItemType directory -Path .\data\img
Copy-Item -Path .\Web\img\cert.svg -Destination .\data\img

#==============
#Download
#==============
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12;

if(!(Test-Path .\tools -PathType Container)) { 
  New-Item -ItemType directory -Path .\tools
}
if (!(Test-Path "C:\ProgramData\chocolatey\lib\gzip\tools\bin\gzip.exe")) {
  if(!(Test-Path "C:\ProgramData\chocolatey" -PathType Container)) {
    if (!(Test-Path .\tools\chocolatey.ps1)) {
      Invoke-WebRequest -OutFile .\tools\chocolatey.ps1 -Uri "https://chocolatey.org/install.ps1"
    }
    Elevate
    Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -File ""$PSScriptRoot\tools\chocolatey.ps1""" -NoNewWindow -Wait
  }
  Start-Process powershell -ArgumentList "choco install gzip -y" -NoNewWindow -Wait
}
if (!(Test-Path "C:\ProgramData\chocolatey\lib\python")) {
  Elevate
  Start-Process powershell -ArgumentList "choco install python -y" -NoNewWindow -Wait
}
if (!(Test-Path "C:\ProgramData\chocolatey\lib\openssl")) {
  Elevate
  Start-Process powershell -ArgumentList "choco install openssl -y" -NoNewWindow -Wait
}

#==============
#Compress Files
#==============
Get-ChildItem .\data -Recurse -Exclude *.key,*.cer -Filter *.* | 
Foreach-Object {
  if (-Not (Test-Path $_.FullName -PathType Container)) {
    C:\ProgramData\chocolatey\lib\gzip\tools\bin\gzip.exe $_.FullName
    Move-Item "$($_.FullName).gz" -Destination $_.FullName
  }
}

#================
#Build LittleFS
#================
if(!(Test-Path .\build -PathType Container)) { 
  New-Item -ItemType directory -Path .\build
}
#================
#Sign LittleFS
#================
$littlefsSelect = Read-Host -Prompt "`n1) ESP8266`n2) ESP32`n"
if($littlefsSelect -eq 1) {
    $mklittlefs = "$env:LOCALAPPDATA\Arduino15\packages\esp8266\tools\mklittlefs\3.1.0-gcc10.3-e5f9fec\mklittlefs.exe"
    Start-Process $mklittlefs -ArgumentList "-c .\data -b 8192 -p 256 -s 2064384 .\build\flash-littlefs.bin" -NoNewWindow -PassThru -Wait
    python "$env:LOCALAPPDATA\Arduino15\packages\esp8266\hardware\esp8266\3.1.1\tools\signing.py --mode sign --privatekey $PSScriptRoot\private.key --bin $PSScriptRoot\build\flash-littlefs.bin --out $PSScriptRoot\build\flash-littlefs.bin.signed"
    Start-Process $mklittlefs -ArgumentList "-c .\data -b 8192 -p 256 -s 2072576 .\build\flash-littlefs.bin" -NoNewWindow -PassThru -Wait
}else{
    $mklittlefs = "$env:LOCALAPPDATA\Arduino15\packages\esp32\tools\mklittlefs\3.0.0-gnu12-dc7f933\mklittlefs.exe"
    Start-Process $mklittlefs -ArgumentList "-c .\data -b 4096 -p 256 -s 518144 .\build\flash-littlefs.bin" -NoNewWindow -PassThru -Wait
}
