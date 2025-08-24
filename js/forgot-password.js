// Forgot Password page functionality
document.addEventListener('DOMContentLoaded', function() {
    console.log('Forgot Password page loaded');
    
    // DOM elements
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    const emailInput = document.getElementById('email');
    const resetBtn = document.getElementById('resetBtn');
    const btnText = resetBtn.querySelector('.btn-text');
    const spinner = resetBtn.querySelector('.spinner');
    const messageModal = document.getElementById('messageModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const closeModal = document.getElementById('closeModal');

    // Check if user is already logged in
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            console.log('User already logged in, redirecting to app');
            window.location.href = '/app';
        }
    });

    // Handle URL parameters (email from login page)
    const urlParams = new URLSearchParams(window.location.search);
    const emailFromUrl = urlParams.get('email');
    if (emailFromUrl) {
        emailInput.value = emailFromUrl;
    }

    // Form submission
    forgotPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handlePasswordReset();
    });

    // Close modal
    closeModal.addEventListener('click', () => {
        hideModal();
    });

    // Handle password reset
    async function handlePasswordReset() {
        const email = emailInput.value.trim();

        if (!email) {
            showMessage('Error', 'Please enter your email address.', true);
            return;
        }

        if (!isValidEmail(email)) {
            showMessage('Error', 'Please enter a valid email address.', true);
            return;
        }

        try {
            showLoading(true);
            
            // Send password reset email through Firebase
            await firebase.auth().sendPasswordResetEmail(email, {
                url: 'https://irismapper.com/login',
                handleCodeInApp: false
            });
            
            console.log(`Password reset email sent to: ${email}`);
            
            // Show success message
            showMessage(
                'Email Sent Successfully! 📧', 
                `We've sent password reset instructions to ${email}. Please check your inbox and follow the link to reset your password.\n\nIf you don't see the email, please check your spam folder.`,
                false,
                true // Show return to login button
            );
            
        } catch (error) {
            console.error('Password reset error:', error);
            showMessage('Error', getErrorMessage(error.code), true);
        } finally {
            showLoading(false);
        }
    }

    // Validate email format
    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Show/hide loading state
    function showLoading(loading) {
        resetBtn.disabled = loading;
        emailInput.disabled = loading;
        
        if (loading) {
            btnText.style.display = 'none';
            spinner.style.display = 'block';
        } else {
            btnText.style.display = 'block';
            spinner.style.display = 'none';
        }
    }

    // Show message modal
    function showMessage(title, message, isError = false, showLoginButton = false) {
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        
        // Style the modal based on success/error
        if (isError) {
            modalTitle.style.color = '#d32f2f';
        } else {
            modalTitle.style.color = '#0dc5a1';
        }
        
        // If success, add return to login button
        if (showLoginButton) {
            const modalContent = messageModal.querySelector('.modal-content');
            
            // Remove any existing login button
            const existingBtn = modalContent.querySelector('#returnToLoginBtn');
            if (existingBtn) {
                existingBtn.remove();
            }
            
            // Add return to login button
            const loginButton = document.createElement('button');
            loginButton.id = 'returnToLoginBtn';
            loginButton.className = 'modal-btn';
            loginButton.textContent = 'Return to Sign In';
            loginButton.style.cssText = 'background: #0dc5a1; color: white; margin-left: 10px;';
            
            loginButton.addEventListener('click', () => {
                window.location.href = '/login';
            });
            
            // Insert before the close button
            closeModal.parentNode.insertBefore(loginButton, closeModal.nextSibling);
        }
        
        messageModal.classList.add('show');
    }

    // Hide message modal
    function hideModal() {
        messageModal.classList.remove('show');
        
        // Remove any added buttons
        const loginBtn = document.getElementById('returnToLoginBtn');
        if (loginBtn) {
            loginBtn.remove();
        }
    }

    // Get user-friendly error messages
    function getErrorMessage(errorCode) {
        switch (errorCode) {
            case 'auth/user-not-found':
                return 'No account found with this email address. Please check your email or sign up for a new account.';
            case 'auth/invalid-email':
                return 'Please enter a valid email address.';
            case 'auth/too-many-requests':
                return 'Too many password reset attempts. Please try again later.';
            case 'auth/network-request-failed':
                return 'Network error. Please check your internet connection and try again.';
            case 'auth/user-disabled':
                return 'This account has been disabled. Please contact support for assistance.';
            default:
                return 'Unable to send password reset email. Please try again later or contact support if the problem persists.';
        }
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

    // Focus email input on page load
    emailInput.focus();
});