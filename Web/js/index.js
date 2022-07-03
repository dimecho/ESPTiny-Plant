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

document.addEventListener('DOMContentLoaded', function(event)
{
	loadTheme();

    console.log(navigator.appCodeName);
	console.log(navigator.appName);
	console.log(navigator.appVersion);
	console.log(navigator.platform);
	console.log(navigator.userAgent);
	
	if(navigator.platform == 'MacIntel' && navigator.appVersion.indexOf('AppleWebKit') != -1 && navigator.appVersion.indexOf('Safari') == -1) {
		document.getElementById('captive-portal').classList.remove('hidden');
	}else{
	    loadSVG();
	}
});

function loadSVG(svgfile) {

	var nvram = new XMLHttpRequest();
    nvram.responseType = 'json';
    //nvram.overrideMimeType('application/json');
    nvram.open('GET', 'nvram', true);
    nvram.send();
    nvram.onload = function(e) {

		var svg = document.getElementById('svgInteractive');
		var index = new XMLHttpRequest();

	    // If SVG is supported
	    if (typeof SVGRect != undefined)
	    {
	    	if(nvram.response != undefined) {

 				//var index = new XMLHttpRequest();
				index.open('GET', 'svg', true);
				index.send();
				index.onload = function(e) {
					if(index.response != undefined) {
						var s = index.responseText.split('\n');
						svgfile = s[nvram.response['nvram'][20]]; //match index # to file name
					}
				}
				if(nvram.response['nvram'][9] == 1) {
					notify('', 'Data collection is enabled.', 'info');
				}
			}
			if (svgfile == undefined) {
	    		svgfile = 'bonsai.svg';
	    	}
	    	
			document.getElementById('cssSVG').href = 'svg/' + svgfile.replace('.svg', '.css');
	   
		    // Request the SVG file
		    var xhr = new XMLHttpRequest();
		    xhr.open('GET', 'svg/' + svgfile, true);
		    xhr.send();

		    // Append the SVG to the target
		    xhr.onload = function(e) {
	            svg.innerHTML = xhr.responseText;
	            document.getElementById('timer-enabled').classList.add('hidden');

	            if(nvram.response != undefined) {
	                NVRAMtoSVG(nvram.response);
	            }
	            var adc = new XMLHttpRequest();
	            adc.open('GET', 'adc', true);
	            adc.send();
	            adc.onloadend = function() {
				    if(xhr.status == 200) {
				    	var a = parseInt(adc.responseText);
				    	
				    	if(a > 1010 && a < 1024)
	                    {
	                        notify('', 'Detecting Excess Moisture!', 'danger');
	                        if(nvram.response['nvram'][14] > 12) {
	                            notify('', 'Lower Pot Size value', 'info');
	                            notify('', 'Adjust sensor to soil height', 'info');
	                        }else{
	                            notify('', 'Compact soil water channels', 'info');
	                            notify('', 'Move sensor away from water', 'info');
	                        }
	                    //}else{
	                    	//notify('', 'Current Moisture: ' + a, 'info');
	                    }
	                    document.getElementById('moisture-adc').textContent = a;
					}
				}
		        
		        document.getElementById('background').onclick = function() {
			    	var modal = new bootstrap.Modal(document.getElementById('plant-Type'));
		            modal.show();

		            var svgPlant = document.getElementById('svgPlant');
				    svgPlant.innerHTML = '';
				    
		            var xhr = new XMLHttpRequest();
				    xhr.open('GET', 'svg', true);
				    xhr.send();
				    xhr.onload = function(e) {
			        	var s = xhr.responseText.split('\n');

			        	var index = [];
				        for (var i = 0; i < s.length; i++) {
                        	(function(i) {
	                        	index[i] = new XMLHttpRequest();
				                index[i].open('GET', 'svg/' + s[i], true);
				                index[i].send();
				                index[i].onload = function(e) {
									var parser = new DOMParser();
									var htmlDoc = parser.parseFromString(index[i].responseText, 'text/html');
									htmlDoc.getElementById('timeline').remove();

									var div = htmlDoc.getElementsByTagName('svg')[0];
									div.id = s[i];
									div.className = 'row w-50';
									div.onclick = function() {
										var id = this.id;
										saveSetting(20, i, function() { loadSVG(id); modal.hide(); });
						            }
				                	svgPlant.appendChild(div);
				                }
			                })(i);
                        }
				    }
			    }

	            document.getElementById('graph').onclick = function() {
	                window.location.href = 'graph.html';
	            }

	            document.getElementById('led').onclick = function() {
	                var x = document.getElementById('led-enabled');
				  	if (x.style.display === 'block') {
				  		x.style.display = 'none';
				   		saveSetting(21, 0);
				  	} else {
				   		x.style.display = 'block';
				    	document.getElementById('power-text').textContent = 8;
				    	saveSetting(21, 1);
	                	saveSetting(22, 8);
				  	}
	            }

		        document.getElementById('timer').onclick = function() {
		            var modal = new bootstrap.Modal(document.getElementById('moisture-Settings'));
		            modal.show();

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

		                        notify('', 'Timer disables Soil Sensor', 'danger');
		                        if(args.value < 8) //less than 8 hours
		                        	notify('', 'Timer is Low! No Overwater protection', 'warning');
		                        notify('', 'Enable when issues with Sensor', 'info');
		                    }
		                    saveSetting(18, args.value);
		                }
		            });
		            //$('#timer-enabled').toggle('slow');
		            //$('#timer-disabled').toggle('slow');
		        }
		        
		        document.getElementById('moisture').onclick = function() {
		        	var modal = new bootstrap.Modal(document.getElementById('moisture-Settings'));
		            modal.show();

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
		                    saveSetting(17, args.value);
		                }
		            });
		        }

		        document.getElementById('pot-size').onclick = function() {
		        	var modal = new bootstrap.Modal(document.getElementById('pot-size-Settings'));
		            modal.show();

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
		                    saveSetting(16, args.value);
		                }
		            })
		        }

				document.getElementById('power').onclick = function() {
		        	var modal = new bootstrap.Modal(document.getElementById('power-Settings'));
		            modal.show();

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
		                		notify('', 'Sleep Disabled!', 'danger');
		                		notify('', 'Battery Will Discharge Quickly!', 'warning');
		                	}else if(args.value < 10) {
		                		notify('', 'Low Sleep = High Power Consumption!', 'warning');
		                		notify('', 'Sleep > 10 Seconds Recommended', 'success');
		                	}
		                    document.getElementById('power-text').textContent = args.value;
		                    saveSetting(22, args.value);
		                }
		            })
		        }

		        document.getElementById('soil').onclick = function() {
		        	var modal = new bootstrap.Modal(document.getElementById('soil-Settings'));
		            modal.show();
		            
		            var svgSoil = document.getElementById('svgSoil');

		            if (typeof SVGRect != undefined) {
		                var xhr = new XMLHttpRequest();
		                xhr.open('GET', 'svg/soil.svg', true);
		                xhr.send();
		                xhr.onload = function(e) {
		                	svgSoil.innerHTML = xhr.responseText;

		                	//$('#svgSoil').width($('#soil-Settings div').clientWidth);
		                	document.getElementById('soil-moss').onclick = function() {
								var moss_color = $('#soil-moss-badge')[0].firstElementChild.attributes.fill.value;
								document.getElementById('soil-type-color').style.fill = moss_color;
						        document.getElementById('soil-text').style.fill = moss_color;
						        document.getElementById('soil-type-text').textContent = soil_type_labels[0];
						        saveSetting(19, 0, function() { modal.hide(); });
						    }
						    document.getElementById('soil-loam').onclick = function() {
						    	var loam_color = $('#soil-loam-badge')[0].firstElementChild.attributes.fill.value;
								document.getElementById('soil-type-color').style.fill = loam_color;
						        document.getElementById('soil-text').style.fill = loam_color; //
						        document.getElementById('soil-type-text').textContent = soil_type_labels[1];
						        saveSetting(19, 1, function() { modal.hide(); });
						    }
						    document.getElementById('soil-dirt').onclick = function() {
								var dirt_color = $('#soil-dirt-badge')[0].firstElementChild.attributes.fill.value;
								document.getElementById('soil-type-color').style.fill = dirt_color;
						        document.getElementById('soil-text').style.fill = dirt_color;
						        document.getElementById('soil-type-text').textContent = soil_type_labels[2];
						        saveSetting(19, 2, function() { modal.hide(); });
						    }
						    document.getElementById('soil-clay').onclick = function() {
						    	var clay_color = $('#soil-clay-badge')[0].firstElementChild.attributes.fill.value;
						    	document.getElementById('soil-type-color').style.fill = clay_color;
						        document.getElementById('soil-text').style.fill = clay_color;
						        document.getElementById('soil-type-text').textContent = soil_type_labels[3];
						        saveSetting(19, 3, function() { modal.hide(); });
						    }
						    document.getElementById('soil-sand').onclick = function() {
						    	var sand_color = $('#soil-sand-badge')[0].firstElementChild.attributes.fill.value;
						    	document.getElementById('soil-type-color').style.fill = sand_color;
						        document.getElementById('soil-text').style.fill = sand_color;
						        document.getElementById('soil-type-text').textContent = soil_type_labels[4];
						        saveSetting(19, 4, function() { modal.hide(); });
						    }
						    document.getElementById('soil-rock').onclick = function() {
						    	var rock_color = $('#soil-rock-badge')[0].firstElementChild.attributes.fill.value;
						    	document.getElementById('soil-type-color').style.fill = rock_color;
						        document.getElementById('soil-text').style.fill = rock_color;
						        document.getElementById('soil-type-text').textContent = soil_type_labels[5];
						        saveSetting(19, 5, function() { modal.hide(); });
						    }
		                }
		            }
		        }
		        
		        document.getElementById('wireless').onclick = function() {
		        	var modal = new bootstrap.Modal(document.getElementById('wirelessSettings'));
		            modal.show();

		            var nvram = new XMLHttpRequest();
		            nvram.responseType = 'json';
		            //nvram.overrideMimeType('application/json');
		            nvram.open('GET', 'nvram', true);
		            nvram.send();
		            nvram.onload = function(e) {
		                try {
		                    var data = nvram.response; //nvram.responseText;
		                    document.getElementById('sdkVersion').textContent = 'Bootloader Version: ' + data['nvram'][0].split('|')[0];
		                    document.getElementById('firmwareVersion').textContent = 'Firmware Version: ' + data['nvram'][0].split('|')[1];
		                    if(data['nvram'][1] == '0') {
		                        $('#WiFiModeAP').prop('checked', true);
		                       	document.getElementById('AlertInfo').classList.add('d-none');
		                    }else if(data['nvram'][1] == '1') {
		                        $('#WiFiModeClient').prop('checked', true);
		                        document.getElementById('AlertInfo').classList.remove('d-none');
		                    }else if(data['nvram'][1] == '2') {
		                        $('#WiFiModeClientEnt').prop('checked', true);
		                        document.getElementById('AlertInfo').classList.remove('d-none');
		                        document.getElementById('WiFiUsername').removeAttribute('disabled');
		                    }
		                    var bool_value = data['nvram'][2] == '1' ? true : false;
		                    $('#WiFiHidden').val(data['nvram'][2]);
		                    $('#WiFiHiddenCheckbox').prop('checked', bool_value);
		                    $("#WiFiPhyMode").val(data["nvram"][3]);
		                    $("#WiFiPower").val(data["nvram"][4]);
		                    $('#WiFiChannel').val(data['nvram'][5]);
		                    $('#WiFiSSID').val(data['nvram'][6]);
		                    $('#WiFiUsername').val(data['nvram'][7]);
		                    bool_value = data['nvram'][9] == '1' ? true : false;
		                    $('#EnableLOG').val(data['nvram'][9]);
		                    $('#EnableLOGCheckbox').prop('checked', bool_value);
		                    $('#EnableLOGInterval').val(data['nvram'][10]);
		                    bool_value = data['nvram'][11] == '1' ? true : false;
		                    $('#WiFiDHCP').val(data['nvram'][11]);
		                    $('#WiFiDHCPCheckbox').prop('checked', bool_value);
		                    if(bool_value == true) {
		                        $('#WiFiIP').prop('disabled', false);
		                        $('#WiFiSubnet').prop('disabled', false);
		                        $('#WiFiGateway').prop('disabled', false);
		                        $('#WiFiDNS').prop('disabled', false);
		                    }
		                    $('#WiFiIP').val(data['nvram'][12]);
		                    $('#WiFiSubnet').val(data['nvram'][13]);
		                    $('#WiFiGateway').val(data['nvram'][14]);
		                    $('#WiFiDNS').val(data['nvram'][15]);

		                    bool_value = data['nvram'][23] == '1' ? true : false;
		                    $('#AlertLowPower').val(data['nvram'][23]);
		                    $('#AlertLowPowerCheckbox').prop('checked', bool_value);
		                    bool_value = data['nvram'][24] == '1' ? true : false;
		                    $('#AlertWater').val(data['nvram'][24]);
		                    $('#AlertWaterCheckbox').prop('checked', bool_value);
		                    bool_value = data['nvram'][25] == '1' ? true : false;
		                    $('#AlertEmpty').val(data['nvram'][25]);
		                    $('#AlertEmptyCheckbox').prop('checked', bool_value);

		                    $('#AlertEmail').val(data['nvram'][26]);
		                    $('#AlertPlantName').val(data['nvram'][27]);

		                    bool_value = data['nvram'][28] == '1' ? true : false;
		                    $('#AlertSMTPTLS').val(data['nvram'][28]);
		                    $('#AlertSMTPTLSCheckbox').prop('checked', bool_value);

		                    $('#AlertSMTPServer').val(data['nvram'][29]);
		                    $('#AlertSMTPUsername').val(data['nvram'][30]);

					        $('#EnableLOGInterval').on('input', function() {
				                var v = parseInt(this.value);
				                if(v < 10) {
				                    notify('','Log Interval ' + v + ' is low, Flash may fill up fast!', 'warning');
				                }
				            });

					        document.getElementById('wireless-settings-ok').onclick = function() {
				                if($('#EnableLOGCheckbox').prop('checked') == true) {
				                	var loginterval = $('#EnableLOGInterval').val();
				                	//console.log(loginterval  + " < " + data['nvram'][21]);
					            	if(loginterval > 0 && loginterval < data['nvram'][21]) {
					            		
									    saveSetting(20, loginterval);
										notify('','Deep Sleep is longer than Graph Interval', 'danger');
										notify('','Adjusting Deep Sleep ...', 'success');
					            	}
					            }
				                document.getElementById('wirelessSettingsForm').submit();
				            };

				            document.getElementById('alert-settings-ok').onclick = function() {
				                document.getElementById('alertSettingsForm').submit();
				            };

		                }catch{}
		            }

		            $('#fileLittleFS').change(function() {
		                $('#formLittleFS').attr('action', 'http://' + window.location.hostname + "/update"); //force HTTP
		                progressTimer(80, 1);
		                document.getElementById('formLittleFS').submit();
		            })

		            $('#fileFirmware').change(function() {
		                $('#formFirmware').attr('action', 'http://' + window.location.hostname + "/update"); //force HTTP
		                progressTimer(20, 1);
		                document.getElementById('formFirmware').submit();
		            })

		            $('#browseLittleFS').click(function() {
		                $('#fileLittleFS').trigger('click');
		            })

		            $('#browseFirmware').click(function(){
		                $('#fileFirmware').trigger('click');
		            })
		        }
		    }

	    } else {  // No SVG
	    	notify('','The browser does not support SVG graphics', 'danger');
	    }
    }
};

function saveSetting(offset, value, callback) {

    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'nvram?offset=' + offset + '&value=' + value, true);
    xhr.send();
    xhr.onloadend = function(e) {
    	if(callback) callback(e);
    }
    //notify('',request.responseText, 'danger');
};

function HiddenInput(id, value) {
    if(value == true) {
        document.getElementById(id).removeAttribute('disabled');
    }else{
       document.getElementById(id).setAttribute('disabled', 'disabled');
    }
};

function HiddenCheck(id, element) {
    console.log(id);

    if(element.checked) {
        document.getElementById(id).value = 1;
    }else{
        document.getElementById(id).value = 0;
    }

    if(id == 'WiFiHidden') {
    	if(element.checked) {
    		saveSetting(2, 1);
    		notify('','WiFi SSID is now Hidden', 'danger');
    	}else{
        	saveSetting(2, 0);
        	notify('','WiFi SSID is now Broadcasting', 'success');
    	}
	}else if(id == 'EnableLOG') {
    	if(element.checked) {
    		saveSetting(9, 1);
    		notify('','Graph & Log Collection is ON', 'info');
    	}else{
        	saveSetting(9, 0);
        	notify('','Graph & Log Collection is OFF', 'success');
    	}
    }else if(id == 'WiFiDHCP') {
        var b = false;

        if(element.checked){
            var wifi_mode = document.getElementsByName('WiFiMode');
            console.log(wifi_mode[0].checked);
            if(wifi_mode[0].checked) {
                notify('','DHCP works only in WiFi Client mode', 'warning');
            }
            b = true;
        }
        document.getElementById('WiFiIP').setAttribute('disabled', b);
        document.getElementById('WiFiSubnet').setAttribute('disabled', b);
        document.getElementById('WiFiGateway').setAttribute('disabled', b);
        document.getElementById('WiFiDNS').setAttribute('disabled', b);
    }
};

function NVRAMtoSVG(data)
{
    if(data['nvram'][9] == '1') {
        $('#graph-enabled').show();
    }else{
        $('#graph-enabled').hide();
    }
    if(data['nvram'][21] == '1') {
        $('#led-enabled').show();
    }else{
        $('#led-enabled').hide();
    }
    if (data['nvram'][18] == '0') {
        $('#timer-enabled').hide();
        $('#timer-disabled').show();
    }else{
        $('#timer-disabled').hide();
        $('#timer-enabled').show();
    }
    
    document.getElementById('pot-size-text').textContent = data['nvram'][16];
    document.getElementById('moisture-text').textContent = data['nvram'][17];
    document.getElementById('timer-text').textContent = data['nvram'][18];
    document.getElementById('power-text').textContent = data['nvram'][22];
    document.getElementById('soil-type-color').style.fill = soil_type_color[data['nvram'][19]];
    document.getElementById('soil-text').style.fill = soil_type_color[data['nvram'][19]];
    document.getElementById('soil-type-text').textContent = soil_type_labels[data['nvram'][19]];
};

function formValidate() {
    WiFiPasswordConfirm.setCustomValidity(WiFiPasswordConfirm.value != WiFiPassword.value ? 'Passwords do not match.' : '');
};

function notify(messageHeader, messageBody, bg, id) {

    var toast = document.createElement('div');
    toast.className = 'toast fade show text-white bg-' + bg;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');

    if (messageHeader != '') {
    	var toastHeader = document.createElement('div');
        toastHeader.className = 'toast-header text-white bg-' + bg;
        toastHeader.textContent = messageHeader;
        
        var btnClose = document.createElement('button');
        btnClose.className = 'btn-close';
        btnClose.setAttribute('data-bs-dismiss', 'toast');
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

   	var toastNotify = new bootstrap.Toast(toast, {delay: 5000});
   	toastNotify.show();

	toast.addEventListener('hidden.bs.toast', function () {
	  document.getElementById('notify').removeChild(this);
	})
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
};

function testPump()
{
	var xhr = new XMLHttpRequest();
	xhr.open('GET', 'pump', true);
    xhr.send();
    xhr.onload = function() {
        if (xhr.status == 200) {
            notify('', 'Running Pump ...', 'warning');
            progressTimer(32,0,function() {
				//Check data log to confirm
				var log = new XMLHttpRequest();
				log.open('GET', 'data.log', true);
			    log.send();
			    log.onload = function() {
			        if (log.status == 200) {
			        	var s = log.responseText.split('\n');
			        	if (s[s.length-2].indexOf('M:') != -1)
			        	{
			        		notify('', 'Pump OK', 'success');
			        	}
			        }
			    };
			});
        }else{
        	notify('', 'Pump Test Failed', 'danger');
        }
    };
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

function progressTimer(speed, bar, callback) {

	timerUploadCounter = 0;

    var timer = setInterval(function() {
    	timerUploadCounter++;
    	if(timerUploadCounter == 100) {
	        clearInterval(timer);
	        if(callback) callback(timerUploadCounter);
	    }
	    document.getElementsByClassName('progress-bar')[bar].style.width = timerUploadCounter + '%';
    }, speed);
};
