/**
     * rslider - Simple horizontal slider library
     * @param {string|HTMLElement} container - CSS selector or DOM element
     * @param {Object} options - Configuration options
     * @returns {Object} - Slider instance with methods
     */
    function rslider(container, options = {}) {
      const el = typeof container === 'string' 
        ? document.querySelector(container) 
        : container;
      
      if (!el) {
        console.error('rslider: Container not found');
        return null;
      }
      
      // Default options
      const config = {
        min: options.min || 0,
        max: options.max || 100,
        value: options.value || 50,
        color: options.color || '#4CAF50',
        dashes: options.dashes || false,
        onChange: options.onChange || null,
        onInput: options.onInput || null
      };
      
      // Create slider elements
      el.className = 'relative w-full flex items-center my-5';
      
      let dashesHTML = '';
      if (config.dashes) {
        const numDashes = typeof config.dashes === 'number' ? config.dashes : 5;
        dashesHTML = '<div class="absolute w-full h-full flex justify-between items-center">';
        for (let i = 0; i < numDashes; i++) {
          dashesHTML += '<div class="w-0.5 h-2.5 bg-gray-400 rounded-sm"></div>';
        }
        dashesHTML += '</div>';
      }
      
      el.innerHTML = `
        <div class="absolute w-full h-1.5 bg-gray-200 rounded-full"></div>
        ${dashesHTML}
        <div class="rslider-fill absolute h-1.5 rounded-full transition-all duration-75 ease-out"></div>
        <div class="rslider-handle absolute w-6 h-6 border-4 border-white rounded-full cursor-grab shadow-md transition-transform duration-100 ease-out hover:scale-110 active:scale-115 z-10"></div>
      `;
      
      const handle = el.querySelector('.rslider-handle');
      const fill = el.querySelector('.rslider-fill');
      
      // Apply custom color
      handle.style.background = config.color;
      fill.style.background = config.color;
      
      let isDragging = false;
      let currentValue = config.value;
      
      function valueToPercentage(val) {
        const range = config.max - config.min;
        if (range === 0) return 0;
        return ((val - config.min) / range) * 100;
      }
      
      function percentageToValue(pct) {
        return config.min + (pct / 100) * (config.max - config.min);
      }
      
      function updateSlider(clientX, triggerChange = false) {
        const rect = el.getBoundingClientRect();
        const handleWidth = handle.offsetWidth;
        const x = clientX - rect.left;
        const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
        
        currentValue = Math.round(percentageToValue(percentage));
        
        // Calculate position with handle centered on the percentage point
        const centerPosition = (percentage / 100) * rect.width;
        const position = Math.max(handleWidth / 2, Math.min(rect.width - handleWidth / 2, centerPosition));
        
        handle.style.left = `${position - handleWidth / 2}px`;
        fill.style.width = `${position}px`;
        
        if (config.onInput) {
          config.onInput(currentValue);
        }
        
        if (triggerChange && config.onChange) {
          config.onChange(currentValue);
        }
      }
      
      function onMouseDown(e) {
        isDragging = true;
        document.body.classList.add('rslider-dragging');
        updateSlider(e.clientX);
      }
      
      function onMouseMove(e) {
        if (!isDragging) return;
        e.preventDefault();
        updateSlider(e.clientX);
      }
      
      function onMouseUp(e) {
        if (isDragging) {
          updateSlider(e.clientX, true);
          document.body.classList.remove('rslider-dragging');
        }
        isDragging = false;
      }
      
      // Mouse events
      handle.addEventListener('mousedown', onMouseDown);
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      
      // Touch events
      handle.addEventListener('touchstart', (e) => {
        isDragging = true;
        document.body.classList.add('rslider-dragging');
        updateSlider(e.touches[0].clientX);
      });
      
      document.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        updateSlider(e.touches[0].clientX);
      });
      
      document.addEventListener('touchend', (e) => {
        if (isDragging && e.changedTouches.length > 0) {
          updateSlider(e.changedTouches[0].clientX, true);
          document.body.classList.remove('rslider-dragging');
        }
        isDragging = false;
      });
      
      // Initialize slider position with proper dimension checking
      function initializePosition() {
        // Check if element has dimensions
        if (el.offsetWidth === 0) {
          // If no width yet, wait a bit longer or observe for resize
          requestAnimationFrame(initializePosition);
          return;
        }
        
        const initialPercentage = valueToPercentage(currentValue);
        const handleWidth = handle.offsetWidth;
        const trackWidth = el.offsetWidth;
        
        // Calculate center position based on percentage
        const centerPosition = (initialPercentage / 100) * trackWidth;
        const position = Math.max(handleWidth / 2, Math.min(trackWidth - handleWidth / 2, centerPosition));
        
        handle.style.left = `${position - handleWidth / 2}px`;
        fill.style.width = `${position}px`;
      }
      
      // Start initialization
      setTimeout(initializePosition, 0);
      
      // Public API
      return {
        getValue: () => currentValue,
        setValue: (val) => {
          currentValue = Math.max(config.min, Math.min(config.max, val));
          const percentage = valueToPercentage(currentValue);
          const handleWidth = handle.offsetWidth;
          const trackWidth = el.offsetWidth;
          
          // Calculate center position based on percentage
          const centerPosition = (percentage / 100) * trackWidth;
          const position = Math.max(handleWidth / 2, Math.min(trackWidth - handleWidth / 2, centerPosition));
          
          handle.style.left = `${position - handleWidth / 2}px`;
          fill.style.width = `${position}px`;
        },
        refresh: () => {
          // Recalculate and redraw slider position
          initializePosition();
        },
        destroy: () => {
          handle.removeEventListener('mousedown', onMouseDown);
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          el.innerHTML = '';
        }
      };
    }