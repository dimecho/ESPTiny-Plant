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

//ESP8266 EEPROM Variables
var WIFI_MODE = 1;
var WIFI_HIDE = 2;
var WIFI_PHY_MODE = 3;
var WIFI_PHY_POWER = 4;
var WIFI_CHANNEL = 5;
var WIFI_SSID = 6;
var WIFI_USERNAME = 7;
var WIFI_PASSWORD = 8;
var DATA_LOG = 9;
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

document.addEventListener('DOMContentLoaded', function(event)
{
	loadTheme();

	if(document.cookie != "")
	{
		var ArrayCookies = {};
		try {
			ArrayCookies = document.cookie.split(";");
			for (i = 0; i < ArrayCookies.length; i++) {
		        var c_name = ArrayCookies[i].substr(0, ArrayCookies[i].indexOf("="));
		        var c_value = ArrayCookies[i].substr(ArrayCookies[i].indexOf("=") + 1);
		        c_name = c_name.replace(/^\s+|\s+$/g, "");

		        //console.log(c_name + '(' + eval(c_name) + ') = ' + unescape(c_value));
		        saveSetting(eval(c_name), unescape(c_value));
		    }
	   	}catch(error){
	    	notify('',error, 'danger');
	    }finally{
	    	if(ArrayCookies.length > 1)
	    	{
	    		document.getElementById('keep-eeprom-text').textContent="Restoring settings ...";
				document.querySelectorAll("#keep-EEPROM .modal-footer")[0].style.display = "none";
				var modal = new bootstrap.Modal(document.getElementById('keep-EEPROM'));
				modal.show();
			  	progressTimer(62,2,function() {
		        	$('.modal').modal('hide');
		        	notify('','EEPROM restored', 'success');
		        	setTimeout(function() {
				   		notify('','Passwords must be set again', 'warning');
				    }, 4000);
				});
			}
		}
	    deleteCookies();
	}

    loadSVG();
	
	updateNTP();

    document.getElementById('wireless-settings-ok').onclick = function() {
		if(DEMOLOCK) {
			PlantLogin();
		}else{
	        if($('#EnableLogCheckbox').prop('checked') == true) {
	        	var loginterval = $('#EnableLogInterval').val();
	        	var deepsleep = $('#power-Slider').data('roundSlider').getValue();

	        	//console.log(loginterval  + " < " + deepsleep);
	        	if(loginterval < (deepsleep * 60)) {
				    saveSetting(DEEP_SLEEP, 1); //in minutes
					notify('','Deep Sleep is longer than Log Interval', 'danger');
					notify('', 'Wireless Always On', 'success');
	        	}
	        }
	        document.getElementById('wireless-SettingsForm').submit();
		}
	};

	document.getElementById('alert-settings-ok').onclick = function() {
		if(DEMOLOCK) {
			PlantLogin();
		}else{
			AlertSet([0, 0, 0, 0, 0, 0, 0, 0]);
	    	document.getElementById('alert-SettingsForm').submit();
		}
	};

	document.getElementById('demo-settings-ok').onclick = function() {
		if(DEMOLOCK) {
			PlantLogin();
		}else{
			AvailabilityWeek([0, 0, 0, 0, 0, 0, 0]);
	    	document.getElementById('demo-SettingsForm').submit();
		}
	};
});

function updateNTP() {
	var d = new Date();
	var ntp = new XMLHttpRequest();
	ntp.open('GET', 'api?week=' + d.getDay() + '&hour=' + d.getHours() + '&minute=' + d.getMinutes() + '&ntp=1', true);
	ntp.send();
};

function loadSVG(svgfile) {

	var nvram = new XMLHttpRequest();
    nvram.responseType = 'json';
    //nvram.overrideMimeType('application/json');
    nvram.open('GET', 'nvram.json', true);
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
					svgfile = 'bonsai.svg';
					if(index.response != undefined) {
						try {
							var list = document.getElementById('listLayout');
							var s = index.responseText.split('\n').forEach(function (item) {
								//console.log(item);
								var listdiv = document.createElement('div');
								listdiv.classList.add('form-check');
							    var listlabel = document.createElement('label');
							    listlabel.classList.add('form-check-label');
							    listlabel.textContent = item;
								var listcheckbox = document.createElement('input');
								listcheckbox.setAttribute('type', 'checkbox');
								listcheckbox.classList.add('form-check-input');
								listdiv.appendChild(listcheckbox);
								listdiv.appendChild(listlabel);
								list.appendChild(listdiv);
							});
							svgfile = s[nvram.response['nvram'][PLANT_TYPE]]; //match index # to file name
						}catch{}
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
			            adc.open('GET', 'api?adc=1', true);
			            adc.send();
			            adc.onloadend = function() {
						    if(adc.status == 200) {
						    	var a = parseInt(adc.responseText);
						    	if(a > 1010 && a < 1024)
			                    {
			                        notify('', 'Detecting Excess Moisture!', 'danger');
			                        if(nvram.response['nvram'][17] > 20) {
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

			                    var ts = new XMLHttpRequest();
					            ts.open('GET', 'api?temp=1', true);
					            ts.send();
					            ts.onloadend = function() {
								    if(adc.status == 200) {
								    	var t = parseInt(ts.responseText);
								    	if(t > 0) {
					                    	document.getElementById('moisture-adc').textContent = document.getElementById('moisture-adc').textContent + ' (' + t + '°C)';
					                    }else if(t < 4) {
					                        notify('', 'Water Freeze Warning', 'danger');
					                    }
									}
								}
							}
						}
						document.getElementById('water-text').textContent = '';
						var pnp_adc = nvram.response['nvram'][PNP_ADC] + '000';
						if(pnp_adc.charAt(2) == '1') {
							document.getElementById('water').setAttribute('style', 'visibility:visible');
	                    	var water = new XMLHttpRequest();
				            water.open('GET', 'api?adc=2', true);
				            water.send();
				            water.onloadend = function() {
							    if(water.status == 200) {
							    	var a = parseInt(water.responseText);
							    	if(!isNaN(a) && a > 0) {
							    		document.getElementById('water-text').textContent = water.responseText + '%';
							    	}else{
							    		document.getElementById('water-text').textContent = 'Empty';
							    		document.getElementById('water-level').style.visibility = 'hidden';
							    		document.getElementById('water-shadow').style.visibility = 'hidden';
										document.getElementById('water-reflection').setAttribute('transform', 'matrix(1 0 0 1 0 -1500)');
							    	}
								}
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
											if (htmlDoc.getElementById('timeline') !== null)
											{
												htmlDoc.getElementById('timeline').remove();

												var div = htmlDoc.getElementsByTagName('svg')[0];
												div.id = s[i];
												div.className = 'row w-50';
												div.onclick = function() {
													var id = this.id;
													console.log(i);
													saveSetting(PLANT_TYPE, i, function() { loadSVG(id); modal.hide(); });
									            }
							                	svgPlant.appendChild(div);
							                }
						                }
					                })(i);
		                        }
						    }
					    }

		    			document.getElementById('demo-lock-ok').onclick = function() {
			                document.getElementById('demo-LockForm').submit();
			            }

			            document.getElementById('graph').onclick = function() {
			                window.location.href = 'graph.html';
			            }
			            if(document.getElementById('led')){
				            document.getElementById('led').onclick = function() {
				                var x = document.getElementById('led-enabled');
							  	if (x.style.display === 'block') {
							  		x.style.display = 'none';
							   		//saveSetting(PLANT_LED, 0);
							   		saveSetting('8&alert=0',0);
							  	} else {
							   		x.style.display = 'block';
							   		//saveSetting(PLANT_LED, 1);
							   		saveSetting('8&alert=1',1);
							    	//document.getElementById('power-text').textContent = 8;
							  	}
				            }
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
				                    saveSetting(PLANT_POT_SIZE, args.value);
				                }
				            })
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
				                    saveSetting(PLANT_SOIL_MOISTURE, args.value);
				                }
				            });
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

				                    saveSetting(PLANT_MANUAL_TIMER, args.value, function(lock) {
				                    	if (lock != 'Locked') {
				                    		if (args.value == 0) {
						                        $('#timer-enabled').hide();
						                        $('#timer-disabled').show();
						                        document.getElementById('power-text').textContent = 4;
						                        if($('#EnableLogCheckbox').prop('checked') == false)
						                        	saveSetting(DEEP_SLEEP, 4);
						                    }else{
						                        $('#timer-disabled').hide();
						                        $('#timer-enabled').show();
						                        document.getElementById('power-text').textContent = 30;
						                        if($('#EnableLogCheckbox').prop('checked') == false)
						                        	saveSetting(DEEP_SLEEP, 30);
						                        notify('', 'Timer disables Soil Sensor', 'danger');
						                        if(args.value < 8) //less than 8 hours
						                        	notify('', 'Timer is Low! No Overwater protection', 'warning');
						                        notify('', 'Enable when issues with Sensor', 'info');
						                    }
					                    }
					                });
				                }
				            });
				            //$('#timer-enabled').toggle('slow');
				            //$('#timer-disabled').toggle('slow');
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
				                min: 0,
				                max: 30,
				                //step: 1,
				                change: function (args) {
				                	if(args.value == 0) {
				                		notify('', 'Sleep Disabled!', 'danger');
				                		notify('', 'Wireless Always On', 'success');
				                		//notify('', 'Battery Will Discharge Quickly!', 'warning');
				                	}else if(args.value < 5) {
				                		notify('', 'Low Sleep = High Power Consumption!', 'warning');
				                		notify('', 'Sleep > 5 Minutes Recommended', 'success');
				                	}
				                    document.getElementById('power-text').textContent = args.value;
				                    if(args.value == 0) {
				                    	saveSetting(DEEP_SLEEP, 1);
				                    }else{
				                    	saveSetting(DEEP_SLEEP, args.value);
				                    }
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
								        document.getElementById('soil-type-text').textContent = soil_type_labels[0];
								        if(document.getElementById('soil-text'))
								        	document.getElementById('soil-text').style.fill = moss_color;
								        saveSetting(PLANT_SOIL_TYPE, 0, function() { modal.hide(); });
								    }
								    document.getElementById('soil-loam').onclick = function() {
								    	var loam_color = $('#soil-loam-badge')[0].firstElementChild.attributes.fill.value;
										document.getElementById('soil-type-color').style.fill = loam_color;
								        document.getElementById('soil-type-text').textContent = soil_type_labels[1];
								        if(document.getElementById('soil-text'))
								        	document.getElementById('soil-text').style.fill = loam_color;
								        saveSetting(PLANT_SOIL_TYPE, 1, function() { modal.hide(); });
								    }
								    document.getElementById('soil-dirt').onclick = function() {
										var dirt_color = $('#soil-dirt-badge')[0].firstElementChild.attributes.fill.value;
										document.getElementById('soil-type-color').style.fill = dirt_color;
								        document.getElementById('soil-type-text').textContent = soil_type_labels[2];
								        if(document.getElementById('soil-text'))
								        	document.getElementById('soil-text').style.fill = dirt_color;
								        saveSetting(PLANT_SOIL_TYPE, 2, function() { modal.hide(); });
								    }
								    document.getElementById('soil-clay').onclick = function() {
								    	var clay_color = $('#soil-clay-badge')[0].firstElementChild.attributes.fill.value;
								    	document.getElementById('soil-type-color').style.fill = clay_color;
								        document.getElementById('soil-type-text').textContent = soil_type_labels[3];
								        if(document.getElementById('soil-text'))
								        	document.getElementById('soil-text').style.fill = clay_color;
								        saveSetting(PLANT_SOIL_TYPE, 3, function() { modal.hide(); });
								    }
								    document.getElementById('soil-sand').onclick = function() {
								    	var sand_color = $('#soil-sand-badge')[0].firstElementChild.attributes.fill.value;
								    	document.getElementById('soil-type-color').style.fill = sand_color;
								        document.getElementById('soil-type-text').textContent = soil_type_labels[4];
								        if(document.getElementById('soil-text'))
								        	document.getElementById('soil-text').style.fill = sand_color;
								        saveSetting(PLANT_SOIL_TYPE, 4, function() { modal.hide(); });
								    }
								    document.getElementById('soil-rock').onclick = function() {
								    	var rock_color = $('#soil-rock-badge')[0].firstElementChild.attributes.fill.value;
								    	document.getElementById('soil-type-color').style.fill = rock_color;
								        document.getElementById('soil-type-text').textContent = soil_type_labels[5];
								        if(document.getElementById('soil-text'))
								        	document.getElementById('soil-text').style.fill = rock_color;
								        saveSetting(PLANT_SOIL_TYPE, 5, function() { modal.hide(); });
								    }
				                }
				            }
				        }
				        
				        document.getElementById('wireless').onclick = function() {
				        	var modal = new bootstrap.Modal(document.getElementById('wireless-Settings'));
				            modal.show();

				            var nvram = new XMLHttpRequest();
				            nvram.responseType = 'json';
				            //nvram.overrideMimeType('application/json');
				            nvram.open('GET', 'nvram.json', true);
				            nvram.send();
				            nvram.onload = function(e) {
				                try {
				                	var data = nvram.response; //nvram.responseText;
				                    var v = data["nvram"][0].split('|');
				                    document.getElementById('coreVersion').textContent = 'Core Version: ' + v[0];
				                    document.getElementById('sdkVersion').textContent = 'SDK Version: ' + v[1];
				                    document.getElementById('fsVersion').textContent = 'LittleFS Version: ' + (0xffff & (v[2] >> 16)) + "." + (0xffff & (v[2] >> 0)) + "." + (0xffff & (v[2] >> 20));
				                    document.getElementById('firmwareVersion').textContent = 'Firmware Version: ' + v[3];
				                    document.getElementById('iram').textContent = 'IRAM: ' + Math.round(v[4]/1024) + ' KB (' + v[4] + ')';
									document.getElementById('dram').textContent = 'DRAM: ' + Math.round(v[5]/1024) + ' KB (' + v[5] + ')';

				                    var bool_value = data['nvram'][WIFI_HIDE] == '1' ? true : false;
				                    $('#WiFiHidden').val(data['nvram'][WIFI_HIDE]);
				                    $('#WiFiHiddenCheckbox').prop('checked', bool_value);
				                    $("#WiFiPhyMode").val(data["nvram"][WIFI_PHY_MODE]);
				                    if(data["nvram"][WIFI_PHY_MODE] == 3) {
				                    	var optionObject = document.getElementById('WiFiPower').options;
				                    	optionObject[17].setAttribute('hidden','true');
				                    	optionObject[18].setAttribute('hidden','true');
				                    	optionObject[19].setAttribute('hidden','true');
				                    	optionObject[20].setAttribute('hidden','true');
				                    }
				                    $("#WiFiPower").val(data["nvram"][WIFI_PHY_POWER]);
				                    $('#WiFiChannel').val(data['nvram'][WIFI_CHANNEL]);
				                    $('#WiFiSSID').val(data['nvram'][WIFI_SSID]);
				                    $('#WiFiUsername').val(data['nvram'][WIFI_USERNAME]);
				                    bool_value = data['nvram'][DATA_LOG] == '1' ? true : false;
				                    $('#EnableLog').val(data['nvram'][DATA_LOG]);
				                    $('#EnableLogCheckbox').prop('checked', bool_value);
				                    $('#EnableLogInterval').val(data['nvram'][LOG_INTERVAL]);

				                    var pnp_adc = data['nvram'][PNP_ADC] + '000';

				                    $('#EnablePNP').val(pnp_adc.charAt(0));
				                    $('#ADCSensitivity').val(pnp_adc.charAt(1));
				                    bool_value = pnp_adc.charAt(2) == '1' ? true : false;
				                    $('#WaterLevel').val(pnp_adc.charAt(2));
				                    $('#WaterLevelCheckbox').prop('checked', bool_value);
				                    var rangeslider_parameters = {
								        skin: 'big',
								        grid: true,
								        step: 1,
								        min: 1,
								        max: 600,
								        from: data['nvram'][LOG_INTERVAL],
								        postfix: ' Seconds'
								    };
								    var pnpslider_parameters = {
								        skin: 'big',
								        grid: false,
								        step: 1,
								        min: 0,
								        max: 1,
								        from: pnp_adc.charAt(0),
								        values: ["NPN", "PNP"]
								    };
								    var adcslider_parameters = {
								        skin: 'big',
								        grid: true,
								        step: 1,
								        min: 0,
								        max: 9,
								        from: pnp_adc.charAt(1)
								    };
				                    if (typeof ionRangeSlider !== "function") {
				                    	var stylesheet = document.createElement('link');
				                    	stylesheet.rel = 'stylesheet';
										stylesheet.href = 'css/rangeslider.css';
				                    	document.head.appendChild(stylesheet);

									    var script = document.createElement('script');
										script.onload = function() {
											$('#EnableLogInterval').ionRangeSlider(rangeslider_parameters);
											$('#EnablePNP').ionRangeSlider(pnpslider_parameters);
											$('#ADCSensitivity').ionRangeSlider(adcslider_parameters);
										};
										script.src = 'js/rangeslider.js';
										document.head.appendChild(script);
									}else{
										$('#EnableLogInterval').ionRangeSlider(rangeslider_parameters);
										$('#EnablePNP').ionRangeSlider(pnpslider_parameters);
										$('#ADCSensitivity').ionRangeSlider(adcslider_parameters);
									}

				                    bool_value = data['nvram'][NETWORK_DHCP] == '1' ? true : false;
				                    $('#WiFiDHCP').val(data['nvram'][NETWORK_DHCP]);
				                    $('#WiFiDHCPCheckbox').prop('checked', bool_value);
				                    //if(bool_value == true) {
				                        $('#WiFiIP').prop('disabled', bool_value);
				                        $('#WiFiSubnet').prop('disabled', bool_value);
				                        $('#WiFiGateway').prop('disabled', bool_value);
				                        $('#WiFiDNS').prop('disabled', bool_value);
				                    //}
				                    $('#WiFiIP').val(data['nvram'][NETWORK_IP]);
				                    $('#WiFiSubnet').val(data['nvram'][NETWORK_SUBNET]);
				                    $('#WiFiGateway').val(data['nvram'][NETWORK_GATEWAY]);
				                    $('#WiFiDNS').val(data['nvram'][NETWORK_DNS]);

				                    document.getElementsByName('WiFiMode')[data['nvram'][WIFI_MODE]].checked = true;
				                    SetWiFiMode();

				                    $('#AlertEmail').val(data['nvram'][EMAIL_ALERT]);
				                    $('#AlertSMTPUsername').val(data['nvram'][SMTP_USERNAME]);
				                    var smtp = data['nvram'][SMTP_SERVER];
				                    if(smtp != '') {
				                    	$('#AlertSMTPServer').val(smtp);
					                    if(smtp.indexOf(':') == -1) {
										    notify('', 'No Email Encryption', 'danger');
										    notify('', smtp + ':587', 'warning');
										}
									}
									$('#AlertPlantName').val(data['nvram'][PLANT_NAME]);
				                    $("#Timezone").val(data["nvram"][TIMEZONE_OFFSET]);

							        $('#EnableLogInterval').on('input', function() {
						                var v = parseInt(this.value);
						                if(v < 10) {
						                    notify('','Log Interval ' + v + ' is low, Flash may fill up fast!', 'warning');
						                }
						            });
						            $('#EnablePNP').on('input', function() {
						                if(this.value == 'PNP') {
						                    notify('','PNP Transistor! Controled with LOW (Negative)', 'danger');
						                    notify('','If you get this WRONG, Pump will run Non-Stop!', 'warning');
						                    saveSetting(PNP_ADC, '1' + document.getElementById('ADCSensitivity').value + document.getElementById('WaterLevel').value);
						                }else{
						                	saveSetting(PNP_ADC, '0' + document.getElementById('ADCSensitivity').value + document.getElementById('WaterLevel').value);
						                }
						            });
						            $('#ADCSensitivity').on('input', function() {
						                if(document.getElementById('EnablePNP').value == 'PNP') {
						                    saveSetting(PNP_ADC, '1' + this.value + document.getElementById('WaterLevel').value);
						                }else{
						                	saveSetting(PNP_ADC, '0' + this.value + document.getElementById('WaterLevel').value);
						                }
						            });
						            $('#fileLayout').change(function() {
						            	if(DEMOLOCK) {
											PlantLogin();
										}else{
							                document.getElementById('formLayout').submit();
							            }
						            });
						            $('#fileLittleFS').change(function() {
						            	if(DEMOLOCK) {
											PlantLogin();
										}else{
							                $('#formLittleFS').attr('action', 'http://' + window.location.hostname + "/update"); //force HTTP
							                progressTimer(80, 1);
							                document.getElementById('formLittleFS').submit();
							            }
						            });
						            $('#fileFirmware').change(function() {
						            	if(DEMOLOCK) {
											PlantLogin();
										}else{
											$('#formFirmware').attr('action', 'http://' + window.location.hostname + "/update"); //force HTTP
											document.getElementById('keep-eeprom-text').textContent="After firmware upgrade, keep current settings?";
											document.querySelectorAll("#keep-EEPROM .modal-footer")[0].style.display = "";
											$('.modal').modal('hide');
											var modal = new bootstrap.Modal(document.getElementById('keep-EEPROM'));
											modal.show();
											document.getElementById('keep-eeprom-yes').onclick = function() {
												deleteCookies();
												//document.cookie = 'WIFI_MODE=' + data['nvram'][WIFI_MODE];
												document.cookie = 'WIFI_HIDE=' + data['nvram'][WIFI_HIDE];
												document.cookie = 'WIFI_PHY_MODE=' + data['nvram'][WIFI_PHY_MODE];
												document.cookie = 'WIFI_PHY_POWER=' + data['nvram'][WIFI_PHY_POWER];
												document.cookie = 'WIFI_CHANNEL=' + data['nvram'][WIFI_CHANNEL];
												document.cookie = 'WIFI_SSID=' + data['nvram'][WIFI_SSID];
												document.cookie = 'WIFI_USERNAME=' + data['nvram'][WIFI_USERNAME];
												//document.cookie = 'WIFI_PASSWORD=' + data['nvram'][WIFI_PASSWORD];
												document.cookie = 'DATA_LOG=' + data['nvram'][DATA_LOG];
												document.cookie = 'LOG_INTERVAL=' + data['nvram'][LOG_INTERVAL];
												document.cookie = 'NETWORK_DHCP=' + data['nvram'][NETWORK_DHCP];
												document.cookie = 'NETWORK_IP=' + data['nvram'][NETWORK_IP];
												document.cookie = 'NETWORK_SUBNET=' + data['nvram'][NETWORK_SUBNET];
												document.cookie = 'NETWORK_GATEWAY=' + data['nvram'][NETWORK_GATEWAY];
												document.cookie = 'NETWORK_DNS=' + data['nvram'][NETWORK_DNS];
												document.cookie = 'PLANT_POT_SIZE=' + data['nvram'][PLANT_POT_SIZE];
												document.cookie = 'PLANT_SOIL_MOISTURE=' + data['nvram'][PLANT_SOIL_MOISTURE];
												document.cookie = 'PLANT_MANUAL_TIMER=' + data['nvram'][PLANT_MANUAL_TIMER];
												document.cookie = 'PLANT_SOIL_TYPE=' + data['nvram'][PLANT_SOIL_TYPE];
												document.cookie = 'DEEP_SLEEP=' + data['nvram'][NETWORK_DNS];
												document.cookie = 'EMAIL_ALERT=' + data['nvram'][EMAIL_ALERT];
												document.cookie = 'SMTP_SERVER=' + data['nvram'][SMTP_SERVER];
												document.cookie = 'SMTP_USERNAME=' + data['nvram'][SMTP_USERNAME];
												document.cookie = 'PLANT_NAME=' + data['nvram'][PLANT_NAME];
												document.cookie = 'ALERTS=' + data['nvram'][ALERTS];
												document.cookie = 'TIMEZONE_OFFSET=' + data['nvram'][TIMEZONE_OFFSET];
												document.cookie = 'DEMO_AVAILABILITY=' + data['nvram'][DEMO_AVAILABILITY];
												document.cookie = 'PNP_ADC=' + data['nvram'][PNP_ADC];
					                			progressTimer(20, 2);
							                	document.getElementById('formFirmware').submit();
					            			}
					            			document.getElementById('keep-eeprom-no').onclick = function() {
					            				deleteCookies();
					            				if(data['nvram'][PNP_ADC] != 0) {
					            					document.cookie = 'PNP_ADC=' + data['nvram'][PNP_ADC];
					            				}
					            				new bootstrap.Modal(document.getElementById('wireless-Settings')).show();
					                			progressTimer(20, 1);
							                	document.getElementById('formFirmware').submit();
					            			}
							            }
						            });

						            $('#Availability-Slider').roundSlider({
						                //svgMode: true,
						                radius: 100,
						                width: 16,
						                handleSize: '34,10',
						                sliderType: 'range',
									    value: data['nvram'][DEMO_AVAILABILITY].substring(7,9) + ',' + data['nvram'][DEMO_AVAILABILITY].substring(9,11),
						                min: 0,
						                max: 24,
						                startAngle: 90,
						                tooltipFormat: function (e) {
										    var val = e.value, content;
										    if (val < 12) content = val + ' am';
										    else if (val == 12) content = '12 pm';
										    else if (val > 12) content = (val - 12) + 'pm';
										    else if (val == 24) content = '12 am';
										    return  '<b>' + content + '</b>';
										}
						            });
						            AvailabilityWeek([data['nvram'][DEMO_AVAILABILITY].charAt(0), data['nvram'][DEMO_AVAILABILITY].charAt(1), data['nvram'][DEMO_AVAILABILITY].charAt(2), data['nvram'][DEMO_AVAILABILITY].charAt(3), data['nvram'][DEMO_AVAILABILITY].charAt(4), data['nvram'][DEMO_AVAILABILITY].charAt(5), data['nvram'][DEMO_AVAILABILITY].charAt(6)]);

				                } catch (error) {}
				            }

				            $('#browseLittleFS').click(function() {
				            	if(DEMOLOCK) {
									PlantLogin();
								}else{
				                	$('#fileLittleFS').trigger('click');
				            	}
				            });
				            $('#browseFirmware').click(function(){
				            	if(DEMOLOCK) {
									PlantLogin();
								}else{
				                	$('#fileFirmware').trigger('click');
				            	}
				            });
				            $('#browseCertificate').click(function(){
				            	if(DEMOLOCK) {
									PlantLogin();
								}else{
				                	$('#fileCertificate').trigger('click');
				            	}
				            });
				            $('#browsePrivateKey').click(function(){
				            	if(DEMOLOCK) {
									PlantLogin();
								}else{
				                	$('#filePrivateKey').trigger('click');
				            	}
				            });
				        }
				    }
				}

				if(nvram.response['nvram'][DEMO_PASSWORD] != "")
	            {
	            	DEMOLOCK = true;
	            }

				if(nvram.response['nvram'][DATA_LOG] == 1) {
					notify('', 'Data collection is enabled.', 'info');
				}
			}

	    } else {  // No SVG
	    	notify('','The browser does not support SVG graphics', 'danger');
	    }
    }
};

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
	   	xhr.open('GET', 'nvram.json?offset=' + offset + '&value=' + value, true);
	    xhr.send();
	}
};

function PlantLogin() {
	$('.modal').modal('hide');
	var modal = new bootstrap.Modal(document.getElementById('demo-Lock'));
	modal.show();
};

function HiddenInput(id, value) {
    if(value == true) {
        document.getElementById(id).removeAttribute('disabled');
    }else{
       document.getElementById(id).setAttribute('disabled', '');
    }
};

function RequireInput(id, value) {
    if(value == true) {
        document.getElementById(id).setAttribute('required', '');
    }else{
        document.getElementById(id).removeAttribute('required');
    }
};

function AvailabilityWeek(availability) {

	var week = document.querySelectorAll('#DemoAvailabilityWeek input[type="checkbox"]');
    for (var i = 0; i <  week.length; i++) {
    	if (week[i].checked) {
    		availability[i] = 1;
    	}else if(availability[i] == 1) {
    		week[i].checked = true;
    	}
    }
    var availabilityText = availability.join("");
    var slider = $('#Availability-Slider').data('roundSlider').getValue().split(',')
    if(slider[0] < 10) {
    	availabilityText += '0' + slider[0];
    }else{
    	availabilityText += slider[0];
    }
	if(slider[1] < 10) {
    	availabilityText += '0' + slider[1];
    }else{
    	availabilityText += slider[1];
    }
	$('#DemoAvailability').val(availabilityText);
};

function AlertSet(alerts) {

	var set = document.querySelectorAll('#AlertSet input[type="checkbox"]');
    for (var i = 0; i <  set.length; i++) {
    	if (set[i].checked) {
    		alerts[i] = 1;
    	}else if(alerts[i] == 1) {
    		set[i].checked = true;
    	}
    }
    var l = '0';
    var x = document.getElementById('led-enabled');
    if (x) {
		if (x.style.display == 'block') {
			l = '1';
		}
	}
	$('#Alerts').val(alerts.join("") + l);
};

function SetWiFiMode() {
	document.getElementById('AlertInfo').classList.add('d-none');

	var mode = document.getElementsByName('WiFiMode');
    if(mode[0].checked) {
        $('#WiFiModeAP').prop('checked', true);
       	document.getElementById('AlertWiFiPower').classList.add('d-none');
		document.getElementById('AlertWiFiDHCP').classList.add('d-none');
		document.getElementById('AlertInfo').classList.remove('d-none');
    }else if(mode[1].checked) {
        $('#WiFiModeClient').prop('checked', true);
        WarningWiFiMode();
    }else if(mode[2].checked) {
        $('#WiFiModeClientEnt').prop('checked', true);
        RequireInput('WiFiUsername',true);
        WarningWiFiMode();
    }else if(mode[3].checked) {
        $('#WiFiModeClientWEP').prop('checked', true);
        WarningWiFiMode();
    }
};

function WarningWiFiMode() {
	document.getElementById('AlertWiFiPower').classList.add('d-none');
	document.getElementById('AlertWiFiDHCP').classList.add('d-none');

	if(document.getElementById("WiFiPower").value < 20) {
		document.getElementById('AlertWiFiPower').classList.remove('d-none');
	}
	if(document.getElementById("WiFiDHCP").value == 0) {
		document.getElementById('AlertWiFiDHCP').classList.remove('d-none');
	}
};

function HiddenCheck(id, element) {
    //console.log(id);

    if(element.checked) {
        document.getElementById(id).value = 1;
    }else{
        document.getElementById(id).value = 0;
    }

    if(id == 'WiFiHidden') {
    	if(element.checked) {
    		saveSetting(WIFI_HIDE, 1, function(lock) {if (lock != 'Locked') {notify('','WiFi SSID is now Hidden', 'danger')}});
    	}else{
    		
    		saveSetting(WIFI_HIDE, 0, function(lock) {if (lock != 'Locked') {notify('','WiFi SSID is now Broadcasting', 'success')}});
    	}
	}else if(id == 'EnableLog') {
    	if(element.checked) {
    		saveSetting(DATA_LOG, 1, function(lock) {if (lock != 'Locked') {notify('','Graph & Log Collection is ON', 'info')}});
    	}else{
    		saveSetting(DATA_LOG, 0, function(lock) {if (lock != 'Locked') {notify('','Graph & Log Collection is OFF', 'success')}});
    	}
    }else if(id == 'WiFiDHCP') {
        var b = false;

        if(element.checked){
        	SetWiFiMode();
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
    /*
    if(data['nvram'][DATA_LOG] == '1') {
        document.getElementById('graph-enabled').style.display = 'block';
    }else{
        document.getElementById('graph-enabled').style.display = 'none';
    } */
    if(document.getElementById('led-enabled')) {
	    if(data['nvram'][ALERTS].charAt(8) == '1') {
	        document.getElementById('led-enabled').style.display = 'block';
	    }else{
	        document.getElementById('led-enabled').style.display = 'none';
	    }
	}
    if (data['nvram'][PLANT_MANUAL_TIMER] == '0') {
    	document.getElementById('timer-enabled').style.display = 'none';
    	document.getElementById('timer-disabled').style.display = 'block';
    }else{
    	document.getElementById('timer-disabled').style.display = 'none';
    	document.getElementById('timer-enabled').style.display = 'block';
    }

    AlertSet([data['nvram'][ALERTS].charAt(0), data['nvram'][ALERTS].charAt(1), data['nvram'][ALERTS].charAt(2), data['nvram'][ALERTS].charAt(3), data['nvram'][ALERTS].charAt(4), data['nvram'][ALERTS].charAt(5), data['nvram'][ALERTS].charAt(6), data['nvram'][ALERTS].charAt(7)]);
    
    document.getElementById('pot-size-text').textContent = data['nvram'][PLANT_POT_SIZE];
    document.getElementById('moisture-text').textContent = data['nvram'][PLANT_SOIL_MOISTURE];
    document.getElementById('timer-text').textContent = data['nvram'][PLANT_MANUAL_TIMER];
    document.getElementById('power-text').textContent = data['nvram'][DEEP_SLEEP];
    document.getElementById('soil-type-color').style.fill = soil_type_color[data['nvram'][PLANT_SOIL_TYPE]];
    document.getElementById('soil-type-text').textContent = soil_type_labels[data['nvram'][PLANT_SOIL_TYPE]];
    if(document.getElementById('soil-text'))
    	document.getElementById('soil-text').style.fill = soil_type_color[data['nvram'][PLANT_SOIL_TYPE]];
};

function formValidate() {
	if(WiFiPassword.value != null) {
    	WiFiPasswordConfirm.setCustomValidity(WiFiPasswordConfirm.value != WiFiPassword.value ? 'Passwords do not match.' : '');
	}else if(DemoPassword.value != null) {
		DemoPasswordConfirm.setCustomValidity(DemoPasswordConfirm.value != DemoPassword.value ? 'Passwords do not match.' : '');
	}
};

function resetFlash()
{
	window.open('api?reset=1');
};

function testPump(arg)
{
	var delayslider_parameters = {
        skin: 'big',
        grid: true,
        step: 1,
        min: 0,
        max: 60,
        from: 0
    };
	$('#test-pump-delay').ionRangeSlider(delayslider_parameters);

	$('.modal').modal('hide');
	var modal = new bootstrap.Modal(document.getElementById('test-Pump'));
	modal.show();
	document.getElementById('test-pump-start').onclick = function() {
    	testPumpLoopback(false, function(log) {
			var xhr = new XMLHttpRequest();
			xhr.clearlog = log.responseText;
			xhr.open('GET', 'api?pump=' + arg, true);
		    xhr.send();
		    xhr.onload = function() {
		        if (xhr.status == 200) {
		        	if(xhr.responseText == "Locked") {
		        		PlantLogin();
		        	}else{
		        		if(document.getElementById('WaterLevel').value == 1) {
					    	var adc = new XMLHttpRequest();
						    adc.open('GET', 'api?adc=2', true);
						    adc.send();
						    adc.onloadend = function() {
							    if(adc.status == 200) {
							    	if(adc.responseText > 0) {
							    		testPumpRun();
							    	}else{
							    		notify('', 'Check Water Level Connection', 'danger');
							    	}
								}
							}
					    }else{
					    	var t = document.getElementById('test-pump-delay').value;
					    	var x = setInterval(function() {
							  document.getElementById('test-pump-delay-timer').innerHTML = '(' + t + ')';
							  if (t < 0) {
							    clearInterval(x);
							    document.getElementById('test-pump-delay-timer').innerHTML = '';
							    testPumpRun();
							  }
							  t--;
							}, 1000);
			        	}
		        	}
		        }else{
		        	notify('', 'Pump Test Failed', 'danger');
		        }
		    };
		});
	}
};

function testPumpRun()
{
	notify('', 'Running Pump ...', 'warning');
	progressTimer(62,0,function() {
		if(xhr.clearlog == "...") {
			testPumpLoopback(true);
		}else{
			testPumpLoopback(false);
		}
	});
};

function testPumpLoopback(clearlog, callback)
{
	var log = new XMLHttpRequest();
	log.open('GET', 'data.log', true);
    log.send();
    log.onload = function() {
        if (log.status == 200) {
			if(callback) {
				callback(log);
			}else{
				//var s = log.responseText.split('\n');
	        	//console.log(s[s.length-2]);
	        	if (log.responseText.indexOf('M:') != -1) {
	        		notify('', 'Pump OK', 'success');
	        	}else{
	        		notify('', 'Pump Status Uknown', 'warning');
	        	}
			}
			if(clearlog) {
				var clog = new XMLHttpRequest();
				clog.open('GET', 'data.log?clear=1', true);
				clog.send();
			}
        }
    };
};

function emailValidate(email)
{
	if(email.indexOf('@') == -1 || email.indexOf('.') == -1) {
		return false;
	}
	return true;
};

function inputValidate(item)
{
	if(item.value == '')
		return;

	clearTimeout(notifyTimer);
    notifyTimer = setTimeout(function() {
    	var smtp = $('#AlertSMTPServer').val();

    	if(item.id == 'WiFiUsername') {
			if(!emailValidate(item.value)) {
				notify('', 'EAP PEAP identity requires @<domain.com>', 'danger');
			}
    	}else if(item.id == 'AlertEmail') {
			if(!emailValidate(item.value)) {
				notify('', 'Email format needs @<domain.com>', 'danger');
			}
		}else if(item.id == 'AlertSMTPServer') {
	    	if(smtp.indexOf(':') == -1) {
		        document.getElementById('AlertEncryptionInfo').classList.remove('d-none');
		    }else{
		    	document.getElementById('AlertEncryptionInfo').classList.add('d-none');
		    }
		}else if(item.id == 'AlertSMTPUsername') {
			if(smtp.indexOf('gmail') != -1 && !emailValidate(item.value)) {
				notify('', 'Username format needs @domain.com', 'danger');
			}
		}else if(item.id == 'AlertSMTPPassword') {
			if(smtp.indexOf('gmail') != -1 && item.value != '') {
				document.getElementById('AlertGmailInfo').classList.remove('d-none');
			}else{
				document.getElementById('AlertGmailInfo').classList.add('d-none');
			}
			document.getElementById('AlertOAuthInfo').classList.remove('d-none');
		}else if(item.id == 'AlertSMTPToken') {
			document.getElementById('AlertGmailInfo').classList.add('d-none');
			document.getElementById('AlertOAuthInfo').classList.add('d-none');
		}
    }, 3000);
};

function testFlood(water)
{
	var xhr = new XMLHttpRequest();
	xhr.open('GET', 'api?water=' + water + '&empty=1', true);
    xhr.onload = function() {
        if (xhr.status == 200) {
        	if(xhr.responseText == "Locked") {
        		PlantLogin();
        	}else if(water > 3) {
    			notify('', 'Flood Protection Started', 'success');
        	}
        }
    };
    xhr.send();
};

function testEmpty(loop, flood)
{	
	loop++;

	var xhr = new XMLHttpRequest();
	xhr.open('GET', 'pump', true);
    xhr.onload = function() {
        if (xhr.status == 200) {
        	if(xhr.responseText == "Locked") {
        		PlantLogin();
        	}else{
        		var interval = $('#EnableLogInterval').val() * 1000;
        		if(loop == 1)
        			notify('', 'Empty Simulation Started', 'success');
		        if(loop < 3) {
		        	var p = document.getElementById('pot-size-text').textContent * 1000;
		        	setTimeout(function() {
		        		progressTimer(10,0);
				    	testEmpty(loop,flood);
				    }, p);
		        }else{
		        	var set = document.querySelectorAll('#AlertSet input[type="checkbox"]');
		        	var email = false;
		        	notify('', 'Waiting for LED Warning ...', 'danger');
		        	var timer = setInterval(function() {
				   		notify('', 'Test Waiting ...', 'warning');
				    }, 6000);

		        	if(flood == true) {
						setTimeout(function() {
							clearInterval(timer);
			        		testFlood(11);
						}, interval);

						if (set[4].checked)
							email = true;
		        	}else{
						setTimeout(function() {
							clearInterval(timer);
			        		testFlood(0);
						}, interval);

		        		if (set[5].checked)
							email = true;
					}

		        	if (email) {
			        	setTimeout(function() {
			        		notify('', 'Check Email for Alert', 'success');
						}, interval + 8000);
			        }
		        }
        	}
        }else{
        	notify('', 'Empty Test Failed', 'danger');
        }
    };
    xhr.send();
};

function autoWiFiPower()
{
	var mode = document.getElementsByName('WiFiMode');
    if(mode[0].checked) {
		notify('', 'Auto Tune only in WiFi Client Mode', 'danger');
    }else{
    	document.getElementById('WiFiPower').value = 1;
    }
};

function testSoil()
{
    var adc = new XMLHttpRequest();
    adc.open('GET', 'api?adc=1', true);
    adc.send();
    adc.onloadend = function() {
	    if(adc.status == 200) {
	    	var a = parseInt(adc.responseText);
	    	notify('', 'Soil Moisture = ' + a, 'success');
		}
	}
};

function testWater()
{
    if(document.getElementById('WaterLevel').value == 0)
    {
    	notify('', 'Enable Water Sensor in Firmware', 'danger');
    	notify('', 'Hardware Mod is Required!', 'warning');
    }else{
    	var adc = new XMLHttpRequest();
	    adc.open('GET', 'api?adc=2', true);
	    adc.send();
	    adc.onloadend = function() {
		    if(adc.status == 200) {
		    	if(adc.responseText > 0) {
		    		notify('', 'Water Level Above Pump', 'success');
		    	}else{
		    		notify('', 'Water Level Below Pump', 'danger');
		    	}
			}
		}
    }
};

function flushWater()
{
	$('.modal').modal('hide');
	var modal = new bootstrap.Modal(document.getElementById('flush-Water'));
	modal.show();
	document.getElementById('flush-water-start').onclick = function() {
    	testPump(2);
	}
	document.getElementById('flush-water-stop').onclick = function() {
    	testPump(0);
	}
};

function testBattery()
{

};

function testLED()
{

};

function testEmail()
{
	if($('#AlertSMTPServer').val() == '') {
		notify('', 'Missing SMTP Server', 'danger');
	}else{
		var xhr = new XMLHttpRequest();
		xhr.open('GET', 'api?smtp=1', true);
	    xhr.send();
	    xhr.onload = function() {
	        if (xhr.status == 200) {
	        	if(xhr.responseText == "Locked") {
	        		PlantLogin();
	        	}else{
		            progressTimer(62,0,function() {
		            	if(xhr.responseText == 'OK') {
							notify('', 'SMTP OK', 'success');
						}else if(xhr.responseText == "AUTH") {
							notify('', 'SMTP Bad Authentication', 'danger');
						}else{
							notify('', 'SMTP Error ' + xhr.responseText, 'warning');
						}
					});
	        	}
	        }else{
	        	notify('', 'SMTP Test Failed', 'danger');
	        }
	    };
	}
};

function infoOAuthToken()
{
	var token = $('#AlertSMTPToken').val();
	if(token == '')
		return;

	var smtp = $('#AlertSMTPServer').val();
	if(smtp.indexOf('gmail.com') != -1) {
		//https://oauth2.googleapis.com/tokeninfo?access_token=ACCESS_TOKEN
	}else if(smtp.indexOf('office365.com') != -1) {
	}
};

function getOAuthToken()
{
	var smtp = $('#AlertSMTPServer').val();

	if(smtp == '') {
		notify('', 'Enter SMTP Server', 'danger');
		return;
	}

	var client_id = window.prompt('OAuth 2.0 Client ID', '');
	if (client_id == null || client_id == '') {
		if(smtp.indexOf('gmail.com') != -1) {
			document.getElementById('AlertGmailToken').classList.remove('d-none');
		}else if(smtp.indexOf('office365.com') != -1) {

		}
	}else{
		//192.168.8.8.nip.io
		var redirect_uri = document.location.href.substring(0, document.location.href.lastIndexOf('/'));
		if(smtp.indexOf('gmail.com') != -1) {
			window.open('https://accounts.google.com/o/oauth2/v2/auth?scope=' + encodeURIComponent('openid https://www.googleapis.com/auth/gmail.send') + '&include_granted_scopes=false&response_type=token&state=&redirect_uri=' + encodeURIComponent(redirect_uri + '/oauth2.html') + '&client_id=' + encodeURIComponent(client_id), '_blank');
			document.getElementById('gmail-redirect-uri').innerHTML = redirect_uri;
			document.getElementById('AlertGmailTokenURL').classList.remove('d-none');
		}else if(smtp.indexOf('office365.com') != -1) {
			window.open('https://login.microsoftonline.com/common/oauth2/v2.0/authorize?scope=' + encodeURIComponent('openid offline_access https://graph.microsoft.com/v1.0/me/sendMail') + '&nonce=abcde&response_mode=fragment&response_type=token&redirect_uri=' + encodeURIComponent(redirect_uri + '/oauth2.html') + '&client_id=' + encodeURIComponent(client_id), '_blank');
			//https://login.microsoftonline.com/common/v2.0/oauth2/token
		}
	}
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
};

function deleteCookies()
{
	var result = document.cookie;
	var cookieArray = result.split(";");
	for(var i=0;i<cookieArray.length;i++){
	   var keyValArr = cookieArray[i].split("=");
	   document.cookie=keyValArr[0]+"=; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Lax";
	}
}

function generateWiFiQR()
{
	var enc = 'WPA'; //WPA, WEP, nopass
    var ssid = document.getElementById('WiFiSSID').value;
    var mode = document.getElementsByName('WiFiMode');
    var hidden = document.getElementById('WiFiHiddenCheckbox').checked;
    var user = document.getElementById('WiFiUsername').value;
    var pass = document.getElementById('WiFiPasswordConfirm').value;
    if(mode[2].checked) {
    	//WIFI:T:WPA2-EAP;S:[network SSID];E:[EAP method];PH2:[Phase 2 method];A:[anonymous identity];I:[username];P:[password];;
    	enc = 'WPA2-EAP;E:PEAP;PH2:MS-CHAPv2;I:' + escape(user);
    }
    var qrstring = 'WIFI:S:' + escape(ssid) + ';T:' + enc + ';P:' + escape(pass) + ';';
    if (hidden) {
        qrstring += 'H:true';
    }
    qrstring += ';';
    //console.log(qrstring);

	if (typeof QRious !== "function") {
	    var script = document.createElement('script');
		//script.onload = function() {};
		script.src = 'js/qrious.js';
		document.head.appendChild(script);
	}else{
		var qrcode = new QRious({
			element: document.getElementById('qrcode'),
			level: 'M',
			size: 160,
			value: qrstring
		});
		var a = document.getElementById('qrcode-dl');
		a.href = qrcode.toDataURL('image/png');
		a.download = ssid+'-qrcode.png';
	}
};

/*
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
};
*/