// Email Verification page functionality
document.addEventListener('DOMContentLoaded', function() {
    console.log('Email Verification page loaded');
    
    // DOM elements
    const loadingState = document.getElementById('loadingState');
    const successState = document.getElementById('successState');
    const errorState = document.getElementById('errorState');
    const mainTitle = document.getElementById('mainTitle');
    const subtitle = document.getElementById('subtitle');
    const successMessage = document.getElementById('successMessage');
    const errorMessage = document.getElementById('errorMessage');
    const countdown = document.getElementById('countdown');
    const continueBtn = document.getElementById('continueBtn');
    const retryBtn = document.getElementById('retryBtn');

    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    const oobCode = urlParams.get('oobCode');
    const continueUrl = urlParams.get('continueUrl');

    // Security check - must have valid parameters
    if (!oobCode || mode !== 'verifyEmail') {
        showError('Invalid verification link', 'This verification link is invalid or incomplete. Please check your email for the correct link.');
        return;
    }

    // Auto-verify on page load
    verifyEmail();

    // Continue button handler
    continueBtn.addEventListener('click', () => {
        window.location.href = '/login';
    });

    // Retry button handler
    retryBtn.addEventListener('click', async () => {
        const email = prompt('Please enter your email address to resend verification:');
        if (email) {
            await requestNewVerification(email);
        }
    });

    // Main verification function
    async function verifyEmail() {
        try {
            console.log('Starting email verification...');
            
            // Apply the email verification code
            await firebase.auth().applyActionCode(oobCode);
            
            // Get info about the action code
            const info = await firebase.auth().checkActionCode(oobCode);
            const email = info.data.email;
            
            console.log(`Email verified successfully for: ${email}`);
            
            // Show success state
            showSuccess(email);
            
            // Start countdown and redirect
            startCountdown();
            
        } catch (error) {
            console.error('Email verification failed:', error);
            handleVerificationError(error);
        }
    }

    // Show success state
    function showSuccess(email) {
        loadingState.style.display = 'none';
        errorState.style.display = 'none';
        successState.style.display = 'block';
        
        mainTitle.textContent = 'Success!';
        subtitle.textContent = 'Your email has been verified';
        successMessage.textContent = `Welcome to Iris Mapper Pro! Your account (${email}) is now active.`;
    }

    // Show error state
    function showError(title, message) {
        loadingState.style.display = 'none';
        successState.style.display = 'none';
        errorState.style.display = 'block';
        
        mainTitle.textContent = 'Verification Failed';
        subtitle.textContent = title;
        errorMessage.textContent = message;
    }

    // Handle specific verification errors
    function handleVerificationError(error) {
        let title = 'Verification Failed';
        let message = 'Unable to verify your email. ';
        
        switch (error.code) {
            case 'auth/expired-action-code':
                message += 'This verification link has expired. Please request a new verification email.';
                break;
            case 'auth/invalid-action-code':
                message += 'This verification link is invalid or has already been used.';
                break;
            case 'auth/user-disabled':
                message += 'This account has been disabled. Please contact support.';
                break;
            case 'auth/user-not-found':
                message += 'No account found. The user may have been deleted.';
                break;
            default:
                message += 'Please try again or contact support if the problem persists.';
        }
        
        showError(title, message);
    }

    // Request new verification email
    async function requestNewVerification(email) {
        try {
            // Show loading
            errorState.style.display = 'none';
            loadingState.style.display = 'block';
            subtitle.textContent = 'Sending new verification email...';
            
            // Get current user or send verification
            const user = firebase.auth().currentUser;
            
            if (user && user.email === email) {
                await user.sendEmailVerification({
                    url: window.location.origin + '/login'
                });
            } else {
                // Try to sign in first to get the user
                // This would need proper implementation based on your auth flow
                throw new Error('Please sign in first to resend verification');
            }
            
            // Show success
            loadingState.style.display = 'none';
            showError('Email Sent', `A new verification email has been sent to ${email}. Please check your inbox.`);
            
        } catch (error) {
            console.error('Failed to send verification:', error);
            showError('Failed to Send Email', error.message || 'Unable to send verification email. Please try again later.');
        }
    }

    // Countdown and redirect
    function startCountdown() {
        let seconds = 3;
        
        const countdownInterval = setInterval(() => {
            seconds--;
            countdown.textContent = `Redirecting to login in ${seconds} second${seconds !== 1 ? 's' : ''}...`;
            
            if (seconds <= 0) {
                clearInterval(countdownInterval);
                window.location.href = continueUrl || '/login';
            }
        }, 1000);
    }

    // Add enter key support for retry
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && errorState.style.display !== 'none') {
            retryBtn.click();
        }
    });
});