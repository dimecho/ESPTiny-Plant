/*
https://github.com/SnippetsDevelop/snippetsdevelop.github.io/blob/master/codes/Circular-Slider.html
*/

function roundSliderInit(options) {
  let knob = document.querySelector(".roundslider-knob");
  let circle = document.getElementById("roundslider-progress-circle");
  let pointer = document.querySelector(".roundslider-pointer");
  let text = document.querySelector(".roundslider-text");

  let isRotating = true;
  let minValue = options.min;
  let maxValue = options.max;
  
  document.addEventListener('dragstart', function(event) {
    event.preventDefault();
    //event.stopPropagation();
  });
  
  document.addEventListener("mousedown", (e) => {
    if (e.target.closest(".roundslider-knob")) {
      isRotating = true;
    }
  });

  const rotateKnob = (e) => {

    if (isRotating) {

      let rotationAngle = 0;
      let progressPercent = 0;

      if(e.value != undefined){
        progressPercent = (e.value - minValue) / (maxValue - minValue)
        rotationAngle = progressPercent * 270
      }else{

        let knobX = knob.getBoundingClientRect().left + knob.clientWidth / 2;
        let knobY = knob.getBoundingClientRect().top + knob.clientHeight / 2;

        let deltaX = e.clientX - knobX;
        let deltaY = e.clientY - knobY;

        let angleRad = Math.atan2(deltaY, deltaX);
        let angleDeg = (angleRad * 180) / Math.PI;

        rotationAngle = (angleDeg - 135 + 360) % 360;
      }

      if (rotationAngle <= 270) {
        pointer.style.transform = `rotate(${rotationAngle - 45}deg)`;

        let progressPercent = rotationAngle / 270;

        circle.style.strokeDashoffset = `${880 - 660 * progressPercent}`;

        let mappedValue = minValue + (progressPercent * (maxValue - minValue));

        //text.innerHTML = `${Math.round(progressPercent * 100)}`;
        text.innerHTML = `${Math.round(mappedValue)}`;
      }
    }
  };
  rotateKnob({value:options.value});
  isRotating = false;

  document.addEventListener("mousemove", rotateKnob);

  document.addEventListener("mouseup", () => {
    isRotating = false;
  });
}