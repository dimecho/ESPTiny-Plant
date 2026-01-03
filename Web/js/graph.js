var roundEdges = false;
var dataLabels = false;
var dataScroll = true;
var dataStream = false;
var dataAnimation = false;
var graphDivision = 60;
var lineWidth = 3;
var pageLimit = 3;

var LOG_ENABLE = 9;
var LOG_INTERVAL = 10;
var DEEP_SLEEP = 21;
var ESP32 = false;

var refreshTimer;
var refreshSpeed = 10 * 60 * 1000; //10 minutes
var serial = '000';
var chart;
var ctxFont = 14;
var ctxFontColor = 'black';
var ctxGridColor = '#BEBEBE';
var timeSlider;
var data;

document.addEventListener("DOMContentLoaded", function(event)
{
    if((window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        ctxFontColor = '#E8E8E8';
        ctxGridColor = '#808080';
    }

    if(document.cookie != "") {
        var ArrayCookies = {};
        try {
            ArrayCookies = document.cookie.split(";");
            for (i = 0; i < ArrayCookies.length; i++) {
                var c_name = ArrayCookies[i].substr(0, ArrayCookies[i].indexOf("="));
                var c_value = ArrayCookies[i].substr(ArrayCookies[i].indexOf("=") + 1);
                c_name = c_name.replace(/^\s+|\s+$/g, "");
                eval(unescape(c_name) + '=' + unescape(c_value));
            }
        }catch{}
    }

    document.getElementById('roundEdges').checked = roundEdges;
    document.getElementById('dataLabels').checked = dataLabels;
    document.getElementById('dataScroll').checked = dataScroll;
    document.getElementById('dataAnimation').checked = dataAnimation;

    document.getElementById('graphDivision').value = graphDivision;
    document.getElementById('lineWidth').value = lineWidth;
    document.getElementById('pageLimit').value = pageLimit;

    if(dataLabels == true) {
        dataLabels = 'auto';
    }

    if(dataAnimation == true) {
        Chart.defaults.animation.duration = 800;
    }

    Chart.defaults.color = ctxFontColor;
    Chart.defaults.font.size = ctxFont;

    chartdata = {
        labels: initTimeAxis(graphDivision),
        datasets: [{
            type: 'line',
            label: 'Water (%)',
            backgroundColor: 'rgba(0,123,255,0.5)',
            borderColor: 'rgba(0,123,255,1)',
            borderWidth: lineWidth,
            tension: roundEdges ? 1 : 0,
            fill: false,
            data: [],
            datalabels: {
                display: false
            },
            xAxisID: 'x-axis-1',
            yAxisID: 'y-axis-1'
        },{
            type: 'line',
            label: 'Moisture (adc)',
            backgroundColor: 'rgba(220,53,69,0.5)',
            borderColor: 'rgba(220,53,69,1)',
            borderWidth: lineWidth,
            tension: roundEdges ? 1 : 0,
            fill: false,
            data: [],
            datalabels: {
                display: dataLabels
            },
            xAxisID: 'x-axis-0',
            yAxisID: 'y-axis-0'
        }]
    };

    //Chart.register(ChartDataLabels);

    initChart();

    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'log', true);
    xhr.send();
    xhr.onload = function() {
        if (xhr.status == 200) {
            var s = nTrim(xhr.responseText).split('\n');
            //console.log(s);

            chart.data.datasets[0].data = [];
            chart.data.datasets[1].data = [];
            for (var i = 0; i < s.length; i++) {
                if(s[i].indexOf('T:') != -1 || s[i].indexOf('M:') != -1) {
                    chart.data.datasets[1].data.push(s[i]);
                }else if(s[i].indexOf('W:') != -1) {
                    chart.data.datasets[0].data.push(s[i]);
                }
            }
            chart.update();
        }
    }

    window.addEventListener('resize', function() {
        initChart();
    });

    function speed_prettify (n) {
        if (n == 120) {
            return 'Slow';
        }else if (n == 0) {
            return 'Real-Time';
        }
        return n;
    };

    rslider('#chart-time', {
        min: 0,
        max: 20,
        value: 1,
        dashes: 20,
        color: '#2196F3',
        onInput: (v) => {
            document.getElementById('chart-time-text').textContent = v;
        },
        onChange: (v) => {
            if(v == 0) { // Real-time
                refreshSpeed = 1000;
                dataStream = true;
                //xhr.open('GET', 'log?end=1', true);
                //xhr.send();
            }else{
                refreshSpeed = v;
                refreshSpeed *= (1000 * 60);
                //xhr.open('GET', 'nvram.json?offset=' + LOG_INTERVAL + '&value=10', true);
                //xhr.send();

                //TODO: Retrive a page once in a while to prevent WiFi sleep
            }

            if(refreshTimer != null) {
                clearTimeout(refreshTimer);
                updateChart();
            }
        }
    });
    document.getElementById('chart-time-text').textContent = "1";

    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.addEventListener('click', function (event) {
            if (event.target === modal) {
                hideModal(modal);
            }
        });
    });

    document.getElementById('graph-start').onclick = function() {
        //console.log(chart.data.datasets[0].data);
        if(chart.data.datasets[0].data.length > 0) {
            document.getElementById('graph-start-confirm').classList.remove('hidden');
            document.getElementById('modal-backdrop').classList.remove('hidden');
        }else{
            updateChart();
        }
    }
    document.getElementById('graph-clear').onclick = function() {
        var log = new XMLHttpRequest();
        log.open('GET', 'log?end=1', true);
        log.send();
        log.onload = function() {
            if (log.status == 200) {
                if (log.responseText == "...") {
                    notify('', 'Logs Cleaned', 'success');
                }else{
                    notify('', 'Logs Uknown', 'warning');
                }
            }else{
                notify('', 'Logs Failed', 'danger');
            }
        };
    }
    document.getElementById('graph-settings').onclick = function() {
        document.getElementById('graph-settings-open').classList.remove('hidden');
        document.getElementById('modal-backdrop').classList.remove('hidden');
    }
});

function scrollToEnd() {
    const scrollContainer = document.getElementById('scrollContainer');
    scrollContainer.scrollLeft = scrollContainer.scrollWidth - scrollContainer.clientWidth;
}

function saveSettings() {

	roundEdges = document.getElementById('roundEdges').checked;
	dataLabels = document.getElementById('dataLabels').checked;
    dataScroll = document.getElementById('dataScroll').checked;
	dataAnimation = document.getElementById('dataAnimation').checked;
	graphDivision = document.getElementById('graphDivision').value;
	lineWidth = document.getElementById('lineWidth').value;
	pageLimit = document.getElementById('pageLimit').value;
    if(pageLimit < 1)
        pageLimit = 1;

    document.cookie = 'roundEdges=' + roundEdges + '; Path=' + location.pathname;
    document.cookie = 'dataLabels=' + dataLabels + '; Path=' + location.pathname;
    document.cookie = 'dataScroll=' + dataScroll + '; Path=' + location.pathname;
    document.cookie = 'dataAnimation=' + dataAnimation + '; Path=' + location.pathname;
    document.cookie = 'graphDivision=' + graphDivision + '; Path=' + location.pathname;
    document.cookie = 'lineWidth=' + lineWidth + '; Path=' + location.pathname;
    document.cookie = 'pageLimit=' + pageLimit + '; Path=' + location.pathname;

	if(dataLabels == true) {
		dataLabels = 'auto';
	}
    initChart();
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

function exportCSV() {
    var points = idDatasets(chart.data.datasets);
    var value = csvDatasets(chart.data.datasets);
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

    var encodedUri = encodeURI(csvContent);
    var link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'export.csv');
    document.body.appendChild(link); // Required for FF
    link.click();
}

function exportPNG() {

    var canvas = document.getElementById('chartCanvas');

    //ctx.save();
    //ctx.scale(4,4);
    //var render = ctx.canvas.toDataURL('image/jpeg',1.0);
    //ctx.restore();

    var render = canvas.getContext('2d').canvas.toDataURL('image/png', 1.0);
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
}

function initChart() {
    var pages = 1;

    if(chart) {
        pages = chart.data.labels.length / graphDivision;
        //chart.clear();
        chart.destroy();
    }
    //console.log(pages);

    var canvas = document.getElementById('chartCanvas');
    canvas.width = (window.innerWidth * pages) -40;
    canvas.height = window.innerHeight - 140;

    var options = {
        legend: {
            labels: {
                font: {
                    size: ctxFont
                }
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
        animation: {
            onComplete: null,  // Default animations are kept but line animation can be customized
            x: {
                duration: 0  // Disable animation for the x-axis
            },
            y: {
                duration: 0  // Disable animation for the y-axis
            }
        },
        responsive: false, //true,
        maintainAspectRatio: false,
        scales: {
            'x-axis-0': {
                //type: 'linear',
                display: true,
                position: 'bottom',
                title: {
                    display: true,
                    text: 'Time (hh:mm:ss)'
                },
                ticks: {
                    maxRotation: 90,
                    reverse: false
                },
                grid: {
                    drawOnChartArea: true,
                    color: context => context.tick.value == 0 ? "#FF3131" : ctxGridColor
                }
            },
            'x-axis-1': {
                display: false
            },
            'y-axis-0': {
                type: 'linear',
                display: true,
                position: 'right',
                suggestedMin: 0, //auto scale
                suggestedMax: 1024, //auto scale
                title: {
                    display: true,
                    text: chartdata.datasets[1].label
                },
                ticks: {
                    stepSize: 10
                },
                grid: {
                    drawOnChartArea: true,
                    color: context => context.tick.value == 0 ? "#FF3131" : ctxGridColor
                }
            },
            'y-axis-1': {
                type: 'linear',
                display: true,
                position: 'left',
                suggestedMin: 0, //auto scale
                suggestedMax: 100, //auto scale
                title: {
                    display: true,
                    text: chartdata.datasets[0].label
                },
                ticks: {
                    stepSize: 25
                },
                grid: {
                    drawOnChartArea: false
                }
            }
        },
        plugins: {
            datalabels: {
                backgroundColor: function(context) {
                    return context.dataset.backgroundColor;
                },
                borderRadius: 2,
                color: ctxFontColor,
                font: ctxFont,
                padding: 2
            }
        }
    };

    chart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: chartdata,
        options: options
    });
}

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
}

function csvDatasets(dataset) {
    row = [];
    for (var i = 0, l = dataset.length; i < l; i++) {
        row.push(dataset[i].data);
    }
    console.log(row);
    return row;
}

function stopChart() {
    clearTimeout(refreshTimer);
    if(dataStream){
        notify('', 'Stopping Data Stream ...', 'warning');
    }
}

function startChart() {

    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'log?start=1', true);
    xhr.send();
    xhr.onload = function() {
        if (xhr.status == 200) {
            //console.log(xhr.responseText);

            chart.data.datasets[0].data = [];
            chart.data.datasets[1].data = [];
            chart.update();

            clearTimeout(refreshTimer);
            updateChart();
        }
    }
}

function initTimeAxis(seconds, labels) {

    var xaxis = [];

    if(dataScroll)
        return xaxis;

    if(labels)
        xaxis = labels;

    for (var i = 0; i < seconds; i++) {
    	xaxis.push('');
    }
    return xaxis;
}

function adjustChart() {

    var l = chart.data.datasets[0].data.length;
    var limit = graphDivision * pageLimit;

    //Scroll
    if (l >= limit) {
        var p = graphDivision;
        if(dataScroll) {
            p = 1;
        }
        //console.log('end limit ' + p);
        for (var x = 0; x < p; x++) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
            chart.data.datasets[1].data.shift();
        }
        l = chart.data.datasets[0].data.length;
    }
    if (l >= graphDivision && l >= chart.data.labels.length) {
        //console.log('add page');
        initTimeAxis(graphDivision, chart.data.labels);
        initChart();
        scrollToEnd();
    }
    
    //console.log(l);
    return l;
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function updateChart() {
    //Debug
    //dataStream = false;
    //refreshSpeed = 100;

    var xhr = new XMLHttpRequest();
    if(dataStream) {
        var refresh = 0;
        xhr.open('GET', 'api?stream=' + graphDivision, true);
        xhr.onprogress = function(e) {
            var value = e.currentTarget.response.split('\n');
            for (var x = 0; x < value.length-1; x++) {
                var s = value[x].split(':');
                if (!dataScroll) {
                    var l = adjustChart();
                }
                setTimeout(function(water, moisture, a, b) {
                    if (dataScroll) {
                        a = adjustChart();
                    }
                    var d = new Date();
                    if (dataScroll) {
                        chart.data.labels.push(d.getHours() + ':' + d.getMinutes() + ':' + d.getSeconds());
                    }else{
                        chart.data.labels[a+b] = d.getHours() + ':' + d.getMinutes() + ':' + d.getSeconds();
                    }
                    chart.data.datasets[0].data.push(water);
                    chart.data.datasets[1].data.push(moisture);
                    chart.update();
                    
                }, 100 * refresh, s[0], s[1], l, x);
                refresh++;
            }
        }
        xhr.onload = function() {
            refresh-=2;
            refreshTimer = setTimeout(function() {
                updateChart();
            }, 100 * refresh);
        }
    }else{
        xhr.open('GET', 'api?adc=1', true);
        xhr.onload = function() {
            if (xhr.status == 200) {
                var l = adjustChart();
                var d = new Date();
                if (dataScroll) {
                    chart.data.labels.push(d.getHours() + ':' + d.getMinutes() + ':' + d.getSeconds());
                }else{
                    chart.data.labels[l] = d.getHours() + ':' + d.getMinutes() + ':' + d.getSeconds();
                }
                let arr = (xhr?.responseText || '|').split('|');
                var value = parseInt(arr[0]) || getRandomInt(100, 1024);
                chart.data.datasets[1].data.push(value);
            
                var h2o = new XMLHttpRequest();
                h2o.open('GET', 'api?adc=2', true);
                h2o.send();
                h2o.onload = function() {
                    if (h2o.status == 200) {
                        var v = parseInt(h2o.responseText) || 0;
                        chart.data.datasets[0].data.push(v);
                        chart.update();
                    }
                    refreshTimer = setTimeout(function() {
                        updateChart();
                    }, refreshSpeed);
                }
            }
        }
    }
    xhr.send();
}
