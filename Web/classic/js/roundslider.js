function RoundSlider(container, options) {
  options = options || {};
  var el = typeof container === 'string' ? document.querySelector(container) : container;
  if (!el) throw new Error('Container not found');
  
  var opt = {
    min: options.min !== undefined ? options.min : 0,
    max: options.max !== undefined ? options.max : 100,
    value: options.value !== undefined ? options.value : 50,
    radius: options.radius || 125,
    color: options.color || '#ff6b35',
    colorEnd: options.colorEnd || '#ffa500',
    borderColor: options.borderColor || 'rgba(255,255,255,0.2)',
    borderWidth: options.borderWidth !== undefined ? options.borderWidth : 5,
    bgColor: options.backgroundColor || 'rgba(255,255,255,0.1)',
    handleColor: options.handleColor || 'white',
    textColor: options.textColor || 'white',
    onChange: options.onChange || null,
    onComplete: options.onComplete || null
  };
  
  var isDragging = false, value = opt.value, handle, progress, valueDisplay;
  
  // Inject styles once
  if (!document.getElementById('rs-styles')) {
    var s = document.createElement('style');
    s.id = 'rs-styles';
    s.textContent = '.rs-container{position:relative;display:inline-block}.rs-track{position:absolute;width:100%;height:100%;border-radius:50%;box-shadow:0 8px 32px rgba(0,0,0,.3);box-sizing:border-box}.rs-progress{position:absolute;border-radius:50%}.rs-value{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:56px;font-weight:700;user-select:none;text-shadow:0 2px 10px rgba(0,0,0,.3)}.rs-handle{position:absolute;width:32px;height:32px;border-radius:50%;box-shadow:0 4px 12px rgba(0,0,0,.3);cursor:grab;transform:translate(-50%,-50%);transition:transform .1s,box-shadow .2s}.rs-handle:hover{transform:translate(-50%,-50%) scale(1.1);box-shadow:0 6px 16px rgba(0,0,0,.4)}.rs-handle:active{cursor:grabbing;transform:translate(-50%,-50%) scale(1.05)}';
    document.head.appendChild(s);
  }
  
  // Create elements
  var size = opt.radius * 2;
  el.className = 'rs-container';
  el.style.cssText = 'width:' + size + 'px;height:' + size + 'px';
  
  var track = document.createElement('div');
  track.className = 'rs-track';
  track.style.cssText = 'background:' + opt.bgColor + ';border:' + opt.borderWidth + 'px solid ' + opt.borderColor;
  
  progress = document.createElement('div');
  progress.className = 'rs-progress';
  var inset = opt.borderWidth;
  progress.style.cssText = 'width:calc(100% - ' + (inset*2) + 'px);height:calc(100% - ' + (inset*2) + 'px);top:' + inset + 'px;left:' + inset + 'px';
  
  valueDisplay = document.createElement('div');
  valueDisplay.className = 'rs-value';
  valueDisplay.style.color = opt.textColor;
  
  handle = document.createElement('div');
  handle.className = 'rs-handle';
  handle.style.cssText = 'background:' + opt.handleColor + ';border:3px solid rgba(0,0,0,.1)';
  
  el.appendChild(track);
  el.appendChild(progress);
  el.appendChild(valueDisplay);
  el.appendChild(handle);
  
  // Update slider
  function update(val) {
    value = Math.round(Math.max(opt.min, Math.min(opt.max, val)));
    var pct = ((value - opt.min) / (opt.max - opt.min)) * 100;
    var angle = (pct / 100) * 360 + 180;
    var rad = angle * Math.PI / 180;
    var r = opt.radius - opt.borderWidth;
    
    handle.style.left = (opt.radius + r * Math.cos(rad)) + 'px';
    handle.style.top = (opt.radius + r * Math.sin(rad)) + 'px';
    progress.style.background = 'conic-gradient(from 270deg,' + opt.color + ' 0deg,' + opt.colorEnd + ' ' + (pct*3.6) + 'deg,transparent ' + (pct*3.6) + 'deg)';
    valueDisplay.textContent = value;
    
    if (opt.onChange) opt.onChange(value);
  }
  
  // Get angle from event
  function getAngle(e) {
    var rect = el.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    var clientX = e.clientX || (e.touches && e.touches[0].clientX);
    var clientY = e.clientY || (e.touches && e.touches[0].clientY);
    var angle = Math.atan2(clientY - cy, clientX - cx);
    var deg = (angle * 180 / Math.PI) + 180;
    if (deg < 0) deg += 360;
    return ((deg / 360) * (opt.max - opt.min)) + opt.min;
  }
  
  // Events
  function drag(e) {
    if (!isDragging) return;
    e.preventDefault();
    update(getAngle(e));
  }
  
  function stop() { 
    if (isDragging && opt.onComplete) {
      opt.onComplete(value);
    }
    isDragging = false;
  }
  
  handle.addEventListener('mousedown', function(e) { isDragging = true; e.preventDefault(); });
  handle.addEventListener('touchstart', function(e) { isDragging = true; e.preventDefault(); }, {passive: false});
  document.addEventListener('mousemove', drag);
  document.addEventListener('touchmove', drag, {passive: false});
  document.addEventListener('mouseup', stop);
  document.addEventListener('touchend', stop);
  
  update(value);
  
  // Public API
  this.setValue = update;
  this.getValue = function() { return value; };
  this.destroy = function() {
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('touchmove', drag);
    document.removeEventListener('mouseup', stop);
    document.removeEventListener('touchend', stop);
    el.innerHTML = '';
    el.className = '';
  };
}

if (typeof window !== 'undefined') window.RoundSlider = RoundSlider;
