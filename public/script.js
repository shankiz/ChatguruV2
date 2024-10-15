try {
    const messagesContainer = document.getElementById('messages');
    const userInput = document.getElementById('user-input');
    const fileInput = document.getElementById('file-input');
    const sendButton = document.getElementById('send-button');
    const uploadButton = document.getElementById('upload-button');
    const cameraButton = document.getElementById('camera-button');
    const cameraModal = document.getElementById('camera-modal');
    const cameraFeed = document.getElementById('camera-feed');
    const captureButton = document.getElementById('capture-button');
    const closeCameraButton = document.getElementById('close-camera-button');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    const imagePreview = document.getElementById('image-preview');
    const deleteImageButton = document.getElementById('delete-image');
    const refreshButton = document.getElementById('refresh-button');
    const logoutButton = document.getElementById('logout-button');
    const themeToggle = document.getElementById('theme-toggle');
    const rootElement = document.documentElement;

    let chatId = Date.now().toString();
    let stream;
    let currentImageData = null;
    let currentFacingMode = 'environment';

    function addMessage(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role === 'You' ? 'user-message' : ''}`;

        messageDiv.innerHTML = `
            <div class="avatar">${role === 'You' ? 'U' : 'AI'}</div>
            <div class="content">${content}</div>
        `;
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function formatAIResponse(content) {
        content = content.replace(/\*/g, '');
        const paragraphs = content.split('\n\n');
        const formattedParagraphs = paragraphs.map(paragraph => {
            if (paragraph.includes('\n- ')) {
                const listItems = paragraph.split('\n- ').filter(item => item.trim() !== '');
                return `<ul>${listItems.map(item => `<li>${item.trim()}</li>`).join('')}</ul>`;
            } else if (paragraph.includes(':')) {
                const [title, ...rest] = paragraph.split(':');
                return `<p><strong>${title.trim()}:</strong>${rest.join(':')}</p>`;
            } else {
                return `<p>${paragraph}</p>`;
            }
        });
        return formattedParagraphs.join('');
    }

    function addLoader() {
        const loaderDiv = document.createElement('div');
        loaderDiv.className = 'message';
        loaderDiv.innerHTML = `
            <div class="avatar">AI</div>
            <div class="content">
                <div class="loader"></div>
            </div>
        `;
        messagesContainer.appendChild(loaderDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        return loaderDiv;
    }

    function showImagePreview(imageData) {
        imagePreview.src = imageData;
        imagePreviewContainer.style.display = 'block';
        currentImageData = imageData;
    }

    function logout() {
        fetch('/logout', { method: 'POST' })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    window.location.href = '/';
                } else {
                    alert('Logout failed. Please try again.');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('An error occurred during logout. Please try again.');
            });
    }

    function updateUserInfo() {
        return fetch('/user')
            .then(res => res.json())
            .then(data => {
                updateUserProfile(data);
                return data;
            })
            .catch(error => {
                console.error('Error fetching user data:', error);
                window.location.href = '/'; // Redirect to login if not authenticated
            });
    }

    function updateUserProfile(userData) {
        const firstName = userData.name.split(' ')[0];
        document.getElementById('user-name-display').textContent = firstName;
        document.getElementById('profile-name').textContent = userData.name;
        document.getElementById('profile-email').textContent = userData.email;
        document.getElementById('profile-credits').textContent = userData.credits;
        document.getElementById('user-avatar').src = userData.picture || 'default-avatar.png';
        document.getElementById('user-credits').textContent = userData.credits;
        getReferralCode();
        startReferralCheck();
    }

    function toggleProfileDropdown() {
        const dropdown = document.getElementById('profile-dropdown');
        dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    }

    async function sendMessage(messageObj) {
        const loaderDiv = addLoader();
        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    chat_id: chatId,
                    message: messageObj
                }),
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();
            loaderDiv.remove(); // Remove the loader
            addMessage('AI', data.response);
            document.getElementById('user-credits').textContent = data.creditsLeft;
            document.getElementById('profile-credits').textContent = data.creditsLeft;
        } catch (error) {
            console.error('Error:', error);
            loaderDiv.remove(); // Remove the loader even if there's an error
            addMessage('Error', 'Failed to get response from the server.');
        }
    }

    function handleSend() {
        const message = userInput.value.trim();
        if (message || currentImageData) {
            let messageContent = '';

            if (currentImageData) {
                messageContent += `<img src="${currentImageData}" style="max-width: 200px; max-height: 200px;">`;
            }

            if (message) {
                messageContent += `<p>${message}</p>`;
            }

            addMessage('You', messageContent);

            sendMessage({ text: message, image_url: currentImageData });

            userInput.value = '';
            clearImagePreview();
        }
    }

    function handleFileUpload(file) {
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                showImagePreview(e.target.result);
            };
            reader.readAsDataURL(file);
        }
    }

    function resetConversation() {
        messagesContainer.innerHTML = '';
        clearImagePreview();
        chatId = Date.now().toString();
        const userName = document.getElementById('user-name-display').textContent;
        addMessage('AI', `Hello ${userName}! How can I assist you today?`);
    }

    function clearImagePreview() {
        imagePreview.src = '';
        imagePreviewContainer.style.display = 'none';
        currentImageData = null;
    }

    function closeCameraModal() {
        cameraModal.style.display = 'none';
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        currentFacingMode = 'environment'; // Reset to default rear camera
    }

    function debugLog(message) {
        console.log(`[DEBUG] ${message}`);
    }

    function initializeTheme() {
        const savedTheme = localStorage.getItem('theme');
        debugLog(`Initializing theme. Saved theme: ${savedTheme}`);
        if (savedTheme === 'light') {
            rootElement.classList.add('light-mode');
            themeToggle.checked = true;
        }
    }

    if (themeToggle) {
        debugLog('Theme toggle found. Attaching event listener.');
        themeToggle.addEventListener('click', function(event) {
            debugLog(`Theme toggle clicked. Checked: ${this.checked}`);
            if (this.checked) {
                rootElement.classList.add('light-mode');
                localStorage.setItem('theme', 'light');
                debugLog('Light mode applied');
            } else {
                rootElement.classList.remove('light-mode');
                localStorage.setItem('theme', 'dark');
                debugLog('Dark mode applied');
            }
        });
    } else {
        debugLog('Theme toggle not found in the DOM');
    }

    const themeSlider = document.querySelector('.slider');
    if (themeSlider) {
        debugLog('Theme slider found. Attaching click event.');
        themeSlider.addEventListener('click', function(event) {
            event.preventDefault();
            themeToggle.checked = !themeToggle.checked;
            debugLog(`Theme slider clicked. New toggle state: ${themeToggle.checked}`);
            if (themeToggle.checked) {
                rootElement.classList.add('light-mode');
                localStorage.setItem('theme', 'light');
                debugLog('Light mode applied');
            } else {
                rootElement.classList.remove('light-mode');
                localStorage.setItem('theme', 'dark');
                debugLog('Dark mode applied');
            }
        });
    } else {
        debugLog('Theme slider not found in the DOM');
    }

    window.addEventListener('DOMContentLoaded', (event) => {
        debugLog('DOM fully loaded and parsed');
        initializeTheme();
    });

    window.onload = function() {
        updateUserInfo().then(() => {
            debugLog('User info updated');
            const userName = document.getElementById('user-name-display').textContent;
            if (userName) {
                addMessage('AI', `Hello ${userName}! How can I assist you today?`);
            } else {
                addMessage('AI', 'Hello! How can I assist you today?');
            }
        }).catch(error => {
            console.error('Error updating user info:', error);
            addMessage('AI', 'Hello! How can I assist you today?');
        });

        debugLog('Window loaded');
        if (themeToggle) {
            debugLog('Theme toggle found in the DOM after window load');
        } else {
            debugLog('Theme toggle not found in the DOM after window load');
        }
    };

    document.getElementById('profile-header').addEventListener('click', toggleProfileDropdown);
    logoutButton.addEventListener('click', logout);
    sendButton.addEventListener('click', handleSend);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSend();
    });
    uploadButton.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => handleFileUpload(e.target.files[0]));

    // Updated camera-related event listeners
    cameraButton.addEventListener('click', openCamera);
    captureButton.addEventListener('click', captureImage);
    closeCameraButton.addEventListener('click', closeCameraModal);
    document.getElementById('rotate-camera-button').addEventListener('click', rotateCamera);

    deleteImageButton.addEventListener('click', clearImagePreview);
    document.getElementById('new-chat-button').addEventListener('click', resetConversation);
    document.getElementById('get-credits-button').addEventListener('click', function() {
        alert('This feature is coming soon!');
    });

    themeToggle.addEventListener('change', toggleTheme);

    async function getReferralCode() {
        try {
            const response = await fetch('/referral-code');
            const data = await response.json();
            document.getElementById('referral-link').textContent = data.referralLink;
            checkClaimableReferrals();
        } catch (error) {
            console.error('Error fetching referral code:', error);
        }
    }

    async function checkClaimableReferrals() {
        try {
            const response = await fetch('/claimable-referrals');
            const data = await response.json();
            console.log("Claimable referrals data:", data);
            const claimButton = document.getElementById('claim-referral');
            const referralStatus = document.getElementById('referral-status');

            if (data.claimableReferrals > 0) {
                claimButton.disabled = false;
                claimButton.classList.add('active');
                referralStatus.textContent = `${data.claimableReferrals} people signed up through your link. You can now claim ${data.claimableReferrals * 30} credits!`;
            } else {
                claimButton.disabled = true;
                claimButton.classList.remove('active');
                referralStatus.textContent = "No signups at the moment. Invite friends and earn 30 credits for each one who joins!";
            }
        } catch (error) {
            console.error('Error checking claimable referrals:', error);
        }
    }

    async function claimReferralCredits() {
        try {
            const response = await fetch('/claim-referral', { method: 'POST' });
            const data = await response.json();
            if (data.success) {
                alert(`Referral credits claimed! You earned ${data.claimedCredits} credits. New credit balance: ${data.newCredits}`);
                document.getElementById('user-credits').textContent = data.newCredits;
                document.getElementById('profile-credits').textContent = data.newCredits;
                checkClaimableReferrals();
            } else {
                alert(data.message || "No credits to claim at this time.");
            }
        } catch (error) {
            console.error('Error claiming referral credits:', error);
            alert('An error occurred while claiming referral credits.');
        }
    }

    document.getElementById('copy-referral-link').addEventListener('click', () => {
        const referralLink = document.getElementById('referral-link').textContent;
        navigator.clipboard.writeText(referralLink)
            .then(() => alert('Referral link copied to clipboard!'))
            .catch(err => console.error('Error copying referral link:', err));
    });

    document.getElementById('claim-referral').addEventListener('click', claimReferralCredits);

    function startReferralCheck() {
        checkClaimableReferrals();
        setInterval(checkClaimableReferrals, 60000);
    }

    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('claim-referral').addEventListener('click', claimReferralCredits);
    });

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
        .then(res => res.json())
        .then(data => {
            if (data.success) {                window.location.href = '/chat';
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

                    // New camera-related functions
                    async function openCamera() {
                        try {
                            const constraints = {
                                video: { facingMode: currentFacingMode }
                            };
                            stream = await navigator.mediaDevices.getUserMedia(constraints);
                            cameraFeed.srcObject = stream;
                            cameraModal.style.display = 'block';
                        } catch (err) {
                            console.error("Error accessing the camera", err);
                            alert("Error accessing the camera. Please make sure you've granted camera permissions.");
                        }
                    }

                    async function rotateCamera() {
                        currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
                        if (stream) {
                            stream.getTracks().forEach(track => track.stop());
                        }
                        await openCamera();
                    }

                    function captureImage() {
                        const canvas = document.createElement('canvas');
                        canvas.width = cameraFeed.videoWidth;
                        canvas.height = cameraFeed.videoHeight;
                        canvas.getContext('2d').drawImage(cameraFeed, 0, 0);
                        const imageDataUrl = canvas.toDataURL('image/jpeg');
                        showImagePreview(imageDataUrl);
                        closeCameraModal();
                    }

                    function toggleTheme() {
                        const isLightMode = themeToggle.checked;
                        if (isLightMode) {
                            rootElement.classList.add('light-mode');
                            localStorage.setItem('theme', 'light');
                        } else {
                            rootElement.classList.remove('light-mode');
                            localStorage.setItem('theme', 'dark');
                        }
                        console.log(`Theme changed to: ${isLightMode ? 'light' : 'dark'}`);
                    }

                } catch (error) {
                    console.error('An error occurred in the script:', error);
                }

