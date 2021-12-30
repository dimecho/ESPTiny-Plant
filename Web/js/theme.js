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
