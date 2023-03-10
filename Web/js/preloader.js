window.requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame || function(callback) {
    window.setTimeout(callback, 1000 / 60);
};

window.transitionEnd = function(element, callback) {
    var transitions = ["transition", "WebkitTransition", "MozTransition", "msTransition"];
    var div = document.createElement("div");
    var transitionProp = null;

    for (var i = 0; i < transitions.length; i++) {
        if (div.style[transitions[i]] !== undefined) {
            transitionProp = transitions[i];
            break;
        }
    }
    if (transitionProp) {
        element.addEventListener(transitionProp + "end", function(event) {
            element.removeEventListener(transitionProp + "end", arguments.callee);
            callback(event, element);
        });
    } else {
        //setTimeout(function() {
            callback(null, element);
        //}, 0);
    }
    return element;
}

var Preloader = {
    overlay: null,
    loader: null,
    name: null,
    percentage: null,
    on_complete: null,
    total: 0,
    loaded: 0,
    image_queue: [],
    percentage_loaded: 0,
    images: [],
    show_progress: 1,
    show_percentage: 1,
    background: "#000000",
    timeout: 10,
    init: function() {
        var images = document.getElementsByTagName("img");
        for (var i = 0; i < images.length; i++) {
            var src = images[i].getAttribute("src");
            if (src) {
                this.images.push(src);
            }
        }
        this.total = this.images.length;
        Preloader.build();
        Preloader.load();
    },
    build: function() {
        this.overlay = document.getElementById("preloader");
        this.overlay.classList.add("preloader_progress");
        this.overlay.style.backgroundColor = this.background;

        this.progress_loader = document.createElement("div");
        this.progress_loader.classList.add("preloader_loader");
        this.overlay.appendChild(this.progress_loader);

        this.progress_loader_meter = document.createElement("div");
        this.progress_loader_meter.classList.add("preloader_meter");
        this.progress_loader.appendChild(this.progress_loader_meter);

        if (this.show_progress) {
            this.percentage = document.createElement("div");
            this.percentage.classList.add("preloader_percentage");
            this.percentage.textContent = "0";
            this.overlay.appendChild(this.percentage);
        }
    },
    load: function() {
        this.percentage.dataset.num = 0;
        this.images.forEach(function(imageUrl) {
            var image = new Image();
            image.src = imageUrl;
            image.onload = function() {
                Preloader.imageOnLoad(imageUrl);
            }
            image.onerror = function() {
                Preloader.imageOnLoad(imageUrl);
            }
        });
        setTimeout(function() {
            Preloader.overlay && Preloader.animatePercentage(this.percentage_loaded,100);
        }, this.images.length ? 1000 * this.timeout : 0);
    },
    animatePercentage: function(start, end) {
        this.percentage_loaded = start;
        /*
        if (start < end) {
            start++;
            setTimeout(function() {
                if (Preloader.show_progress) {
                    var percentageText = start + (Preloader.show_percentage ? "%" : "");
                    Preloader.percentage.textContent = percentageText;
                }
                Preloader.progress_loader_meter.style.width = start + "%";
                Preloader.animatePercentage(start, end);
            }, 5);
            if (start === 100) {
                Preloader.loadFinish();
            }
        }
        */
        var animate = function() {
            start++;
            Preloader.percentage_loaded = start;
            if (Preloader.show_progress) {
                Preloader.percentage.textContent = start + (Preloader.show_percentage ? "%" : "");
            }
            Preloader.progress_loader_meter.style.width = start + "%";
            if (start < end) {
                window.requestAnimationFrame(animate);
            } else if (start === 100) {
                Preloader.loadFinish();
            }
        }
        window.requestAnimationFrame(animate);
    },
    imageOnLoad: function(a) {
        this.image_queue.push(a);
        this.image_queue.length && this.image_queue[0] === a && Preloader.processQueue();
    },
    reQueue: function() {
        this.image_queue.splice(0,1);
        Preloader.processQueue();
    },
    processQueue: function() {
        0 !== this.image_queue.length && (this.loaded++, Preloader.animatePercentage(this.percentage_loaded, parseInt(this.loaded / this.total * 100, 10)), Preloader.reQueue());
    },
    loadFinish: function() {
        transitionEnd(this.overlay, function(a, c) {
            Preloader.overlay && (Preloader.overlay.remove(), Preloader.overlay = null);
        });
        this.overlay.classList.add("complete");
        document.body.classList.remove("preloader");
        this.on_complete && this.on_complete();
    }
}

function ready(callback) {
    // in case the document is already rendered
    if (document.readyState != 'loading') callback();
    else if (document.addEventListener) document.addEventListener('DOMContentLoaded', callback);
    else document.attachEvent('onreadystatechange', function() {
        if (document.readyState == 'complete') callback();
    });
}

ready(function() {
    Preloader.init();
});

function switchTheme(element, dark, light) {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    var e = document.querySelectorAll(element + '.' + light);
    for (var i = 0; i < e.length; i++) {
      e[i].classList.remove(light);
      e[i].classList.add(dark);
    }
  } else {
    var e = document.querySelectorAll(element + '.' + dark);
    for (var i = 0; i < e.length; i++) {
      e[i].classList.remove(dark);
      e[i].classList.add(light);
    }
  }
}

function loadTheme() {
    if((window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.getElementById('cssBootstrap').href = 'css/bootstrap.slate.css';
    }else{
        document.getElementById('cssBootstrap').href = 'css/bootstrap.css';
    }
    switchTheme('div','bg-primary','bg-light');
    switchTheme('div','text-white','text-dark');
    switchTheme('img','bg-secondary','bg-light');
    switchTheme('button', 'btn-close-white', 'btn-close-dark');
}

function graphTheme() {
    if((window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        ctxFontColor = 'white';
        ctxGridColor = '#707070';           
    }
}

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
    });
}

