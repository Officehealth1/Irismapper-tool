// Setup Password page functionality for new users
document.addEventListener('DOMContentLoaded', function() {
    console.log('Setup Password page loaded');
    
    // DOM elements
    const setupPasswordForm = document.getElementById('setupPasswordForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const setupBtn = document.getElementById('setupBtn');
    const btnText = setupBtn.querySelector('.btn-text');
    const spinner = setupBtn.querySelector('.spinner');
    const messageModal = document.getElementById('messageModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const closeModal = document.getElementById('closeModal');
    const emailDisplay = document.getElementById('emailDisplay');

    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    let currentToken = tokenFromUrl;
    let validatedEmail = null;

    // Validate token on page load
    if (!tokenFromUrl) {
        showMessage('Error', 'Invalid or missing setup link. Please use the link from your email.', true);
        emailInput.parentElement.style.display = 'none';
        setupPasswordForm.style.display = 'none';
        return;
    }

    // Validate token with backend
    validateToken();

    // Form submission
    setupPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handlePasswordSetup();
    });

    // Close modal
    closeModal.addEventListener('click', () => {
        hideModal();
    });

    // Validate token function
    async function validateToken() {
        try {
            showLoading(true);
            btnText.textContent = 'Validating...';
            
            const response = await fetch('/.netlify/functions/validate-setup-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token: tokenFromUrl })
            });

            const data = await response.json();
            
            if (data.valid) {
                validatedEmail = data.email;
                emailInput.value = data.email;
                emailDisplay.textContent = `Create password for ${data.email}`;
                setupPasswordForm.style.display = 'block';
                passwordInput.focus();
                showLoading(false);
                btnText.textContent = 'Create Account & Sign In';
            } else {
                setupPasswordForm.style.display = 'none';
                showMessage('Invalid Link', data.error || 'This setup link is invalid or has expired.', true);
                showLoading(false);
            }
        } catch (error) {
            console.error('Token validation error:', error);
            setupPasswordForm.style.display = 'none';
            showMessage('Error', 'Unable to validate setup link. Please try again.', true);
            showLoading(false);
        }
    }

    // Handle password setup
    async function handlePasswordSetup() {
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        const confirmPassword = confirmPasswordInput.value.trim();

        // Validation
        if (!email || !password || !confirmPassword) {
            showMessage('Error', 'Please fill in all fields.', true);
            return;
        }

        if (password.length < 6) {
            showMessage('Error', 'Password must be at least 6 characters long.', true);
            return;
        }

        if (password !== confirmPassword) {
            showMessage('Error', 'Passwords do not match. Please try again.', true);
            return;
        }

        try {
            showLoading(true);
            
            // Call the Netlify function to set up the password
            const response = await fetch('/.netlify/functions/setup-user-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: email,
                    password: password,
                    token: currentToken
                })
            });

            const data = await response.json();
            
            if (response.ok && data.success) {
                console.log('Password set successfully');
                
                // Sign in with the custom token
                if (data.customToken) {
                    await firebase.auth().signInWithCustomToken(data.customToken);
                    console.log('Signed in with custom token');
                }
                
                showSuccessAndRedirect();
            } else {
                throw new Error(data.error || 'Failed to set password');
            }
            
        } catch (error) {
            console.error('Password setup error:', error);
            showMessage('Error', error.message || 'Failed to set up password. Please try again.', true);
        } finally {
            showLoading(false);
        }
    }

    // Show success and redirect to app
    function showSuccessAndRedirect() {
        showMessage(
            'Welcome to IrisMapper! 🎉', 
            'Your account is set up successfully. Taking you to the app...',
            false
        );
        
        setTimeout(() => {
            window.location.href = '/app';
        }, 2000);
    }

    // Show/hide loading state
    function showLoading(loading) {
        setupBtn.disabled = loading;
        passwordInput.disabled = loading;
        confirmPasswordInput.disabled = loading;
        
        if (loading) {
            btnText.style.display = 'none';
            spinner.style.display = 'block';
        } else {
            btnText.style.display = 'block';
            spinner.style.display = 'none';
        }
    }

    // Show message modal
    function showMessage(title, message, isError = false) {
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        
        // Style the modal based on success/error
        if (isError) {
            modalTitle.style.color = '#d32f2f';
        } else {
            modalTitle.style.color = '#0dc5a1';
        }
        
        messageModal.classList.add('show');
    }

    // Hide message modal
    function hideModal() {
        messageModal.classList.remove('show');
    }


    // Close modal on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && messageModal.classList.contains('show')) {
            hideModal();
        }
    });

    // Close modal on backdrop click
    messageModal.addEventListener('click', (e) => {
        if (e.target === messageModal) {
            hideModal();
        }
    });
});