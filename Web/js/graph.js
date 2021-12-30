var roundEdges = true;
var showDataLabels = true;
var showAnimation = false;
var graphDivision = 60;
var lineWidth = 3;
var pageLimit = 4;

var chart_datasets = [{
	type: 'line',
	label: 'ADC Value',
	backgroundColor: 'rgba(220,53,69,0.5)',
	borderColor: 'rgba(220,53,69,1)',
	borderWidth: lineWidth,
    fill: false,
	data: [],
	yAxisID: 'y-axis-0'
}, {
	type: 'line',
	label: 'H2O %',
	backgroundColor: 'rgba(0,123,255,0.5)',
	borderColor: 'rgba(0,123,255,1)',
	borderWidth: lineWidth,
    fill: false,
	data: [],
	yAxisID: 'y-axis-1'
}];

var refreshSpeed = 10 * 60 * 1000; //10 minutes
var refreshTimer;

var serial = '000';
var chart;
var ctxAxis;
var ctx;
var ctxFont = 12;
var ctxFontColor = 'black';
var ctxGridColor = '#BEBEBE';

document.addEventListener("DOMContentLoaded", function(event)
{
    loadTheme();

	buildGraphMenu();

	graphTheme();

    graphSettings();

    var canvas = $('#chartCanvas');
    ctx = canvas.get(0).getContext('2d');
	ctxAxis = $('#chartAxis').get(0).getContext('2d');

    if(navigator.userAgent.toLowerCase().match(/mobile/i)) {

        Chart.defaults.animationSteps = 0;
        canvas[0].height = 800;
        ctxFont = 40;
        graphDivision = 40;

    }else{
        Chart.defaults.animationSteps = 12;
        canvas[0].height = 640;
    }

    initChart();

    //ctx.fillStyle = 'white';
    /*
    ctx.webkitImageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    ctx.imageSmoothingEnabled = false;
    */
});

function graphSettings(save) {

	if(save) {
		roundEdges = $('input[name*="roundEdges"]').is(':checked');
		showDataLabels = $('input[name*="showDataLabels"]').is(':checked');
		showAnimation = $('input[name*="showAnimation"]').is(':checked');
		graphDivision = $('input[name*="graphDivision"]').val();
		lineWidth = $('input[name*="lineWidth"]').val();
		pageLimit = $('input[name*="pageLimit"]').val();
		
		setCookie('graph.roundedges', roundEdges, 1);
		setCookie('graph.datalabels', showDataLabels, 1);
		setCookie('graph.animation', showAnimation, 1);
		setCookie('graph.division', graphDivision, 1);
		setCookie('graph.border', lineWidth, 1);
		setCookie('graph.pages', pageLimit, 1);

	}else{
		$('input[name*="roundEdges"]').prop('checked', roundEdges);
		$('input[name*="showDataLabels"]').prop('checked', showDataLabels);
		$('input[name*="showAnimation"]').prop('checked', showAnimation);
		$('input[name*="graphDivision"]').val(graphDivision);
		$('input[name*="lineWidth"]').val(lineWidth);
		$('input[name*="pageLimit"]').prop('checked', pageLimit);
	}

	if(showDataLabels == true) {
		showDataLabels = 'auto';
	}
};

function buildGraphMenu() {

    var menu = $('#buildGraphMenu'); //.empty();
    var menu_buttons = $('#buildGraphButtons'); //.empty();
    var export_buttons = $('#buildGraphExport'); //.empty();

	var btn_start = $('<button>', { class: 'btn btn-success mr-4' }).append('Start Graph');
    var btn_stop = $('<button>', { class: 'btn btn-danger mr-4' }).append('Stop Graph');
    
    var e_settings = $('<i>', { class: 'icons icon-settings h1 ml-4', 'data-toggle': 'tooltip', 'title': 'Settings' });
    var e_img = $('<i>', { class: 'icons icon-png h1 ml-4', onClick: 'exportPNG()', 'data-toggle': 'tooltip', 'title': 'Export Image' });
    var e_csv = $('<i>', { class: 'icons icon-csv h1 ml-4', onClick: 'exportCSV()', 'data-toggle': 'tooltip', 'title': 'Export CSV' });

    var s = $('#buildGraphSlider').empty();
    var input_speed = $('<input>', { id: 'speed', type: 'text', 'data-provide': 'slider'} );
    s.append(input_speed);

    btn_start.click(function() {
        btn_start.prop('disabled', true);
        if(chart.data.datasets[0].data.length > 0) {
            var modal = new bootstrap.Modal(document.getElementById('graphStartConfirm'));
            modal.show();
        }else{
        	updateChart();
        }
    });

    btn_stop.click(function() {
        stopChart();
        btn_start.prop('disabled', false);
    });

 	e_settings.click(function() {
 		window.location.href = '#graphSettings';
		document.getElementById('graphSettings').style.display = 'block';
    });

    function speed_prettify (n) {
        if (n == 120) {
            return 'Slow';
        }else if (n == 1) {
            return 'Fast';
        }
        return n;
    };
    
    input_speed.ionRangeSlider({
        skin: 'big',
        grid: true,
        step: 1,
        min: 1,
        max: 120,
        from: (refreshSpeed / 60 / 1000),
        prettify: speed_prettify,
        postfix: ' Minutes',
        onFinish: function (e) {

            refreshSpeed = e.from * 60 * 1000; //1000 = second
            //console.log(refreshSpeed);

            if(btn_start[0].disabled == true) {

            	var xhr = new XMLHttpRequest();
    			//xhr.open('GET', 'nvram?offset=9&value=10', true);
    			//xhr.send();

    			xhr.open('GET', 'nvram?offset=20&value=' + (e.from * 60), true);
    			xhr.send();

                //if (xhr) xhr.abort();
                clearTimeout(refreshTimer);
                updateChart();
            }
        }
    });
	
    menu_buttons.append(btn_start);
    menu_buttons.append(btn_stop);

    export_buttons.append(e_settings);
    export_buttons.append(e_img);
    export_buttons.append(e_csv);

    pageLimit = graphDivision * pageLimit;
};

function exportCSV() {

    var datasets = chart_datasets;
    var points = idDatasets(datasets);
    var value = csvDatasets(datasets);
    //console.log(value);

    let csvContent = 'data:text/csv;charset=utf-8,';

    let row = value[0].length;
    let col = points.length;

    for (var r = 0; r < row; r++) {
        if(r == 0) { //first row
            csvContent += points.join(',') + '\r\n';
        }
        for (var c = 0; c < col; c++) {
            //TODO: get timestamp
            csvContent += value[c][r] + ',';
        }
        csvContent += '\r\n';
    }

    //var encodedUri = encodeURI(csvContent);
    //window.open(encodedUri);

    var encodedUri = encodeURI(csvContent);
    var link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'export.csv');
    document.body.appendChild(link); // Required for FF
    link.click();
};

function exportPNG() {

    //ctx.save();
    //ctx.scale(4,4);
    //var render = ctx.canvas.toDataURL('image/jpeg',1.0);
    //ctx.restore();

    var render = ctx.canvas.toDataURL('image/png', 1.0);
    var d = new Date();
    //d.setHours(10, 30, 53, 400);

    var data = atob(render.substring('data:image/png;base64,'.length)),
        asArray = new Uint8Array(data.length);

    for (var i = 0, len = data.length; i < len; ++i) {
        asArray[i] = data.charCodeAt(i);
    }
    var blob = new Blob([asArray.buffer], { type: 'image/png' });

    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'graph ' + d.getDate() + '-' + (d.getMonth() + 1) + '-' + d.getFullYear() + ' ' + (d.getHours() % 12 || 12) + '-' + d.getMinutes() + ' ' + (d.getHours() >= 12 ? 'pm' : 'am') + '.png';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 0);
};

function initChart() {

    var data = {
        labels: initTimeAxis(graphDivision),
        datasets: chart_datasets
    };

    var options = {
        legend: {
            labels: {
                fontColor: ctxFontColor,
                fontSize: ctxFont
            }
        },
        elements: {
            point: {
                radius: 0
            }
        },
        tooltips: {
            enabled: false
        },
        responsive: true,
        hoverMode: 'index',
        stacked: false,
        maintainAspectRatio: false,
        scales: {
            'x-axis-0': {
                //type: 'linear',
                display: true,
                position: 'bottom',
                scaleLabel: {
                    display: false,
                    fontColor: ctxFontColor,
                    fontSize: ctxFont,
                    labelString: 'Time (hh:mm:ss)'
                },
                ticks: {
                    fontColor: ctxFontColor,
                    fontSize: ctxFont,
                    maxRotation: 90,
                    reverse: false
                },
                gridLines: {
                    drawOnChartArea: true,
                    color: ctxGridColor
                }
            },
            'y-axis-0': {
                type: 'linear',
                display: true,
                position: 'left',
                suggestedMin: 0, //auto scale
                suggestedMax: 100, //auto scale
                scaleLabel: {
                    display: true,
                    fontColor: ctxFontColor,
                    fontSize: ctxFont,
                    labelString: data.datasets[0].label
                },
                ticks: {
                    fontColor: ctxFontColor,
                    fontSize: ctxFont,
                    //stepSize: 10
                },
                gridLines: {
                    drawOnChartArea: true,
                    color: ctxGridColor,
                    zeroLineColor: ctxFontColor,
                    //zeroLineWidth: 2
                }
            },
            'y-axis-1': {
                type: 'linear',
                display: true,
                position: 'right',
                suggestedMin: 0, //auto scale
                suggestedMax: 60, //auto scale
                scaleLabel: {
                    display: true,
                    fontColor: ctxFontColor,
                    fontSize: ctxFont,
                    labelString: data.datasets[1].label
                },
                ticks: {
                    fontColor: ctxFontColor,
                    fontSize: ctxFont,
                    stepSize: 10
                },
                gridLines: {
                    drawOnChartArea: false,
                    color: ctxGridColor,
                    zeroLineColor: ctxFontColor,
                    //zeroLineWidth: 2
                }
            }
        }
    };

    if(chart) {
        chart.clear();
        chart.destroy();
    }
    
    if(roundEdges == false) {
		Chart.defaults.elements.line.tension = 0;
	}
	if(showAnimation == true) {
		Chart.defaults.animation.duration = 800;
	}

    chart = new Chart(ctx, {
        type: 'line',
        data: data,
        options: options
    });
    //chart.update();

    var xhr = new XMLHttpRequest();
    xhr.onload = function() {
        if (xhr.status == 200) {
            var s = nTrim(xhr.responseText).split('\n');
            console.log(s);

            chart.data.datasets[0].data = [];
            for (var i = 0; i < s.length; i++) {
            	if(s[i].indexOf(':') == -1) {
            		chart.data.datasets[0].data.push(s[i]);
            	}
            }
            chart.update();

            resizeChart();
        }
    }
    xhr.open('GET', 'data.log', true);
    xhr.send();
    
    $('.chartAreaWrapper2').width($('.chartAreaWrapper').width());
};

function nTrim(n) {
  return n.replace(/^\s+|\s+$/gm,'');
}

function idDatasets(dataset) {
	ids = [];
	for (var i = 0, l = dataset.length; i < l; i++) {
		if(dataset[i].label)
			ids.push(dataset[i].label);
	}
	console.log(ids);
	return ids;
};

function csvDatasets(dataset) {
    row = [];
    for (var i = 0, l = dataset.length; i < l; i++) {
        row.push(dataset[i].data);
    }
    console.log(row);
    return row;
};

function stopChart() {

    //if (xhr) xhr.abort();
    clearTimeout(refreshTimer);
};

function startChart() {

    var xhr = new XMLHttpRequest();
    xhr.onload = function() {
        if (xhr.status == 200) {
            console.log(xhr.responseText);

            chart.data.datasets[0].data = [];
            chart.data.datasets[1].data = [];
            chart.update();
           
            updateChart();
        }
    }
    xhr.open('GET', 'clearlog', true);
    xhr.send();
};

function initTimeAxis(seconds, labels, stamp) {

    var xaxis = [];

    if(labels)
        xaxis = labels;

    for (var i = 0; i < seconds; i++) {
    	if (stamp != undefined) {
    		if (stamp == 0) {
	    		xaxis.push(i);
	    	}else{
	    		if (i % 10 == 0) {
		    		if (stamp == 1) {
		    			xaxis.push(i);
		    		}else{
		    			xaxis.push(i + ' ' + stamp);
		    		}
	    		}
    		}
    	}else{
    		xaxis.push('');
    	}
        /*
        if (i / 10 % 1 != 0) {
            xaxis.push('');
        } else {
            xaxis.push(i);
        }
        */
        //xaxis.push(i.toString());
    }
    return xaxis;
};

function updateChart() {

    console.log(refreshSpeed);
    clearTimeout(refreshTimer);

    var xhr = new XMLHttpRequest();
    xhr.onload = function() {
        if (xhr.status == 200) {
            var adc = parseInt(xhr.responseText);
            var ref = adc / 1023;
            var v = 5 * (ref * 1.1); // Calculate Vcc from 5V
            var h2o = Math.round(ref * 100 / 2.0); //scientific value (actual H2O inside soil)
            console.log(adc + ' ' + h2o);

            chart.data.datasets[0].data.push(adc);
            chart.data.datasets[1].data.push(h2o);
            //console.log(data.datasets[0].data);
            
            /*
            var l = data.datasets[0].data.length;
            //Scroll
            if (l == data.labels.length) {
                initTimeAxis(graphDivision, data.labels);
				resizeChart();
            }else if (l > pageLimit) {
                //console.log('Max scroll pages ...reset');
                for (var x = 0; x <= last; x++) {
                    data.datasets[x].data = []; //empty
                }
                data.labels = initTimeAxis(graphDivision);
                $('.chartAreaWrapper2').width($('.chartAreaWrapper').width());
                //$('.chartAreaWrapper2').height($('.chartAreaWrapper').height());
            }
            
            //Time-stamp
            if (l / 10 % 1 == 0) {
                var d = new Date();
                var hr = d.getHours();
                //console.log(l);
                data.labels[l] = hr + ':' + d.getMinutes() + ':' + d.getSeconds();
            }
            */

            chart.update();

            refreshTimer = setTimeout(function() {
                updateChart();
            }, refreshSpeed);
        }else{
        	$.iGrowl({ type: 'error', message:  'HTTP Error ' + xhr.status});
        }
    }
    xhr.open('GET', 'adc', true);
    xhr.send();
};

function resizeChart()
{
    var newwidth = $('.chartAreaWrapper').width() + chart.width;
    $('.chartAreaWrapper2').width(newwidth);
    $('.chartAreaWrapper').animate({scrollLeft:newwidth}, 1000);
    
    var copyWidth = chart.scales['y-axis-0'].width - 10;
    var copyHeight = chart.scales['y-axis-0'].height + chart.scales['y-axis-0'].top + 10;
    ctxAxis.canvas.height = copyHeight;
    ctxAxis.canvas.width = copyWidth;
    ctxAxis.drawImage(chart.chart.canvas, 0, 0, copyWidth, copyHeight, 0, 0, copyWidth, copyHeight);
};

function isEmpty( el ){
    return !$.trim(el.html())
};

Array.prototype.max = function() {
  return Math.max.apply(null, this);
};

Array.prototype.min = function() {
  return Math.min.apply(null, this);
};
