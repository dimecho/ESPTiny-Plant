var theme = detectTheme();

var refreshTimer;
var refreshSpeed = 10000;
var saveReminder;
var notifyTimer;

var solar_values = [0, 1];
var solar_labels = ['OFF', 'ON'];
var solar_adc_offset = 20; //with solar add offset

var pot_values = [10, 70, 120];
var pot_labels = ['Small', 'Medium', 'Large'];

var soil_values = [300, 780];
var soil_labels = ['Dry (Cactus)', 'Wet (Tropical)'];

var timer_values = [0, 86400, 172800, 259200];
var timer_labels = ['Dynamic', 'Once a Day', 'Every 2nd Day', 'Every 3rd Day'];

var soil_type_values = [420, 700, 580, 680, 740];
var soil_pot_offsets = [[0,-10,-20], [0,0,0], [0,0,0], [5,10,0], [0,0,0]];
var soil_type_labels = ['Moss', 'Loam', 'Dirt', 'Clay', 'Sand', 'Rock'];
var soil_type_color = ['#3d9919', '#000000', '#58280c', '#7b4626', '#e39356', '#b4b0a6'];

var timerUploadCounter = 0;

document.addEventListener("DOMContentLoaded", function(event)
{
    if((window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        $('link[title="main"]').attr('href', 'css/bootstrap.slate.css');
        $('.icon-day-and-night').attr('data-original-title', '<h6 class="text-white">Light Theme</h6>');
        $('h1').addClass('text-white');
    }else{
        $('link[title="main"]').attr('href', 'css/bootstrap.css');
        $('.icon-day-and-night').attr('data-original-title', '<h6 class="text-white">Dark Theme</h6>');
        $('h1').removeClass('text-white');
    }
    switchTheme('i.icons','text-white','text-dark');
    switchTheme('div','bg-primary','bg-light');
    switchTheme('div','text-white','text-dark');
    switchTheme('img','bg-secondary','bg-light');

    console.log(navigator.appCodeName);
	console.log(navigator.appName);
	console.log(navigator.appVersion);
	console.log(navigator.platform);
	console.log(navigator.userAgent);
	
	if(navigator.platform == 'MacIntel' && navigator.appVersion.indexOf('AppleWebKit') != -1 && navigator.appVersion.indexOf('Safari') == -1) {
		document.getElementById('captive-portal').classList.remove('hidden');
	}else{
	    var target = document.querySelector('#svgInteractive');

	    // If SVG is supported
	    if (typeof SVGRect != "undefined")
	    {
	    	$('head link[rel="stylesheet"]').last().after('<link rel="stylesheet" href="svg/bonsai.css" type="text/css">');

		    // Request the SVG file
		    var ajax = new XMLHttpRequest();
		    ajax.open('GET', 'svg/bonsai.svg', true);
		    ajax.send();

		    // Append the SVG to the target
		    ajax.onload = function(e) {
	            target.innerHTML = ajax.responseText;
	            document.getElementById('timer-enabled').classList.add('hidden');

	            var nvram = new XMLHttpRequest();
	            nvram.responseType = 'json';
	            //nvram.overrideMimeType('application/json');
	            nvram.open('GET', '/nvram', true);
	            nvram.send();
	            nvram.onload = function(e) {
	                if(nvram.response != null) {
	                    NVRAMtoSVG(nvram.response);
	                }
	                var adc = new XMLHttpRequest();
	                adc.open('GET', '/adc', true);
	                adc.send();
	                adc.onload = function(e) {
	                    if(adc.responseText > 1010 && adc.responseText < 1024)
	                    {
	                        $.iGrowl({ type: 'error', message: 'Detecting Excess Moisture!' });
	                        if(nvram.response['nvram'][14] > 12) {
	                            $.iGrowl({ type: 'info', message: 'Lower Pot Size value'  });
	                            $.iGrowl({ type: 'info', message: 'Adjust sensor to soil height' });
	                        }else{
	                            $.iGrowl({ type: 'info', message: 'Compact soil water channels' });
	                            $.iGrowl({ type: 'info', message: 'Move sensor away from water' });
	                        }
	                    //}else{
	                    	//$.iGrowl({ type: 'info', message: 'Current Moisture: ' + adc.responseText  });
	                    }
	                }
	            }
		            
	            $('#graph').on('click',function () {
	                window.location.href = 'graph.html';
	            });

	            $('#led').on('click',function () {
	                var x = document.getElementById('led-enabled');
				  	if (x.style.display === 'block') {
				  		x.style.display = 'none';
				   		saveSetting(19, 0);
				  	} else {
				   		x.style.display = 'block';
				    	document.getElementById('power-text').textContent = 8;
				    	saveSetting(19, 1);
	                	saveSetting(20, 8);
				  	}
	            });

		        $('#timer').on('click',function () {
		            //var timerModal = new bootstrap.Modal(document.getElementById('moisture-Settings'), {backdrop: true});
		            //timerModal.show();
		            window.location.href = '#moisture-Settings';
		            document.getElementById('moisture-Settings').style.display = 'block';

		            $("#moisture-Slider").roundSlider({
		                value: document.getElementById('timer-text').textContent,
		                //svgMode: true,
		                radius: 280,
		                width: 32,
		                handleSize: "+64",
		                handleShape: "dot",
		                sliderType: "min-range",
		                min: 0,
		                max: 96,
		                change: function (args) {
		                    document.getElementById('timer-text').textContent = args.value;
		                    if (args.value == 0) {
		                        $('#timer-enabled').hide();
		                        $('#timer-disabled').show();
		                    }else{
		                        $('#timer-disabled').hide();
		                        $('#timer-enabled').show();

		                        $.iGrowl({ type: 'error', message:  'Timer disables Soil Sensor' });
		                        if(args.value < 8) //less than 8 hours
		                            $.iGrowl({ type: 'notice', message:  'Timer is Low! No Overwater protection'});
		                        $.iGrowl({ type: 'info', message:  'Enable when issues with Sensor'});
		                    }
		                    saveSetting(17, args.value);
		                }
		            });
		            //$('#timer-enabled').toggle('slow');
		            //$('#timer-disabled').toggle('slow');
		        });
		        
		        $('#moisture').on('click',function () {
		            window.location.href = '#moisture-Settings';
		            document.getElementById('moisture-Settings').style.display = 'block';

		            $("#moisture-Slider").roundSlider({
		                value: document.getElementById('moisture-text').textContent,
		                //svgMode: true,
		                radius: 280,
		                width: 32,
		                handleSize: "+64",
		                handleShape: "dot",
		                sliderType: "min-range",
		                min: 200,
		                max: 1000,
		                change: function (args) {
		                    document.getElementById('moisture-text').textContent = args.value;
		                    saveSetting(16, args.value);
		                }
		            });
		        });
		        
		        $('#pot-size').on('click',function () {
		            window.location.href = '#pot-size-Settings';
		            document.getElementById('pot-size-Settings').style.display = 'block';

		            $("#pot-size-Slider").roundSlider({
		                value: document.getElementById('pot-size-text').textContent,
		                //svgMode: true,
		                radius: 280,
		                width: 32,
		                handleSize: "+64",
		                handleShape: "dot",
		                sliderType: "min-range",
		                min: 2,
		                max: 40,
		                change: function (args) {
		                    document.getElementById('pot-size-text').textContent = args.value;
		                    saveSetting(15, args.value);
		                }
		            });
		        });

		        $('#power').on('click',function () {
		            window.location.href = '#power-Settings';
		            document.getElementById('power-Settings').style.display = 'block';

		            $("#power-Slider").roundSlider({
		                value: document.getElementById('power-text').textContent,
		                //svgMode: true,
		                radius: 280,
		                width: 32,
		                handleSize: "+64",
		                handleShape: "dot",
		                sliderType: "min-range",
		                min: 1,
		                max: 60,
		                change: function (args) {
		                	if(args.value == 0) {
		                		$.iGrowl({ type: 'error', message: 'Sleep Disabled!' });
		                		$.iGrowl({ type: 'notice', message: 'Battery Will Discharge Quickly!' });
		                	}else if(args.value < 10) {
		                		$.iGrowl({ type: 'notice', message: 'Low Sleep = High Power Consumption!' });
		                		$.iGrowl({ type: 'success', message: 'Sleep > 10 Seconds Recommended' });
		                	}
		                    document.getElementById('power-text').textContent = args.value;
		                    saveSetting(20, args.value);
		                }
		            });
		        });

		        $('#soil').on('click',function () {
		            window.location.href = '#soil-Settings';
		            document.getElementById('soil-Settings').style.display = 'block';
		            
		            var svgSoil = document.querySelector('#svgSoil');

		            if (typeof SVGRect != "undefined") {
		                var ajax = new XMLHttpRequest();
		                ajax.open('GET', 'svg/soil.svg', true);
		                ajax.send();
		                ajax.onload = function(e) {
		                	svgSoil.innerHTML = ajax.responseText;

		                	//$('#svgSoil').width($('#soil-Settings div').clientWidth);
							$('#soil-moss').on('click',function () {
								var moss_color = $('#soil-moss-badge')[0].firstElementChild.attributes.fill.value;
								document.getElementById('soil-type-color').style.fill = moss_color;
						        document.getElementById('soil-text').textContent = soil_type_labels[0];
						        saveSetting(18, 0);
						    });
						    $('#soil-loam').on('click',function () {
						    	var loam_color = $('#soil-loam-badge')[0].firstElementChild.attributes.fill.value;
								document.getElementById('soil-type-color').style.fill = loam_color;
						        document.getElementById('soil-text').textContent = soil_type_labels[1];
						        saveSetting(18, 1);
						    });
						    $('#soil-dirt').on('click',function () {
								var dirt_color = $('#soil-dirt-badge')[0].firstElementChild.attributes.fill.value;
								document.getElementById('soil-type-color').style.fill = dirt_color;
						        document.getElementById('soil-text').textContent = soil_type_labels[2];
						        saveSetting(18, 2);
						    });
						    $('#soil-clay').on('click',function () {
						    	var clay_color = $('#soil-clay-badge')[0].firstElementChild.attributes.fill.value;
						    	document.getElementById('soil-type-color').style.fill = clay_color;
						        document.getElementById('soil-text').textContent = soil_type_labels[3];
						        saveSetting(18, 3);
						    });
						    $('#soil-sand').on('click',function () {
						    	var sand_color = $('#soil-sand-badge')[0].firstElementChild.attributes.fill.value;
						    	document.getElementById('soil-type-color').style.fill = sand_color;
						        document.getElementById('soil-text').textContent = soil_type_labels[4];
						        saveSetting(18, 4);
						    });
						    $('#soil-rock').on('click',function () {
						    	var rock_color = $('#soil-rock-badge')[0].firstElementChild.attributes.fill.value;
						    	document.getElementById('soil-type-color').style.fill = rock_color;
						        document.getElementById('soil-text').textContent = soil_type_labels[5];
						        saveSetting(18, 5);
						    });
		                }
		            }
		        });

		        $(".modalDialog").click(function( event ) {
		            //event.preventDefault();
		            if (event.target !== this)
		                return;
		            //console.log(event.target);
		            this.style.display = 'none';
		        });

		        document.querySelector(".close").addEventListener("click", function(event) {
		            //event.preventDefault();
		            this.parentElement.parentElement.parentElement.parentElement.style.display = 'none';
		        });
		        
		        $('#wireless').on('click',function () {
		            window.location.href = '#wirelessSettings';
		            document.getElementById('wirelessSettings').style.display = 'block';

		            var nvram = new XMLHttpRequest();
		            nvram.responseType = 'json';
		            //nvram.overrideMimeType('application/json');
		            nvram.open('GET', '/nvram', true);
		            nvram.send();
		            nvram.onload = function(e) {
		                try{
		                    var data = nvram.response; //nvram.responseText;
		                    document.getElementById('firmwareVersion').textContent = 'Firmware Version: ' + data['nvram'][0];
		                    if(data['nvram'][1] == '0') {
		                        $('#WiFiModeAP').prop('checked', true);
		                    }else{
		                        $('#WiFiModeClient').prop('checked', true);
		                    }
		                    var bool_value = data['nvram'][2] == '1' ? true : false;
		                    $('#WiFiHidden').val(data['nvram'][2]);
		                    $('#WiFiHiddenCheckbox').prop('checked', bool_value);
		                    $("#WiFiPhyMode").val(data["nvram"][3]);
		                    $("#WiFiPower").val(data["nvram"][4]);
		                    $('#WiFiChannel').val(data['nvram'][5]);
		                    $('#WiFiSSID').val(data['nvram'][6]);
		                    bool_value = data['nvram'][7] == '1' ? true : false;
		                    $('#EnableLOG').val(data['nvram'][7]);
		                    $('#EnableLOGCheckbox').prop('checked', bool_value);
		                    $('#EnableLOGInterval').val(data['nvram'][8]);
		                    bool_value = data['nvram'][9] == '1' ? true : false;
		                    $('#WiFiDHCP').val(data['nvram'][9]);
		                    $('#WiFiDHCPCheckbox').prop('checked', bool_value);
		                    if(bool_value == true) {
		                        $('#WiFiIP').prop('disabled', false);
		                        $('#WiFiSubnet').prop('disabled', false);
		                        $('#WiFiGateway').prop('disabled', false);
		                        $('#WiFiDNS').prop('disabled', false);
		                    }
		                    $('#WiFiIP').val(data['nvram'][10]);
		                    $('#WiFiSubnet').val(data['nvram'][11]);
		                    $('#WiFiGateway').val(data['nvram'][12]);
		                    $('#WiFiDNS').val(data['nvram'][13]);

					        $('#EnableLOGInterval').on('input', function() {
				                var v = parseInt(this.value);
				                if(v < 10) {
				                    notify('Log Interval ' + v + ' is low, Flash may fill up fast!', '', 'warning', 'toastWireless');
				                }
				            });

				            $('#wireless-settings-ok').click(function() {
				                if($('#EnableLOGCheckbox').prop('checked') == true) {
				                	var loginterval = $('#EnableLOGInterval').val();
				                	//console.log(loginterval  + " < " + data['nvram'][19]);
					            	if(loginterval > 0 && loginterval < data['nvram'][19]) {
					            		
										var ajax = new XMLHttpRequest();
									    ajax.open('GET', '/nvram?offset=20&value=' + loginterval, false);
									    ajax.send();

					            		$.iGrowl({ type: 'error', message:  'Deep Sleep is longer than Graph Interval'});
										$.iGrowl({ type: 'success', message:  'Adjusting Deep Sleep ...'});
					            	}
					            }
				                $('#wirelessSettingsForm').submit();
				            });

		                }catch{}
		            }

		            $('#fileLittleFS').change(function() {
		                $('#formLittleFS').attr('action', 'http://' + window.location.hostname + "/update"); //force HTTP
		                progressTimer(80);
		                document.getElementById('formLittleFS').submit();
		            });

		            $('#fileFirmware').change(function() {
		                $('#formFirmware').attr('action', 'http://' + window.location.hostname + "/update"); //force HTTP
		                progressTimer(20);
		                document.getElementById('formFirmware').submit();
		            });

		            $('#browseLittleFS').click(function() {
		                $('#fileLittleFS').trigger('click');
		            });

		            $('#browseFirmware').click(function(){
		                $('#fileFirmware').trigger('click');
		            });
		        });
		    }
	    //} else {  // Fallback to png
	    //target.innerHTML = "<img src='" + url + ".png' />";
	    }
	}
        
    /*$('#svgInteractive').load('interactive.svg',function(response){
        $(this).addClass('svgLoaded');


        if(!response){ // Error loading SVG
            $(this).html('Error loading SVG. Be sure you are running from http protocol (not locally)');
        }
    });*/
});

function saveSetting(offset, value) {

    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/nvram?offset=' + offset + '&value=' + value, true);
    xhr.send();

    //notify(request.responseText , '', 'danger');
};

function HiddenCheck(id, element) {
    console.log(id);

    if(element.checked) {
        $('#' + id).val(1);
    }else{
        $('#' + id).val(0);
    }

    if(id == 'WiFiDHCP') {
        var b = false;

        if(element.checked){
            var wifi_mode = document.getElementsByName('WiFiMode');
            console.log(wifi_mode[0].checked);
            if(wifi_mode[0].checked) {
                notify('DHCP works only in WiFi Client mode' , '', 'warning', 'toastWireless');
            }
            b = true;
        }
        $('#WiFiIP').prop('disabled',  b);
        $('#WiFiSubnet').prop('disabled', b);
        $('#WiFiGateway').prop('disabled', b);
        $('#WiFiDNS').prop('disabled', b);
    }
};

function NVRAMtoSVG(data)
{
    if(data['nvram'][7] == '1') {
        $('#graph-enabled').show();
    }else{
        $('#graph-enabled').hide();
    }
    if(data['nvram'][18] == '1') {
        $('#led-enabled').show();
    }else{
        $('#led-enabled').hide();
    }
    if (data['nvram'][16] == '0') {
        $('#timer-enabled').hide();
        $('#timer-disabled').show();
    }else{
        $('#timer-disabled').hide();
        $('#timer-enabled').show();
    }
    
    document.getElementById('pot-size-text').textContent = data['nvram'][14];
    document.getElementById('moisture-text').textContent = data['nvram'][15];
    document.getElementById('timer-text').textContent = data['nvram'][16];
    document.getElementById('power-text').textContent = data['nvram'][19];
    document.getElementById('soil-text').textContent = soil_type_labels[data['nvram'][17]];
    document.getElementById('soil-type-color').style.fill = soil_type_color[data['nvram'][17]];
};



function formValidate() {
    WiFiPasswordConfirm.setCustomValidity(WiFiPasswordConfirm.value != WiFiPassword.value ? 'Passwords do not match.' : '');
};

function notify(messageHeader, messageBody, bg, id) {
    //var myToast = document.getElementById('myToast');
    //var toast = new bootstrap.Toast(myToast, {delay: 3000});
    //toast.show();
    var toastElList = [];

    if(id != undefined) {
        toastElList.push(document.getElementById(id));
    }else{
        toastElList = [].slice.call(document.querySelectorAll('.toast'));
    }
    toastElList[0].className = 'toast text-white ml-auto w-100';
    toastElList[0].classList.add('bg-' + bg);

    if (messageHeader != '') {
        toastElList[0].children[0].className = 'toast-header text-white';
        toastElList[0].children[0].classList.add('bg-' + bg);
        toastElList[0].children[0].children[0].textContent = messageHeader;
    }

    if (messageBody != '') {
        var toastBody = document.createElement('div');
        toastBody.className = 'toast-body';
        toastBody.textContent = messageBody;
        toastElList[0].appendChild(div);
    }

    var toastList = toastElList.map(function (toastEl) {
      return new bootstrap.Toast(toastEl, {delay:5000})
    })
    toastList[0].show();
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testPump()
{
    $.ajax('usb.php?eeprom=write&offset=' + ee + ',' + e_deepSleep + '&value=' + parseInt(0xEB) + ',0', {
        success: function(data) {
            debug = 0xEB;
            $.notify({ message: 'Pump Test Ready ...' }, { type: 'success' });
            setTimeout(async function () {
                for (var i = 8; i > 0; i--) {
                    $.notify({ message: i }, { type: 'warning'});
                    await sleep(1000);
                }
                setTimeout(async function () {
                    $.notify({ message: 'Self Test Complete' }, { type: 'success'});
                    sendStop();
                }, refreshSpeed);
            }, 4000);
        }
    });
};

function calcNextWaterCycle(start, stop, size)
{
    /* All calculations are approximate */

	var days = 0;
	if((start - stop) > 0) {

		//Calculate Days
		while (start > stop) {
			var c = 180;
			if(start >= 850) { //...slow start
				c = 24;
			}else if(start >= 800) {
				c = 40 + size;
			}else if(start >= 700) {
				c = 50 + size;
			}else if(start >= 600) {
				c = 80 + size;
			}else if(start >= 500) { //..faster ending
				c = 100 + size;
			}
			start -= c;
			days++;

            //Calculate Hours
            //TODO:
 		}
 		console.log('Days: ' + days);
 	
 		var hours = Math.abs(start-stop);
		console.log('Hours: ' + hours);
	}
	return days;
};

function detectTheme()
{
    var t; // = getCookie('theme');
    if(t == undefined) {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return '.slate';
        }else{
            return ''
        }
    }
    return t;
};

function switchTheme(element,dark,light) {
     if(theme == '') {
        var e = $(element + '.' + dark);
        e.removeClass(dark);
        e.addClass(light);
    }else{
        var e = $(element + '.' + light);
        e.removeClass(light);
        e.addClass(dark);
    }
};

function checkFirmwareUpdates(v)
{
	var split = v.split('.');
	var _version = parseFloat(split[0]);
    var _build = parseFloat(split[1]);
    
    /*
    var check = Math.random() >= 0.5;
    if (check === true)
    {
    	var xhr = new XMLHttpRequest();
        xhr.responseType = 'json';
        xhr.onload = function() {
            if (xhr.status == 200) {
                try {
                    var release = xhr.response.tag_name.replace('v','').replace('.R','');
                    var split = release.split('.');
                    var version = parseFloat(split[0]);
                    var build = parseFloat(split[1]);

                    //console.log('Old Firmware:' + _version + ' Build:' + _build);
                    //console.log('New Firmware:' + version + ' Build:' + build);

                    if(version > _version || build > _build)
                    {
                        var url = 'https://github.com/dimecho/ESPTiny-Plant/releases/download/';
                        url += version + 'Tiny.Plant.zip';
                        $.notify({
                            icon: 'icon icon-download',
                            title: 'New Firmware',
                            message: 'Available <a href="' + url + '" target="_blank">Download</a>'
                        }, {
                            type: 'success'
                        });
                    }
                } catch(e) {}
            }
        };
        xhr.open('GET', 'https://api.github.com/repos/dimecho/ESPTiny-Plant/releases/latest', true);
        xhr.send();
    }
    */
};

function progressTimer(speed) {
    var timer = setInterval(function(){
    	timerUploadCounter++;
    	if(timerUploadCounter == 100) {
	        clearInterval(timer);
	    }
	    document.getElementsByClassName('progress-bar')[0].style.width = timerUploadCounter + '%';
    }, speed);
};
