<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Login - AI Nexus</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700&family=Roboto:wght@300;400;500&display=swap" rel="stylesheet">
    <script src="https://accounts.google.com/gsi/client" async defer></script>
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        html, body {
            height: 100%;
            overflow: hidden;
        }
        body {
            font-family: 'Roboto', sans-serif;
            background-color: #020b1a;
            color: #a0e4ff;
            display: flex;
            justify-content: center;
            align-items: center;
            background-image: 
                radial-gradient(circle at 10% 20%, rgba(6, 124, 250, 0.1) 0%, transparent 20%),
                radial-gradient(circle at 90% 80%, rgba(6, 124, 250, 0.1) 0%, transparent 20%);
            background-attachment: fixed;
        }
        .login-container {
            width: 90%;
            max-width: 400px;
            text-align: center;
            padding: 30px 20px;
            background-color: rgba(4, 32, 55, 0.8);
            border-radius: 20px;
            box-shadow: 0 0 20px rgba(0, 195, 255, 0.2);
        }
        h1 {
            color: #00c3ff;
            font-size: 1.8em;
            font-weight: 700;
            font-family: 'Orbitron', sans-serif;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin-bottom: 20px;
        }
        p {
            color: #68d5ff;
            margin-bottom: 30px;
            font-size: 0.9em;
        }
        .g_id_signin {
            display: flex;
            justify-content: center;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <h1>Welcome to AI Nexus</h1>
        <p>Please sign in to continue</p>
        <div id="g_id_onload"
             data-client_id="514245604873-etsihper83o1d1cbi9pmhfm2hbifov9m.apps.googleusercontent.com"
             data-context="signin"
             data-ux_mode="popup"
             data-callback="handleCredentialResponse"
             data-auto_prompt="false">
        </div>
        <div id="googleSignInButton"></div>
    </div>

    <script>
        function getUrlParameter(name) {
            name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
            var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
            var results = regex.exec(location.search);
            return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
        }

        function handleCredentialResponse(response) {
            console.log("Received credential response", response);
            const referralCode = getUrlParameter('ref');
            fetch('/auth/google', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token: response.credential, referralCode })
            })
            .then(res => {
                console.log("Received response from server", res);
                return res.json();
            })
            .then(data => {
                console.log("Parsed response data", data);
                if (data.success) {
                    console.log('Redirecting to /chat...');
                    window.location.href = '/chat';
                } else {
                    console.error('Sign-in failed:', data.message);
                    alert('Login failed. Please try again.');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('An error occurred. Please try again.');
            });
        }

        window.onload = function() {
            google.accounts.id.initialize({
                client_id: '514245604873-etsihper83o1d1cbi9pmhfm2hbifov9m.apps.googleusercontent.com',
                callback: handleCredentialResponse
            });
            
            google.accounts.id.renderButton(
                document.getElementById("googleSignInButton"),
                { 
                    type: "standard",
                    theme: "outline", 
                    size: "large",
                    text: "signin_with",
                    shape: "rectangular",
                    logo_alignment: "left"
                }
            );

            // Optionally, you can also add One Tap prompt
            google.accounts.id.prompt();
        };
    </script>
</body>
</html>
