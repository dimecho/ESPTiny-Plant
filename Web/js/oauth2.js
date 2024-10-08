function getOAuthToken(oauthCode, oauthScope)
{
	const clientId = getCookie('oauth-clientid');
	const clientSecret = getCookie('oauth-secret');

	if (clientId && clientSecret) {
		if(oauthScope.indexOf('gmail') !=-1) {
        	const postData = {
	          code: oauthCode,
	          client_id: clientId,
	          client_secret: clientSecret,
	          redirect_uri: redirectURL,
	          grant_type: 'authorization_code'
	        };
	        fetch('https://oauth2.googleapis.com/token', {
	          method: 'POST',
	          headers: {
	            'Content-Type': 'application/x-www-form-urlencoded'
	          },
	          body: new URLSearchParams(postData)
	        })
	        .then(response => response.json())
	        .then(data => {
	        //console.log('Tokens:', data);
	        if(data.error) {
		        if (data.error.IndexOf('Bad Request') !=-1) {
		        	notify('','Authorization code incorrect, expired or already used', 'danger');
		        }else if (data.error.IndexOf('OAuth 2.0 policy') !=-1) {
		        	notify('','Check Authorized redirect URIs', 'danger');
		        }
	        }else{
	            let refreshToken = data.refresh_token;
	            const accessToken = data.access_token;
	            if(refreshToken == undefined) { //&prompt=consent
	            	notify('','The Refresh Token is only provided on first authorization', 'danger');
	            }else{
				   	notify('','Received Refresh Token', 'success');
	            }
	            notify('','Received Access Token', 'success');
	          }
	        });
        }
        //https://login.microsoftonline.com/common/v2.0/oauth2/token
    }
}

function getAuthorizationCode()
{
	var smtp = document.getElementById('AlertSMTPServer').value;
	if(smtp == '') {
		notify('', 'Enter SMTP Server', 'danger');
		return;
	}

	$('.modal').modal('hide');
	var modal = new bootstrap.Modal(document.getElementById('oauth-ClientID'));
	modal.show();

	document.getElementById('oauth-json').onclick = function() {
    	if(DEMOLOCK) {
			PlantLogin();
		}else{
        	$('#oauth-file').trigger('click');
    	}
	};
    document.getElementById('oauth-file').addEventListener('change', function(event) {
		const file = event.target.files[0];
		const reader = new FileReader();

		reader.onload = function(event) {
		try {
			const json = JSON.parse(event.target.result);
			console.log("Loaded JSON:", json);

			if (json.web.client_id && json.web.client_secret) {
				document.getElementById('oauth-clientid').value = json.web.client_id;
				document.getElementById('oauth-secret').value = json.web.client_secret;
			} else {
				document.getElementById('AlertTokenError').classList.remove('d-none');
				document.getElementById('AlertTokenError').innerText ="Missing required fields in the JSON file";
			}
		} catch (error) {
			document.getElementById('AlertTokenError').classList.remove('d-none');
			document.getElementById('AlertTokenError').innerText = "Invalid JSON structure or missing fields " + error;
		}
		};

		reader.readAsText(file);
    });
	document.getElementById('oauth-get').onclick = function() {
		if(DEMOLOCK) {
			PlantLogin();
		}else{
			let clientID = document.getElementById('oauth-clientid').value;
			let clientSecret = document.getElementById('oauth-secret').value;

			if (clientID == '' || clientSecret == '') {
				if(smtp.indexOf('gmail.com') != -1) {
		    		document.getElementById('gmail-redirect-uri').textContent = redirectURL;
					document.getElementById('AlertGmailToken').classList.remove('d-none');
					document.getElementById('AlertGmailTokenURL').classList.remove('d-none');
				}else if(smtp.indexOf('office365.com') != -1) {

				}
			}else{
				deleteCookies();
				document.cookie = 'oauth-clientid=' + clientID;
				document.cookie = 'oauth-secret=' + clientSecret;

				if(smtp.indexOf('gmail.com') != -1) {
					location.href = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=' + clientID + '&redirect_uri=' + encodeURIComponent(redirectURL) + '&response_type=code&scope=' + encodeURIComponent('https://www.googleapis.com/auth/gmail.send') + '&prompt=consent&access_type=offline';
				}else if(smtp.indexOf('office365.com') != -1) {
					location.href = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?scope=' + encodeURIComponent('offline_access https://graph.microsoft.com/v1.0/me/sendMail') + '&nonce=abcde&response_mode=fragment&response_type=token&redirect_uri=' + encodeURIComponent(redirectURL) + '&client_id=' + clientID;
				}
			}
		}
	};
}

function getCookie(name) {
  const cookies = document.cookie.split(';');
  for (let i = 0; i < cookies.length; i++) {
    let cookie = cookies[i].trim();
    if (cookie.startsWith(name + '=')) {
      return cookie.substring(name.length + 1);
    }
  }
  return null;
}

