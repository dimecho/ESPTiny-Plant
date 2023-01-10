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
Remove-Item -Recurse -Force .\data\nvram.json -ErrorAction SilentlyContinue
New-Item -ItemType directory -Path .\data\img
Copy-Item -Path .\Web\img\cert.svg -Destination .\data\img

#====================
#Download Compressors
#====================
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12;

if(!(Test-Path .\tools -PathType Container)) { 
  New-Item -ItemType directory -Path .\tools
}

if (!(Test-Path .\tools\mklittlefs.exe)) {
	Invoke-WebRequest -OutFile .\tools\x86_64-w64-mingw32-mklittlefs-295fe9b.zip -Uri "https://github.com/earlephilhower/mklittlefs/releases/download/3.0.0/x86_64-w64-mingw32-mklittlefs-295fe9b.zip"
}

if (!(Test-Path "C:\ProgramData\chocolatey\bin\gzip.exe")) {
	#Invoke-WebRequest -OutFile .\tools\gzip-1.3.12-1-bin.zip -Uri "http://sourceforge.mirrorservice.org/g/gn/gnuwin32/gzip/1.3.12-1/gzip-1.3.12-1-bin.zip"
  if(!(Test-Path "C:\ProgramData\chocolatey" -PathType Container)) {
    if (!(Test-Path .\tools\chocolatey.ps1)) {
      Invoke-WebRequest -OutFile .\tools\chocolatey.ps1 -Uri "https://chocolatey.org/install.ps1"
    }
    Elevate
    Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -File ""$PSScriptRoot\tools\chocolatey.ps1""" -NoNewWindow -Wait
  }
  Start-Process powershell -ArgumentList "choco install gzip -y" -NoNewWindow -Wait
}

Get-ChildItem .\tools -Filter *.zip | 
Foreach-Object {
  Expand-Archive -Path $_.FullName -DestinationPath .\tools -Force
  Remove-Item $_.FullName -ErrorAction SilentlyContinue
}
Move-Item .\tools\mklittlefs\mklittlefs.exe -Destination .\tools -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .\tools\mklittlefs -ErrorAction SilentlyContinue

#==============
#Compress Files
#==============
Get-ChildItem .\data -Recurse -Exclude *.key,*.cer -Filter *.* | 
Foreach-Object {
    if (-Not (Test-Path $_.FullName -PathType Container)) {
      gzip.exe $_.FullName
      Move-Item "$($_.FullName).gz" -Destination $_.FullName
    }
}

#================
#Find Folder Size
#================
if(!(Test-Path .\build -PathType Container)) { 
  New-Item -ItemType directory -Path .\build
}
#Start-Process .\tools\mklittlefs.exe -ArgumentList "-c .\data -b 8192 -p 256 -s 643072 flash-littlefs.bin" -NoNewWindow -PassThru -Wait
Start-Process .\tools\mklittlefs.exe -ArgumentList "-c .\data -b 8192 -p 256 -s 680000 .\build\flash-littlefs.bin" -NoNewWindow -PassThru -Wait