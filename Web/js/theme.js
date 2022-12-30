function switchTheme(element,dark,light) {
    
    if((window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        var e = document.querySelectorAll(element + '.' + light);
        e.forEach((child) => {
            child.classList.remove(light);
            child.classList.add(dark);
        });
    }else{
        var e = document.querySelectorAll(element + '.' + dark);
        e.forEach((child) => {
            child.classList.remove(dark);
            child.classList.add(light);
        });
    }
};

function loadTheme() {

    if((window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.getElementById('cssBootstrap').href = 'css/bootstrap.slate.css'
    }else{
        document.getElementById('cssBootstrap').href = 'css/bootstrap.css'
    }
    switchTheme('div','bg-primary','bg-light');
    switchTheme('div','text-white','text-dark');
    switchTheme('img','bg-secondary','bg-light');
    switchTheme('button', 'btn-close-white', 'btn-close-dark');
};

function graphTheme() {

    if((window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        ctxFontColor = 'white';
        ctxGridColor = '#707070';           
    }
};

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
    })
};

