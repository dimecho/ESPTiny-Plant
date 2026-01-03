var refreshTimer;
var refreshSpeed = 10000;
var saveReminder;
var notifyTimer;

var pot_values = [10, 30, 60];
var pot_labels = ['Small', 'Medium', 'Large'];

var soil_values = [0, 300, 780];
var soil_labels = ['Off', 'Dry (Cactus)', 'Wet (Tropical)'];

var timer_values = [0, 86400, 172800, 259200];
var timer_labels = ['Dynamic', 'Once a Day', 'Every 2nd Day', 'Every 3rd Day'];

var soil_type_values = [420, 700, 580, 680, 740];
var soil_pot_offsets = [[0,-10,-20], [0,0,0], [0,0,0], [5,10,0], [0,0,0]];
var soil_type_labels = ['Moss', 'Loam', 'Dirt', 'Clay', 'Sand', 'Rock'];
var soil_type_color = ['#3d9919', '#000000', '#58280c', '#7b4626', '#e39356', '#b4b0a6'];

var timerUploadCounter = 0;

//ESP8266 EEPROM Variables
var WIFI_MODE = 1;
var WIFI_HIDE = 2;
var WIFI_PHY_MODE = 3;
var WIFI_PHY_POWER = 4;
var WIFI_CHANNEL = 5;
var WIFI_SSID = 6;
var WIFI_USERNAME = 7;
var WIFI_PASSWORD = 8;
var LOG_ENABLE = 9;
var LOG_INTERVAL = 10;
//==========
var NETWORK_DHCP = 11
var NETWORK_IP = 12;
var NETWORK_SUBNET = 13;
var NETWORK_GATEWAY = 14;
var NETWORK_DNS = 15;
//==========
var PLANT_POT_SIZE = 16;
var PLANT_SOIL_MOISTURE = 17;
var PLANT_MANUAL_TIMER = 18;
var PLANT_SOIL_TYPE = 19;
var PLANT_TYPE = 20;
var DEEP_SLEEP = 21;
//==========
var EMAIL_ALERT = 22;
var SMTP_SERVER = 23;
var SMTP_USERNAME = 24;
var SMTP_PASSWORD = 25;
var PLANT_NAME = 26;
var ALERTS = 27;
var DEMO_PASSWORD = 28;
var TIMEZONE_OFFSET = 29;
var DEMO_AVAILABILITY = 30;
var PNP_ADC = 31;
var DEMOLOCK = false;
var ESP32 = false;
//==========
var redirectURL = location.protocol + '//' + location.host + '.nip.io' + location.pathname;

function notify(messageHeader, messageBody, bg, id) {
    if(bg == 'danger') {
        bg = 'bg-red-500';
    }else if(bg == 'warning') {
        bg = 'bg-yellow-500';
    }else{
        bg = 'bg-green-500';
    }
    var toast = document.createElement('div');
    toast.className = 'px-4 py-1 rounded text-white ' + bg;

    if (messageHeader != '') {
        var toastHeader = document.createElement('div');
        toastHeader.className = 'flex border-b ' + bg;
        toastHeader.textContent = messageHeader;
        
        var btnClose = document.createElement('button');
        btnClose.className = 'flex ml-auto';
        btnClose.textContent = 'X';
        toastHeader.appendChild(btnClose);
        toast.appendChild(toastHeader);
    }

    if (messageBody != '') {
        var toastBody = document.createElement('div');
        toastBody.className = 'toast-body';
        toastBody.textContent = messageBody;
        toast.appendChild(toastBody);
    }
    document.getElementById('notify').appendChild(toast);

    setTimeout(function(toast) {
        document.getElementById('notify').removeChild(toast);
    }, 3600, toast);
}

function saveSetting(offset, value, callback) {

	if(DEMOLOCK) {
		PlantLogin();
	}else{
	    var xhr = new XMLHttpRequest();
	    xhr.onload = function() {
	    	if (xhr.responseText == 'Locked') {
				DEMOLOCK = true;
				PlantLogin();
	    	}else{
	    		DEMOLOCK = false;
	    	}
	    	if (callback) callback(xhr.responseText);
	    };
	   	xhr.open('GET', '/nvram.json?offset=' + offset + '&value=' + value, true);
	    xhr.send();
	}
}

function PlantLogin() {
	hideAllModals();
	document.getElementById('demo-lock').classList.remove('hidden');
}

function hideModal(button) {
    let modal = button.closest('.flex');
    while (modal && !modal.classList.contains('modal')) {
        modal = modal.parentElement;
    }
    if (modal) {
    	const backdrop = document.getElementById('modal-backdrop');
    	backdrop.classList.add('hidden');
        modal.classList.add('hidden');
    }
}

function hideAllModals() {
	const backdrop = document.getElementById('modal-backdrop');
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.classList.add('hidden');
    });
    backdrop.classList.add('hidden');
}

function RequireInput(id, value) {
    if(value == true) {
        document.getElementById(id).setAttribute('required', '');
    }else{
        document.getElementById(id).removeAttribute('required');
    }
}

function resetFlash()
{
    window.open('/api?reset=1');
}

function progressTimer(speed, bar, callback)
{
    timerUploadCounter = 0;

    var timer = setInterval(function() {
        timerUploadCounter++;
        if(timerUploadCounter == 100) {
            clearInterval(timer);
            if(callback) callback(timerUploadCounter);
        }
        document.getElementsByClassName('progress-bar')[bar].style.width = timerUploadCounter + '%';
    }, speed);
}