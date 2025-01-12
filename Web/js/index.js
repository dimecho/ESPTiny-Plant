var pnpslider, adcslider, avslider;

document.addEventListener('DOMContentLoaded', function(event)
{
	if(document.cookie != "") {
		const params = new URLSearchParams(window.location.search);
		let oauthCode = params.get('code');
        let oauthScope = params.get('scope');
        if (oauthCode && oauthScope) {
			if (typeof  getOAuthToken !== 'function') {
		        var script = document.createElement('script');
		        script.src = 'js/oauth2.js';
		        script.onload = function(){ getOAuthToken(oauthCode, oauthScope) };
		        document.head.appendChild(script);
		    }
        }else{
        	var ArrayCookies = {};
			try {
				ArrayCookies = document.cookie.split(";");
				for (i = 0; i < ArrayCookies.length; i++) {
			        var c_name = ArrayCookies[i].substr(0, ArrayCookies[i].indexOf("="));
			        var c_value = ArrayCookies[i].substr(ArrayCookies[i].indexOf("=") + 1);
			        c_name = c_name.replace(/^\s+|\s+$/g, "");
			        saveSetting(c_name, unescape(c_value));
			    }
		   	}catch(error){
		    	notify('',error, 'danger');
		    }finally{
		    	if(ArrayCookies.length > 1) {
		    		document.getElementById('keep-eeprom-text').textContent="Restoring Settings ...";
					document.getElementById('keep-eeprom-footer').classList.add('hidden');
					document.getElementById('keep-EEPROM').classList.remove('hidden');

				  	progressTimer(62,2,function() {
			        	document.getElementById('keep-EEPROM').classList.add('hidden');
			        	document.getElementById('keep-eeprom-footer').classList.remove('hidden');
			        	notify('','EEPROM restored', 'success');
			        	setTimeout(function() {
					   		notify('','Passwords must be set again', 'warning');
					    }, 4000);
					});
				}
			}
		}
		deleteCookies();
	}

    loadSVG();
	
	updateNTP();

	const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.addEventListener('click', function (event) {
            if (event.target === modal) {
                hideModal(modal);
            }
        });
    });

    document.getElementById('wireless-settings-ok').onclick = function() {
		if(DEMOLOCK) {
			PlantLogin();
		}else{
	        if(document.getElementById('EnableLogCheckbox').checked === true) {
	        	var loginterval = document.getElementById('EnableLogInterval').getAttribute("value");
				var deepsleep = document.getElementById('power-text').textContent;

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

function svgwaterLevelAdjust(v) {
	document.getElementById('water').setAttribute('style', 'visibility:visible');
	var water = new XMLHttpRequest();
    water.open('GET', 'api?adc=2', true);
    water.send();
    water.onloadend = function() {
	    if(water.status == 200) {
	    	var a = parseInt(water.responseText);
			if(!isNaN(a) && a > 0) {
				document.getElementById('water-text').textContent = a + '%';
				document.getElementById('water-level').style.visibility = 'visible';
				document.getElementById('water-shadow').style.visibility = 'visible';
				document.getElementById('water-reflection').setAttribute('transform', 'matrix(1 0 0 1 0 0)');
			}else{
				if(v == 1) {
					document.getElementById('water-text').textContent = 'Empty';
				}else{
					document.getElementById('water-text').textContent = '';
				}
				document.getElementById('water-level').style.visibility = 'hidden';
				document.getElementById('water-shadow').style.visibility = 'hidden';
				document.getElementById('water-reflection').setAttribute('transform', 'matrix(1 0 0 1 0 -1500)');
			}
		}
	}
}

function updateNTP() {
	var d = new Date();
	var ntp = new XMLHttpRequest();
	ntp.open('GET', 'api?week=' + d.getDay() + '&hour=' + d.getHours() + '&minute=' + d.getMinutes() + '&ntp=1', true);
	ntp.send();
}

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
	    		
	    		if(nvram.response['nvram'][0].indexOf('esp32') != -1) {
	    			ESP32 = true;
	    		}

 				//var index = new XMLHttpRequest();
				index.open('GET', 'svg/', true);
				index.send();
				index.onload = function(e) {
					svgfile = 'bonsai.svg';
					if(index.response != undefined) {
						try {
							var list = document.getElementById('listLayout');
							var n = 0;
							index.responseText.split('\n').forEach(function (item) {
								//console.log(item);
								if(n == nvram.response['nvram'][PLANT_TYPE]) {
									svgfile = item; //match index # to file name
								}
								if(item.indexOf('soil.') == -1) {
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
								}
								n++;
							});
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
						    	if((ESP32 && a > 4000 && a < 4095) || (!ESP32 && a > 1010 && a < 1024))
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
								    	var t = parseInt(ts.responseText) - 18;
								    	if(t > 0) {
					                    	document.getElementById('moisture-adc').textContent = document.getElementById('moisture-adc').textContent + ' (' + t + '°C)';
						                    if(t < 4) {
						                        notify('', 'Water Freeze Warning', 'danger');
						                    }
					                	}
									}
								}
			                    var pnp_adc = nvram.response['nvram'][PNP_ADC] + '000';
			                    document.getElementById('WaterLevel').value = pnp_adc.charAt(2);
			                    svgwaterLevelAdjust(pnp_adc.charAt(2));
							}
						}
	                    
				        document.getElementById('background').onclick = function() {
				            var svgPlant = document.getElementById('svgPlant');
						    svgPlant.innerHTML = '';
						    
				            var xhr = new XMLHttpRequest();
						    xhr.open('GET', 'svg/', true);
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
													saveSetting(PLANT_TYPE, i, function() { loadSVG(id); hideAllModals(); });
									            }
							                	svgPlant.appendChild(div);
							                }
						                }
					                })(i);
		                        }
						    }
						    document.getElementById('plant-Type').classList.remove('hidden');
				            document.getElementById('modal-backdrop').classList.remove('hidden');
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
				        	roundSliderInit({
				                value: document.getElementById('pot-size-text').textContent,
				                borderWidth: 2,
  								rangeColor: document.getElementById('pot-size-badge').firstElementChild.getAttribute('fill'),
				                radius: 280,
				                width: 32,
				                handleSize: 64,
				                min: 2,
				                max: 40
				            });
				            document.getElementById('roundslider').addEventListener('mouseup', _potsizeScroll);
				            document.getElementById('roundslider').classList.remove('hidden');
				        	document.getElementById('modal-backdrop').classList.remove('hidden');
				        }

				        document.getElementById('water').onclick = function() {
				        	roundSliderInit({
				                value: document.getElementById('WaterLevel').getAttribute('value'),
				                borderWidth: 2,
				                radius: 100,
				                width: 32,
				                handleSize: 64,
				                min: 0,
				                max: 1
				            });
				            document.getElementById('roundslider').addEventListener('mouseup', _waterScroll);
				            document.getElementById('roundslider').classList.remove('hidden');
				        	document.getElementById('modal-backdrop').classList.remove('hidden');
				        }

				        document.getElementById('moisture').onclick = function() {
				            var moistureMin = 20;
				            var moistureMax = 1000;
				            var moistureStep = 10;
				            if(ESP32) {
				            	moistureMin = 100;
				            	moistureMax = 2000;
				            }
				            roundSliderInit({
				                value: document.getElementById('moisture-text').textContent,
				                borderWidth: 2,
  								rangeColor: document.getElementById('moisture-badge').firstElementChild.getAttribute('fill'),
				                radius: 280,
				                width: 32,
				                handleSize: 64,
				                min: moistureMin,
				                max: moistureMax,
				                step: moistureStep,
				            });
				            document.getElementById('roundslider').addEventListener('mouseup', _moistureScroll);
				            document.getElementById('roundslider').classList.remove('hidden');
				        	document.getElementById('modal-backdrop').classList.remove('hidden');
				        }

				        document.getElementById('timer').onclick = function() {
				            var timerStep = 1;
				            roundSliderInit({
				                value: document.getElementById('moisture-text').textContent,
				                borderWidth: 2,
  								rangeColor: document.getElementById('moisture-badge').firstElementChild.getAttribute('fill'),
				                radius: 280,
				                width: 32,
				                handleSize: 64,
				                min: 0,
				                max: 96,
				                step: timerStep,
				            });
				            document.getElementById('roundslider').addEventListener('mouseup', _timerScroll);
				            document.getElementById('roundslider').classList.remove('hidden');
				        	document.getElementById('modal-backdrop').classList.remove('hidden');
				        }

						document.getElementById('power').onclick = function() {
				            var sleepMax = 30;
				            if(ESP32) {
				            	sleepMax = 1440;
				            }
				            roundSliderInit({
				                value: document.getElementById('power-text').textContent,
				                borderWidth: 2,
  								rangeColor: document.getElementById('power-badge').firstElementChild.getAttribute('fill'),
				                radius: 280,
				                width: 32,
				                handleSize: 64,
				                min: 0,
				                max: sleepMax
				            });
				            document.getElementById('roundslider').addEventListener('mouseup', _powerScroll);
				            document.getElementById('roundslider').classList.remove('hidden');
				        	document.getElementById('modal-backdrop').classList.remove('hidden');
				        }

				        document.getElementById('soil').onclick = function() {
				            var svgSoil = document.getElementById('svgSoil');
				            if (typeof SVGRect != undefined) {
				                var xhr = new XMLHttpRequest();
				                xhr.open('GET', 'svg/soil.svg', true);
				                xhr.send();
				                xhr.onload = function(e) {
				                	svgSoil.innerHTML = xhr.responseText;

				                	document.getElementById('soil-moss').onclick = function() {
										var moss_color = document.getElementById('soil-rock-badge').firstElementChild.getAttribute('fill');
										document.getElementById('soil-type-color').style.fill = moss_color;
								        document.getElementById('soil-type-text').textContent = soil_type_labels[0];
								        if(document.getElementById('soil-text'))
								        	document.getElementById('soil-text').style.fill = moss_color;
								        saveSetting(PLANT_SOIL_TYPE, 0, function() { hideAllModals(); });
								    }
								    document.getElementById('soil-loam').onclick = function() {
								    	var loam_color = document.getElementById('soil-rock-badge').firstElementChild.getAttribute('fill');
										document.getElementById('soil-type-color').style.fill = loam_color;
								        document.getElementById('soil-type-text').textContent = soil_type_labels[1];
								        if(document.getElementById('soil-text'))
								        	document.getElementById('soil-text').style.fill = loam_color;
								        saveSetting(PLANT_SOIL_TYPE, 1, function() { hideAllModals(); });
								    }
								    document.getElementById('soil-dirt').onclick = function() {
										var dirt_color = document.getElementById('soil-rock-badge').firstElementChild.getAttribute('fill');
										document.getElementById('soil-type-color').style.fill = dirt_color;
								        document.getElementById('soil-type-text').textContent = soil_type_labels[2];
								        if(document.getElementById('soil-text'))
								        	document.getElementById('soil-text').style.fill = dirt_color;
								        saveSetting(PLANT_SOIL_TYPE, 2, function() { hideAllModals(); });
								    }
								    document.getElementById('soil-clay').onclick = function() {
								    	var clay_color = document.getElementById('soil-rock-badge').firstElementChild.getAttribute('fill');
								    	document.getElementById('soil-type-color').style.fill = clay_color;
								        document.getElementById('soil-type-text').textContent = soil_type_labels[3];
								        if(document.getElementById('soil-text'))
								        	document.getElementById('soil-text').style.fill = clay_color;
								        saveSetting(PLANT_SOIL_TYPE, 3, function() { hideAllModals(); });
								    }
								    document.getElementById('soil-sand').onclick = function() {
								    	var sand_color = document.getElementById('soil-rock-badge').firstElementChild.getAttribute('fill');
								    	document.getElementById('soil-type-color').style.fill = sand_color;
								        document.getElementById('soil-type-text').textContent = soil_type_labels[4];
								        if(document.getElementById('soil-text'))
								        	document.getElementById('soil-text').style.fill = sand_color;
								        saveSetting(PLANT_SOIL_TYPE, 4, function() { hideAllModals(); });
								    }
								    document.getElementById('soil-rock').onclick = function() {
								    	var rock_color = document.getElementById('soil-rock-badge').firstElementChild.getAttribute('fill');
								    	document.getElementById('soil-type-color').style.fill = rock_color;
								        document.getElementById('soil-type-text').textContent = soil_type_labels[5];
								        if(document.getElementById('soil-text'))
								        	document.getElementById('soil-text').style.fill = rock_color;
								        saveSetting(PLANT_SOIL_TYPE, 5, function() { hideAllModals(); });
								    }
				                }
				                document.getElementById('soil-Settings').classList.remove('hidden');
				        		document.getElementById('modal-backdrop').classList.remove('hidden');
				            }
				        }
				        
				        document.getElementById('wireless').onclick = function() {

				        	document.getElementById('wireless-Settings').classList.remove('hidden');
				        	document.getElementById('modal-backdrop').classList.remove('hidden');

				            var nvram = new XMLHttpRequest();
				            nvram.responseType = 'json';
				            //nvram.overrideMimeType('application/json');
				            nvram.open('GET', 'nvram.json', true);
				            nvram.send();
				            nvram.onload = function(e) {
				                try {
				                	var data = nvram.response; //nvram.responseText;
				                    var v = data['nvram'][0].split('|');
				                    document.getElementById('coreVersion').textContent = 'Core Version: ' + v[0];
				                    document.getElementById('sdkVersion').textContent = 'SDK Version: ' + v[1];
				                    document.getElementById('fsVersion').textContent = 'LittleFS Version: ' + (0xffff & (v[2] >> 16)) + "." + (0xffff & (v[2] >> 0)) + "." + (0xffff & (v[2] >> 20));
				                    document.getElementById('firmwareVersion').textContent = 'Firmware Version: ' + v[3];
				                    document.getElementById('iram').textContent = 'IRAM: ' + Math.round(v[4]/1024) + ' KB (' + v[4] + ')';
									document.getElementById('dram').textContent = 'DRAM: ' + Math.round(v[5]/1024) + ' KB (' + v[5] + ')';

				                    var bool_value = data['nvram'][WIFI_HIDE] == '1' ? true : false;
									document.getElementById('WiFiHidden').value = data['nvram'][WIFI_HIDE];
									document.getElementById('WiFiHiddenCheckbox').checked = bool_value;
									document.getElementById('WiFiPhyMode').value = data['nvram'][WIFI_PHY_MODE];
				                    if(data['nvram'][WIFI_PHY_MODE] == 3) {
				                    	var optionObject = document.getElementById('WiFiPower').options;
				                    	optionObject[17].setAttribute('hidden','true');
				                    	optionObject[18].setAttribute('hidden','true');
				                    	optionObject[19].setAttribute('hidden','true');
				                    	optionObject[20].setAttribute('hidden','true');
				                    }
				                    document.getElementById('WiFiPower').value = data['nvram'][WIFI_PHY_POWER];
									document.getElementById('WiFiChannel').value = data['nvram'][WIFI_CHANNEL];
									document.getElementById('WiFiSSID').value = data['nvram'][WIFI_SSID];
									document.getElementById('WiFiUsername').value = data['nvram'][WIFI_USERNAME];
				                    bool_value = data['nvram'][LOG_ENABLE] == '1' ? true : false;
				                   	document.getElementById('EnableLog').value = data['nvram'][LOG_ENABLE];
									document.getElementById('EnableLogCheckbox').checked = bool_value;
									document.getElementById('EnableLogInterval').value = data['nvram'][LOG_INTERVAL];

				                    var pnp_adc = data['nvram'][PNP_ADC] + '000';
				                    document.getElementById('EnablePNP').value = pnp_adc.charAt(0);
									document.getElementById('ADCSensitivity').value = pnp_adc.charAt(1);
									bool_value = pnp_adc.charAt(2) == '1' ? true : false;
									document.getElementById('WaterLevel').value = pnp_adc.charAt(2);
									document.getElementById('WaterLevelCheckbox').checked = bool_value;

				                    bool_value = data['nvram'][NETWORK_DHCP] == '1' ? true : false;
				                    document.getElementById('WiFiDHCP').value = data['nvram'][NETWORK_DHCP];
									document.getElementById('WiFiDHCPCheckbox').checked = bool_value;
				                    //if(bool_value == true) {
										document.getElementById('WiFiIP').disabled = bool_value;
										document.getElementById('WiFiSubnet').disabled = bool_value;
										document.getElementById('WiFiGateway').disabled = bool_value;
										document.getElementById('WiFiDNS').disabled = bool_value;
				                    //}
									document.getElementById('WiFiIP').value = data['nvram'][NETWORK_IP];
									document.getElementById('WiFiSubnet').value = data['nvram'][NETWORK_SUBNET];
									document.getElementById('WiFiGateway').value = data['nvram'][NETWORK_GATEWAY];
									document.getElementById('WiFiDNS').value = data['nvram'][NETWORK_DNS];

				                    document.getElementsByName('WiFiMode')[data['nvram'][WIFI_MODE]].checked = true;
				                    SetWiFiMode();

				                   	document.getElementById('AlertEmail').value = data['nvram'][EMAIL_ALERT];
									document.getElementById('AlertSMTPUsername').value = data['nvram'][SMTP_USERNAME];
				                    var smtp = data['nvram'][SMTP_SERVER];
				                    if(smtp != '') {
				                    	document.getElementById('AlertSMTPServer').value = smtp;
					                    if(smtp.indexOf(':') == -1) {
										    notify('', 'No Email Encryption', 'danger');
										    notify('', smtp + ':587', 'warning');
										}
									}
									document.getElementById('AlertPlantName').value = data['nvram'][PLANT_NAME];
									document.getElementById('Timezone').value = data['nvram'][TIMEZONE_OFFSET];

						            document.getElementById('EnablePNP').addEventListener('input', function() {
						            	const enablePNP = document.getElementById('EnablePNP').getAttribute("value");
									    const waterLevel = document.getElementById('WaterLevel').getAttribute("value");
									    const adcValue = document.getElementById('ADCSensitivity').getAttribute("value");
									    if (enablePNP === 'PNP') {
									        notify('', 'PNP Transistor! Controlled with LOW (Negative)', 'danger');
									        notify('', 'If you get this WRONG, Pump will run Non-Stop!', 'warning');
									        saveSetting(PNP_ADC, '1' + adcValue + waterLevel);
									    } else {
									        saveSetting(PNP_ADC, '0' + adcValue + waterLevel);
									    }
									});

						            document.getElementById('ADCSensitivity').addEventListener('input', function() {
									    const enablePNP = document.getElementById('EnablePNP').getAttribute("value");
									    const waterLevel = document.getElementById('WaterLevel').getAttribute("value");
									    const adcValue = document.getElementById('ADCSensitivity').getAttribute("value");
									    if (enablePNP === 'PNP') {
									        saveSetting(PNP_ADC, '1' + adcValue + waterLevel);
									    } else {
									        saveSetting(PNP_ADC, '0' + adcValue + waterLevel);
									    }
									});

									document.getElementById('fileLayout').addEventListener('change', function() {
									    if (DEMOLOCK) {
									        PlantLogin();
									    } else {
									        document.getElementById('formLayout').submit();
									    }
									});

									document.getElementById('fileLittleFS').addEventListener('change', function() {
									    if (DEMOLOCK) {
									        PlantLogin();
									    } else {
									        document.getElementById('formLittleFS').setAttribute('action', 'http://' + window.location.hostname + '/update'); // force HTTP
									        progressTimer(80, 1);
									        document.getElementById('formLittleFS').submit();
									    }
									});

									document.getElementById('fileFirmware').addEventListener('change', function() {
						            	if(DEMOLOCK) {
											PlantLogin();
										}else{
											document.getElementById('formFirmware').setAttribute('action', 'http://' + window.location.hostname + '/update'); // force HTTP
											document.getElementById('keep-eeprom-text').textContent="After firmware upgrade, keep current settings?";
											//document.querySelectorAll("#keep-EEPROM .modal-footer")[0].style.display = "";

											document.getElementById('wireless-Settings').classList.add('hidden');
											document.getElementById('keep-EEPROM').classList.remove('hidden');
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
												document.cookie = 'LOG_ENABLE=' + data['nvram'][LOG_ENABLE];
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
					            				document.getElementById('keep-EEPROM').classList.add('hidden');
					            				document.getElementById('wireless-Settings').classList.remove('hidden');
					                			progressTimer(20, 1);
							                	document.getElementById('formFirmware').submit();
					            			}
							            }
						            });
								    pnpslider = {
								        target: '#EnablePNP',
								        values: ['NPN', 'PNP'],
								        range: false,
								        tooltip: false,
								        scale: false,
								        labels: false,
								        step: 1,
								        set: [pnp_adc.charAt(0)],
								        onChange: function (e) {
										    document.getElementById('EnablePNP').value = e;
								        }
								    };
								    adcslider = {
								    	target: '#ADCSensitivity',
								        values: Array.from({ length: 9 }, (_, i) => i),
								        range: false,
								        tooltip: false,
								        scale: true,
								        labels: true,
								        step: 1,
								        set: [pnp_adc.charAt(1)],
								        onChange: function (e) {
										    document.getElementById('ADCSensitivity').value = e;
								        }
								    };
								    const times = Array.from({ length: 25 }, (_, i) => {
									  const hour = (6 + i) % 24;
									  const period = hour < 12 ? "am" : "pm";
									  const formattedHour = hour % 12 || 12; // Converts 0 to 12 for 12-hour clock
									  return `${formattedHour}:00${period}`;
									});
									//console.log(times);
								    avslider = {
								        target: '#availability-slider',
								        values: times,
								        range: true,
								        tooltip: true,
								        scale: false,
								        labels: false,
								        set: ['7:00am', '11:00am'],
								        onChange: function (e) {
								        	console.log(e);
										    //document.getElementById('ADCSensitivity').value = e;
								        }
								    };
								    var logslider = {
								   		target: '#EnableLogInterval',
								        values: Array.from({ length: 60 }, (_, i) => i * 10),
								        range: false,
								        tooltip: true,
								        scale: true,
								        labels: false,
								        //step: 1,
								        set: [data['nvram'][LOG_INTERVAL]],
								        onChange: function (e) {
								        	if (e < 10) {
										        notify('', 'Flash memory will fill up fast!', 'danger');
										    }
										    document.getElementById('EnableLogInterval').value = e;
								        }
								    };
								    initRangeSlider(logslider);
									/*
						            $('#Availability-Slider').roundSlider({
						                svgMode: true,
						                radius: 100,
						                width: 16,
						                handleSize: '34,10',
						                sliderType: 'range',
									    value: data['nvram'][DEMO_AVAILABILITY].substring(7,9) + ',' + data['nvram'][DEMO_AVAILABILITY].substring(9,11),
									    tooltipColor: "text-md text-gray-800 dark:text-white",
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
						            */
						            AvailabilityWeek([data['nvram'][DEMO_AVAILABILITY].charAt(0), data['nvram'][DEMO_AVAILABILITY].charAt(1), data['nvram'][DEMO_AVAILABILITY].charAt(2), data['nvram'][DEMO_AVAILABILITY].charAt(3), data['nvram'][DEMO_AVAILABILITY].charAt(4), data['nvram'][DEMO_AVAILABILITY].charAt(5), data['nvram'][DEMO_AVAILABILITY].charAt(6)]);

				                } catch (error) {}
				            }
				            
							const togglePasswordIcons = document.querySelectorAll('.toggle-password');
							togglePasswordIcons.forEach(icon => {
							    icon.addEventListener('click', () => {
							        const passwordField = document.querySelector(`#${icon.getAttribute('data-target')}`);
							        const type = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
							        passwordField.setAttribute('type', type);
							        const currentSrc = icon.getAttribute('src');
							        const newSrc = currentSrc === 'img/eye-slash.svg' ? 'img/eye-slash-fill.svg' : 'img/eye-slash.svg';
							        icon.setAttribute('src', newSrc);
							    });
							});

							document.getElementById('browseLittleFS').addEventListener('click', function() {
							    if (DEMOLOCK) {
							        PlantLogin();
							    } else {
							        document.getElementById('fileLittleFS').click();
							    }
							});

							document.getElementById('browseFirmware').addEventListener('click', function() {
							    if (DEMOLOCK) {
							        PlantLogin();
							    } else {
							        document.getElementById('fileFirmware').click();
							    }
							});

							document.getElementById('browseCertificate').addEventListener('click', function() {
							    if (DEMOLOCK) {
							        PlantLogin();
							    } else {
							        document.getElementById('fileCertificate').click();
							    }
							});

							document.getElementById('browsePrivateKey').addEventListener('click', function() {
							    if (DEMOLOCK) {
							        PlantLogin();
							    } else {
							        document.getElementById('filePrivateKey').click();
							    }
							});
				        }
				    }
				}

				if(nvram.response['nvram'][DEMO_PASSWORD] != "")
	            {
	            	DEMOLOCK = true;
	            }

				if(nvram.response['nvram'][LOG_ENABLE] == 1) {
					notify('', 'Data collection is enabled.', 'info');
				}
			}

	    } else {  // No SVG
	    	notify('','The browser does not support SVG graphics', 'danger');
	    }
    }
}

function initRangeSlider(options) {
	var nodeid = options.target.replace('#','');
	if (typeof rSlider !== "function") {
    	var stylesheet = document.createElement('link');
    	stylesheet.rel = 'stylesheet';
    	stylesheet.type = 'text/css';
		stylesheet.href = 'css/rslider.css';
    	document.head.appendChild(stylesheet);

	    var script = document.createElement('script');
		script.onload = function() {
			new rSlider(options);
		};
		script.src = 'js/rslider.js';
		document.head.appendChild(script);
	}else{
		if (document.getElementById(nodeid).style.display !== 'none') {
			new rSlider(options);
		}
	}
	//document.querySelectorAll(options.target).forEach(element => {
	//	element.remove();
	//});
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
	   	xhr.open('GET', 'nvram.json?offset=' + offset + '&value=' + value, true);
	    xhr.send();
	}
}

const _timerScroll = function (event) {
	var value = document.querySelector(".roundslider-text").textContent;
	document.getElementById('timer-text').textContent = value;

    saveSetting(PLANT_MANUAL_TIMER, value, function(lock) {
    	if (lock != 'Locked') {
    		if (value == 0) {
                document.getElementById('timer-enabled').classList.add('hidden');
                document.getElementById('timer-disabled').classList.remove('hidden');

                document.getElementById('power-text').textContent = 4;
                if (document.getElementById('EnableLogCheckbox').checked === false) {
                	saveSetting(DEEP_SLEEP, 4);
                }
            }else{
                document.getElementById('timer-enabled').classList.remove('hidden');
                document.getElementById('timer-disabled').classList.add('hidden');

                //document.getElementById('power-text').textContent = 30;
                //if($('#EnableLogCheckbox').prop('checked') == false)
                //	saveSetting(DEEP_SLEEP, 30);
                notify('', 'Timer disables Soil Sensor', 'danger');
                if(value < 8) //less than 8 hours
                	notify('', 'Timer is Low! No Overwater protection', 'warning');
                notify('', 'Enable when issues with Sensor', 'info');
            }
        }
    });
};

function _moistureScroll (event) {
	var value = document.querySelector(".roundslider-text").textContent;
	document.getElementById('moisture-text').textContent = value;
    saveSetting(PLANT_SOIL_MOISTURE, value);
};

function _potsizeScroll (event) {
	var value = document.querySelector(".roundslider-text").textContent;
	document.getElementById('pot-size-text').textContent = value;
    saveSetting(PLANT_POT_SIZE, value);
};

function _powerScroll (event) {
	var value = document.querySelector(".roundslider-text").textContent;
    if(value == 0) {
		notify('', 'Sleep Disabled!', 'danger');
		notify('', 'Wireless Always On', 'success');
		//notify('', 'Battery Will Discharge Quickly!', 'warning');
	}else if(value < 5) {
		notify('', 'Low Sleep = High Power Consumption!', 'warning');
		notify('', 'Sleep > 5 Minutes Recommended', 'success');
	}
    document.getElementById('power-text').textContent = value;
    if(value == 0) {
    	saveSetting(DEEP_SLEEP, 1);
    }else{
    	saveSetting(DEEP_SLEEP, value);
    }
};

function _waterScroll (event) {
	var value = document.querySelector(".roundslider-text").textContent;
	var pnp = 0;
    if(document.getElementById('EnablePNP').value == 'PNP')
    	pnp = 1;
    saveSetting(PNP_ADC, pnp + document.getElementById('ADCSensitivity').getAttribute('value') + value, function(lock) {
    	if (lock != 'Locked') {
    		svgwaterLevelAdjust(value);
        }
    });
    document.getElementById('WaterLevel').value = value;
};

function _unbindScroll() {
	var roundslider = document.getElementById('roundslider');
	roundslider.removeEventListener("mouseup", _timerScroll);
    roundslider.removeEventListener("mouseup", _moistureScroll);
    roundslider.removeEventListener("mouseup", _potsizeScroll);
    roundslider.removeEventListener("mouseup", _powerScroll);
    roundslider.removeEventListener("mouseup", _waterScroll);
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
        _unbindScroll();
    }
}

function hideAllModals() {
	const backdrop = document.getElementById('modal-backdrop');
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.classList.add('hidden');
    });
    backdrop.classList.add('hidden');
    _unbindScroll();
}

function PlantLogin() {
	hideAllModals();
	document.getElementById('demo-Lock').classList.remove('hidden');
}

 function changeTab(event, tabId) {

    const tabLinks = document.querySelectorAll('.tab-link');
    tabLinks.forEach(link => {
        link.classList.remove('border-b-2', 'text-blue-500', 'dark:text-blue-300');
        link.classList.add('text-gray-600', 'dark:text-gray-400');
    });

    const tabPanes = document.querySelectorAll('.tab-pane');
    tabPanes.forEach(pane => {
        pane.classList.add('hidden');
    });

    event.currentTarget.classList.add('border-b-2', 'text-blue-500', 'dark:text-blue-300');
    
    const activeTab = document.getElementById(tabId);
    activeTab.classList.remove('hidden');
}

function HiddenInput(id, value) {
    if(value == true) {
        document.getElementById(id).removeAttribute('disabled');
    }else{
       	document.getElementById(id).setAttribute('disabled', '');
    }
}

function RequireInput(id, value) {
    if(value == true) {
        document.getElementById(id).setAttribute('required', '');
    }else{
        document.getElementById(id).removeAttribute('required');
    }
}

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
	document.getElementById('DemoAvailability').value = availabilityText;
}

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
	document.getElementById('Alerts').value = alerts.join('') + l;
}

function SetWiFiMode() {
	document.getElementById('AlertInfo').classList.add('d-none');

	var mode = document.getElementsByName('WiFiMode');
    if(mode[0].checked) {
        document.getElementById('WiFiModeAP').checked = true;
       	document.getElementById('AlertWiFiPower').classList.add('d-none');
		document.getElementById('AlertWiFiDHCP').classList.add('d-none');
		document.getElementById('AlertInfo').classList.remove('d-none');
    }else if(mode[1].checked) {
    	document.getElementById('WiFiModeClient').checked = true;
        WarningWiFiMode();
    }else if(mode[2].checked) {
    	document.getElementById('WiFiModeClientEnt').checked = true;
        RequireInput('WiFiUsername',true);
        WarningWiFiMode();
    }else if(mode[3].checked) {
        document.getElementById('WiFiModeClientWEP').checked = true;
        WarningWiFiMode();
    }
}

function WarningWiFiMode() {
	document.getElementById('AlertWiFiPower').classList.add('d-none');
	document.getElementById('AlertWiFiDHCP').classList.add('d-none');

	if(document.getElementById("WiFiPower").value < 20) {
		document.getElementById('AlertWiFiPower').classList.remove('d-none');
	}
	if(document.getElementById("WiFiDHCP").value == 0) {
		document.getElementById('AlertWiFiDHCP').classList.remove('d-none');
	}
}

function HiddenCheck(id, element) {
    //console.log(id);

    if(element.checked) {
        document.getElementById(id).getAttribute('value') = 1;
    }else{
        document.getElementById(id).getAttribute('value') = 0;
    }

    if(id == 'WiFiHidden') {
    	if(element.checked) {
    		saveSetting(WIFI_HIDE, 1, function(lock) {if (lock != 'Locked') {notify('','WiFi SSID is now Hidden', 'danger')}});
    	}else{
    		saveSetting(WIFI_HIDE, 0, function(lock) {if (lock != 'Locked') {notify('','WiFi SSID is now Broadcasting', 'success')}});
    	}
	}else if(id == 'EnableLog') {
    	if(element.checked) {
    		saveSetting(LOG_ENABLE, 1, function(lock) {if (lock != 'Locked') {notify('','Graph & Log Collection is ON', 'info')}});
    	}else{
    		saveSetting(LOG_ENABLE, 0, function(lock) {if (lock != 'Locked') {notify('','Graph & Log Collection is OFF', 'success')}});
    	}
    }else if(id == 'WaterLevel') {
    	var pnp = 0;
        if(document.getElementById('EnablePNP').getAttribute('value')== 'PNP')
        	pnp = 1;
        saveSetting(PNP_ADC, pnp + document.getElementById('ADCSensitivity').getAttribute('value') + document.getElementById('WaterLevel').getAttribute('value'), function(lock) {if (lock != 'Locked') {notify('','Make sure Water Sensor is OK and Water Full', 'info')}});
        svgwaterLevelAdjust(document.getElementById('WaterLevel').getAttribute('value'));
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
}

function NVRAMtoSVG(data)
{
    /*
    if(data['nvram'][LOG_ENABLE] == '1') {
        document.getElementById('graph-enabled').style.display = 'block';
    }else{
        document.getElementById('graph-enabled').style.display = 'none';
    } */
    if(document.getElementById('led-enabled')) {
	    if(data['nvram'][ALERTS].charAt(8) == '1') {
	        document.getElementById('led-enabled').classList.remove('hidden');
	    }else{
	        document.getElementById('led-enabled').classList.add('hidden');
	    }
	}
    if (data['nvram'][PLANT_MANUAL_TIMER] == '0') {
    	document.getElementById('timer-enabled').classList.add('hidden');
		document.getElementById('timer-disabled').classList.remove('hidden');
    }else{
    	document.getElementById('timer-enabled').classList.remove('hidden');
		document.getElementById('timer-disabled').classList.add('hidden');
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
}

function resetFlash()
{
	window.open('api?reset=1');
}

function testPump()
{
	var delayslider_parameters = {
        skin: 'big',
        grid: true,
        step: 1,
        min: 0,
        max: 60,
        from: 0
    };
	ionRangeSlider('#test-pump-delay', delayslider_parameters);

	hideAllModals();
	document.getElementById('test-Pump').classList.remove('hidden');
	document.getElementById('modal-backdrop').classList.remove('hidden');

	document.getElementById('test-pump-start').onclick = function() {
		var t = document.getElementById('test-pump-delay').value * 2;
    	var x = setInterval(function() {
			if (t == 0) {
			    clearInterval(x);
			    document.getElementById('test-pump-delay-timer').innerHTML = '';
			    var log = new XMLHttpRequest();
				log.open('GET', 'log?start=1', true);
			    log.send();
			    log.onload = function() {
			        if (log.status == 200) {
						var xhr = new XMLHttpRequest();
						xhr.open('GET', 'api?pump=1', true);
					    xhr.send();
					    xhr.onload = function() {
					        if (xhr.status == 200) {
					        	var tm = parseInt(document.getElementById('pot-size-text').textContent) + 1;
					        	if(xhr.responseText == "Locked") {
					        		PlantLogin();
					        	}else if(document.getElementById('WaterLevel').getAttribute('value') == 1) {
					        		notify('', 'Water Level Sensor is On', 'warning');
							    	var adc = new XMLHttpRequest();
								    adc.open('GET', 'api?adc=2', true);
								    adc.send();
								    adc.onloadend = function() {
									    if(adc.status == 200) {
									    	if(adc.responseText > 0) {
									    		testPumpRun(tm);
									    	}else{
									    		notify('', 'Check Water Level', 'danger');
									    	}
										}
									}
							    }else{
							    	testPumpRun(tm);
							    }
					        }else{
					        	notify('', 'Pump Test Failed', 'danger');
					        }
					    };
			        }
			    };
			}else if ((t/2) % 1 == 0) {
			  	document.getElementById('test-pump-delay-timer').innerHTML = '(' + (t/2) + ')';
			}
			t--;
		}, 500);
	}
}

function testPumpRun(tm)
{
	notify('', 'Running Pump ...', 'warning');
	var timer = setInterval(function() {
		tm -= 10;
	    notify('', '... ' + tm + ' Seconds Remaining', 'warning');
	}, 10000);
	progressTimer((tm * 10), 3, function() {
		clearInterval(timer);
		var log = new XMLHttpRequest();
		log.open('GET', 'log', true);
	    log.send();
	    log.onload = function() {
	        if (log.status == 200) {
				//var s = log.responseText.split('\n');
	        	//console.log(s[s.length-2]);
	        	if (log.responseText.indexOf('M:') != -1) {
	        		notify('', 'Pump OK', 'success');
	        	}else if (log.responseText.indexOf('e:') != -1) {
	        		notify('', 'Empty Water Protection', 'warning');
	        	}else{
	        		notify('', 'Pump Status Uknown', 'warning');
	        	}
				if(document.getElementById('EnableLog').value == 0) {
					var elog = new XMLHttpRequest();
					elog.open('GET', 'log?end=1', true);
					elog.send();
				}
	        }
	    };
	});
}

function emailValidate(email)
{
	if(email.indexOf('@') == -1 || email.indexOf('.') == -1) {
		return false;
	}
	return true;
}

function inputValidate(item)
{
	if(item.value == '')
		return;

	clearTimeout(notifyTimer);
    notifyTimer = setTimeout(function() {
    	var smtp = document.getElementById('AlertSMTPServer').getAttribute('value');

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
}

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
}

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
        		var interval = document.getElementById('EnableLogInterval').value * 1000;
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
}

function autoWiFiPower()
{
	var mode = document.getElementsByName('WiFiMode');
    if(mode[0].checked) {
		notify('', 'Auto Tune only in WiFi Client Mode', 'danger');
    }else{
    	document.getElementById('WiFiPower').value = 1;
    }
}

function generateRandomNumbers(count, min, max) {
    const numbers = [];
    for (let i = 0; i < count; i++) {
        const randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;
		numbers.push(randomNumber);
		var MANUAL_TIMER = parseInt(document.getElementById('moisture-text').textContent);
		if(randomNumber <= MANUAL_TIMER) {
        	numbers.push("T:" + MANUAL_TIMER + ",M:" + randomNumber);
		}
    }
    return numbers;
}

function testGraph()
{
	var xhr = new XMLHttpRequest();
	xhr.open('GET', 'log?clear=1', true);
    xhr.onload = function() {
        if (xhr.status == 200) {
        	if(xhr.responseText == "Locked") {
        		PlantLogin();
        	}else{ //if(xhr.responseText == "...") {
    			notify('', 'Generating Random Graph ...', 'success');

    			const randomNumbers = generateRandomNumbers(100, 500, 1024);
				const fileContent = randomNumbers.join('\n');
				const blob = new Blob([fileContent], { type: 'text/plain' });
				console.log(blob);
				const file = new File([blob], "log", { type: 'text/plain' });
				const formData = new FormData();
				formData.append('file', file);
				fetch('/upload', {
				    method: 'POST',
				    body: formData
				})
				.then(response => response.json())
				.then(data => console.log('Success:', data))
				.catch(error => console.error('Error:', error));
        	}
        }
    };
    xhr.send();
}

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
}

function testWater()
{
    if(document.getElementById('WaterLevel').getAttribute('value') == 0)
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
}

function flushWater()
{
	hideAllModals();
	document.getElementById('flush-Water').classList.remove('hidden');
	document.getElementById('modal-backdrop').classList.remove('hidden');

	var timer;
	var xhr = new XMLHttpRequest();
	document.getElementById('flush-water-start').onclick = function() {
    	xhr.open('GET', 'api?pump=2', true);
	    xhr.send();
	    xhr.onload = function() {
	        if (xhr.status == 200) {
	        	notify('', 'Flush Started', 'success');
	        	timer = setInterval(function() {
	        		notify('', 'Running Flush ...', 'warning');
			    }, 5000);
	        }
	    }
	}
	document.getElementById('flush-water-stop').onclick = function() {
		clearInterval(timer);
    	xhr.open('GET', 'api?pump=0', true);
	    xhr.send();
	    xhr.onload = function() {
	        if (xhr.status == 200) {
	        	clearInterval(timer);
	        	notify('', 'Flush Stopped', 'success');
	        }
	    }
	}
}

function testBattery()
{

}

function testLED()
{

}

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
}

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
}

function getOAuthToken()
{
	if(location.protocol == 'http:') {
		notify('', 'OAuth2.0 only supported with HTTPS', 'danger');
		return;
	}
	if (typeof getAuthorizationCode !== 'function') {
        var script = document.createElement('script');
        script.src = 'js/oauth2.js';
        script.onload = function(){ getAuthorizationCode() };
        document.head.appendChild(script);
    } else {
        getAuthorizationCode();
    }
}

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
}

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
    var ssid = document.getElementById('WiFiSSID').getAttribute('value');
    var mode = document.getElementsByName('WiFiMode');
    var hidden = document.getElementById('WiFiHiddenCheckbox').checked;
    var user = document.getElementById('WiFiUsername').getAttribute('value');
    var pass = document.getElementById('WiFiPassword').getAttribute('value');
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

    var qroptions = {
		msg   :  qrstring
		,dim   :   256
		,ecl   :  "M"
	};

	var a = document.getElementById('qrcode');
	a.innerHTML = '';
    
	if (typeof QRCode !== "function") {
	    var script = document.createElement('script');
		script.onload = function() { var qrcode = new QRCode(qroptions); a.appendChild(qrcode) };
		script.src = 'js/qrcode.js';
		document.head.appendChild(script);
	}else{
		var qrcode = new QRCode(qroptions);
		a.appendChild(qrcode);
	}
}

/*
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
*/