// Login page functionality
document.addEventListener('DOMContentLoaded', function() {
    console.log('Login page loaded');
    
    // Check for email verification link in URL
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    const oobCode = urlParams.get('oobCode');
    const continueUrl = urlParams.get('continueUrl');
    
    if (mode === 'verifyEmail' && oobCode) {
        handleEmailVerification(oobCode, continueUrl);
        return;
    }
    
    // DOM elements
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('loginBtn');
    const btnText = loginBtn.querySelector('.btn-text');
    const spinner = loginBtn.querySelector('.spinner');
    const signupBtn = document.getElementById('signupBtn');
    const forgotPasswordLink = document.getElementById('forgotPassword');
    const errorModal = document.getElementById('errorModal');
    const errorMessage = document.getElementById('errorMessage');
    const closeErrorModal = document.getElementById('closeErrorModal');

    // Check if user is already logged in
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            console.log('User already logged in, redirecting to app');
            window.location.href = 'app.html';
        }
    });

    // Login form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleLogin();
    });

    // Signup button
    signupBtn.addEventListener('click', () => {
        window.location.href = 'pricing.html';
    });

    // Forgot password
    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        handleForgotPassword();
    });

    // Close error modal
    closeErrorModal.addEventListener('click', () => {
        hideErrorModal();
    });

    // Handle login
    async function handleLogin() {
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        if (!email || !password) {
            showError('Please enter both email and password.');
            return;
        }

        try {
            showLoading(true);
            
            // Sign in with Firebase
            const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            console.log('Login successful:', user.email);
            
            // Check subscription status
            const subscriptionStatus = await checkUserSubscription(user.email);
            
            if (subscriptionStatus.hasSubscription) {
                // Redirect to app
                window.location.href = 'app.html';
            } else {
                // No active subscription, redirect to pricing
                showError('Your subscription has expired. Please renew your subscription to continue using Iris Mapper Pro.');
                setTimeout(() => {
                    window.location.href = 'pricing.html';
                }, 3000);
            }
            
        } catch (error) {
            console.error('Login error:', error);
            showError(getErrorMessage(error.code));
        } finally {
            showLoading(false);
        }
    }

    // Check user subscription status
    async function checkUserSubscription(email) {
        try {
            const response = await fetch(`/.netlify/functions/check-subscription?email=${encodeURIComponent(email)}`);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error checking subscription:', error);
            return { hasSubscription: false };
        }
    }

    // Handle forgot password
    async function handleForgotPassword() {
        const email = emailInput.value.trim();
        
        if (!email) {
            showError('Please enter your email address first, then click "Forgot your password?"');
            emailInput.focus();
            return;
        }

        try {
            await firebase.auth().sendPasswordResetEmail(email);
            showError('Password reset email sent! Check your inbox and follow the instructions.', false);
        } catch (error) {
            console.error('Password reset error:', error);
            showError(getErrorMessage(error.code));
        }
    }

    // Show/hide loading state
    function showLoading(loading) {
        loginBtn.disabled = loading;
        if (loading) {
            btnText.style.display = 'none';
            spinner.style.display = 'block';
        } else {
            btnText.style.display = 'block';
            spinner.style.display = 'none';
        }
    }

    // Show error modal
    function showError(message, isError = true) {
        errorMessage.textContent = message;
        const modal = document.querySelector('.modal h3');
        if (!isError) {
            modal.textContent = 'Success';
            modal.style.color = '#0dc5a1';
        } else {
            modal.textContent = 'Authentication Error';
            modal.style.color = '#d32f2f';
        }
        errorModal.classList.add('show');
    }

    // Hide error modal
    function hideErrorModal() {
        errorModal.classList.remove('show');
    }

    // Get user-friendly error messages
    function getErrorMessage(errorCode) {
        switch (errorCode) {
            case 'auth/user-not-found':
                return 'No account found with this email address. Please sign up first.';
            case 'auth/wrong-password':
                return 'Incorrect password. Please try again.';
            case 'auth/invalid-email':
                return 'Please enter a valid email address.';
            case 'auth/user-disabled':
                return 'This account has been disabled. Please contact support.';
            case 'auth/too-many-requests':
                return 'Too many failed attempts. Please try again later.';
            case 'auth/network-request-failed':
                return 'Network error. Please check your internet connection.';
            default:
                return 'Login failed. Please try again.';
        }
    }

    // Close modal on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && errorModal.classList.contains('show')) {
            hideErrorModal();
        }
    });

    // Close modal on backdrop click
    errorModal.addEventListener('click', (e) => {
        if (e.target === errorModal) {
            hideErrorModal();
        }
    });

    // Handle email verification from welcome email
    async function handleEmailVerification(oobCode, continueUrl) {
        console.log('Handling email verification...');
        
        // Show welcome message
        showError('🎉 Welcome to Iris Mapper Pro! Verifying your email...', false);
        
        try {
            // Apply the email verification code
            await firebase.auth().applyActionCode(oobCode);
            
            // Get the current user info
            const result = await firebase.auth().checkActionCode(oobCode);
            const email = result.data.email;
            
            console.log(`Email verified for: ${email}`);
            
            // Show success message with login options
            showWelcomeVerificationSuccess(email);
            
        } catch (error) {
            console.error('Email verification failed:', error);
            showError('Email verification failed. The link may be expired or invalid.');
        }
    }
    
    // Show welcome verification success with login options
    function showWelcomeVerificationSuccess(email) {
        const modalContent = errorModal.querySelector('.modal-content');
        modalContent.innerHTML = `
            <h3 style="color: #0dc5a1; margin-bottom: 20px;">🎉 Welcome to Iris Mapper Pro!</h3>
            <div style="text-align: left; margin: 20px 0;">
                <p style="margin-bottom: 15px;"><strong>Your email has been verified successfully!</strong></p>
                <p style="margin-bottom: 15px;">Email: <strong style="color: #0dc5a1;">${email}</strong></p>
                <p style="margin-bottom: 20px;">You can now set your password and start using the app:</p>
            </div>
            <div style="display: flex; gap: 10px; flex-direction: column;">
                <button id="setPasswordBtn" style="background: #0dc5a1; color: white; border: none; padding: 12px 20px; border-radius: 6px; cursor: pointer; font-size: 16px;">
                    Set Password & Login
                </button>
                <button id="directLoginBtn" style="background: transparent; color: #0dc5a1; border: 2px solid #0dc5a1; padding: 12px 20px; border-radius: 6px; cursor: pointer; font-size: 16px;">
                    Continue to App (Set Password Later)
                </button>
            </div>
        `;
        
        // Add event listeners for the new buttons
        document.getElementById('setPasswordBtn').addEventListener('click', () => {
            hideErrorModal();
            emailInput.value = email;
            passwordInput.focus();
            showError('Please enter a password for your account:', false);
        });
        
        document.getElementById('directLoginBtn').addEventListener('click', async () => {
            hideErrorModal();
            try {
                // Create auto-login token
                const response = await fetch('/.netlify/functions/create-auto-login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email })
                });
                
                const data = await response.json();
                
                if (data.success && data.customToken) {
                    await firebase.auth().signInWithCustomToken(data.customToken);
                    showError('🎉 Welcome! Taking you to the app...', false);
                    setTimeout(() => {
                        window.location.href = 'app.html';
                    }, 1500);
                } else {
                    showError('Please set a password to continue:');
                    emailInput.value = email;
                    passwordInput.focus();
                }
            } catch (error) {
                console.error('Auto-login failed:', error);
                showError('Please set a password to continue:');
                emailInput.value = email;
                passwordInput.focus();
            }
        });
        
        errorModal.classList.add('show');
    }
});