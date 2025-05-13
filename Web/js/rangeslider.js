class RangeSlider {
    constructor(element) {
        this.element = element;
        this.min = parseFloat(element.dataset.min) || 0;
        this.max = parseFloat(element.dataset.max) || 100;
        this.step = parseFloat(element.dataset.step) || 1;
        this.defaultValue = parseFloat(element.dataset.default) || this.min;
        this.id = element.dataset.id; // Unique identifier for the slider
        this.isDragging = false;
        this.handleWidth = 24; // Handle width in pixels (w-6 = 24px in Tailwind)
        this.currentValue = this.defaultValue; // Store current value
        this.init();
    }

    init() {
        // Create slider components
        this.element.innerHTML = `
            <div class="relative">
                <div class="h-2 bg-gray-300 rounded-full">
                    <div class="h-full bg-blue-500 rounded-full slider-progress" style="width: 0%"></div>
                </div>
                <div class="absolute w-6 h-6 bg-blue-500 rounded-full -top-2 cursor-pointer shadow-md slider-handle border border-gray-500" style="left: 0%"></div>
            </div>
        `;

        this.handle = this.element.querySelector('.slider-handle');
        this.progress = this.element.querySelector('.slider-progress');
        this.track = this.handle.parentElement;
        this.valueDisplay = this.element.parentElement.querySelector('.slider-value');

        // Set initial value
        this.setValue(this.defaultValue);
        this.addEventListeners();
    }

    getTrackBounds() {
        const rect = this.track.getBoundingClientRect();
        return { left: rect.left, width: rect.width };
    }

    setValue(value) {
        // Ensure value is within bounds and aligns with step
        value = Math.max(this.min, Math.min(this.max, value));
        value = Math.round(value / this.step) * this.step;
        this.currentValue = value; // Update current value
        
        // Calculate position (0 to 1)
        const position = (value - this.min) / (this.max - this.min);
        
        // Adjust handle position to keep circle within track bounds
        const trackWidth = this.getTrackBounds().width;
        const maxPositionPercentage = ((trackWidth - this.handleWidth) / trackWidth) * 100;
        const adjustedPercentage = position * maxPositionPercentage;
        
        // Adjust progress to extend to handle's center
        const handleCenterOffset = (this.handleWidth / 2) / trackWidth * 100;
        this.handle.style.left = `${adjustedPercentage}%`;
        this.progress.style.width = `calc(${adjustedPercentage}% + ${handleCenterOffset}px)`;
        this.valueDisplay.textContent = value.toFixed(this.step % 1 === 0 ? 0 : 2);
    }

    getValue() {
        return this.currentValue; // Public method to get current value
    }

    updateSlider(clientX) {
        const { left, width } = this.getTrackBounds();
        let position = (clientX - left) / width;
        position = Math.max(0, Math.min(1, position));

        // Calculate scaled value
        const value = this.min + position * (this.max - this.min);
        this.setValue(value);
    }

    addEventListeners() {
        // Mouse Events
        this.handle.addEventListener('mousedown', () => {
            this.isDragging = true;
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                this.updateSlider(e.clientX);
            }
        });

        document.addEventListener('mouseup', () => {
            this.isDragging = false;
        });

        // Touch Events
        this.handle.addEventListener('touchstart', () => {
            this.isDragging = true;
        });

        document.addEventListener('touchmove', (e) => {
            if (this.isDragging) {
                this.updateSlider(e.touches[0].clientX);
            }
        });

        document.addEventListener('touchend', () => {
            this.isDragging = false;
        });
    }
}