document.addEventListener('DOMContentLoaded', function(event)
{
    new rSlider({
        target: '#pnp',
        values:  ['PNP', 'NPN'],
        range: false,
        tooltip: false,
        scale: true,
        labels: true,
        step: 1,
        set: ['Dirt']
    });
    new rSlider({
   		target: '#timer',
        values: Array.from({ length: 101 }, (_, i) => i),
        range: false,
        tooltip: true,
        scale: false,
        labels: false,
        step: 1,
        set: [2]
        //onChange: function (vals) {
        //    console.log(vals);
        //}
    });
    new rSlider({
        target: '#moisture',
        values: Array.from({ length: 1025 }, (_, i) => i),
        range: false,
        tooltip: true,
        scale: false,
        labels: false,
        step: 1,
        set: [2]
    });
    new rSlider({
        target: '#pot',
        values: Array.from({ length: 121 }, (_, i) => i),
        range: false,
        tooltip: true,
        scale: false,
        labels: false,
        step: 1,
        set: [2]
    });
    new rSlider({
        target: '#power',
        values: Array.from({ length: 31 }, (_, i) => i),
        range: false,
        tooltip: true,
        scale: false,
        labels: false,
        step: 1,
        set: [2]
    });
    new rSlider({
        target: '#soil',
        values: soil_type_labels,
        range: false,
        tooltip: false,
        scale: true,
        labels: true,
        step: 1,
        set: ['Dirt']
    });
    new rSlider({
        target: '#water',
        values: [0,25,50,75,100],
        range: false,
        tooltip: false,
        scale: true,
        labels: true,
        step: 25,
        set: [0]
    });
});
