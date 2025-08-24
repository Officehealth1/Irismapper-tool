// Reset Password page functionality
document.addEventListener('DOMContentLoaded', function() {
    console.log('Reset Password page loaded');
    
    // DOM elements
    const resetPasswordForm = document.getElementById('resetPasswordForm');
    const newPasswordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const resetBtn = document.getElementById('resetBtn');
    const btnText = resetBtn.querySelector('.btn-text');
    const spinner = resetBtn.querySelector('.spinner');
    const messageModal = document.getElementById('messageModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const closeModal = document.getElementById('closeModal');
    const emailDisplay = document.getElementById('emailDisplay');

    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const oobCode = urlParams.get('oobCode');
    const mode = urlParams.get('mode');

    if (!oobCode || mode !== 'resetPassword') {
        showMessage('Error', 'Invalid or expired password reset link.', true);
        return;
    }

    // Verify the reset code and get email
    verifyResetCode();

    // Form submission
    resetPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handlePasswordReset();
    });

    // Close modal
    closeModal.addEventListener('click', () => {
        hideModal();
    });

    // Verify the reset code
    async function verifyResetCode() {
        try {
            // Check if the code is valid and get the email
            const info = await firebase.auth().verifyPasswordResetCode(oobCode);
            emailDisplay.textContent = `Create new password for ${info}`;
            console.log('Reset code verified for:', info);
        } catch (error) {
            console.error('Invalid reset code:', error);
            showMessage('Error', 'This password reset link is invalid or has expired. Please request a new one.', true, true);
        }
    }

    // Handle password reset
    async function handlePasswordReset() {
        const newPassword = newPasswordInput.value.trim();
        const confirmPassword = confirmPasswordInput.value.trim();

        // Validation
        if (!newPassword || !confirmPassword) {
            showMessage('Error', 'Please fill in both password fields.', true);
            return;
        }

        if (newPassword.length < 6) {
            showMessage('Error', 'Password must be at least 6 characters long.', true);
            return;
        }

        if (newPassword !== confirmPassword) {
            showMessage('Error', 'Passwords do not match. Please try again.', true);
            return;
        }

        try {
            showLoading(true);
            
            // Confirm the password reset
            await firebase.auth().confirmPasswordReset(oobCode, newPassword);
            
            console.log('Password reset successful');
            
            // Show success message
            showMessage(
                'Password Updated Successfully! ✅', 
                'Your password has been updated. You can now sign in with your new password.',
                false,
                true // Show login button
            );
            
        } catch (error) {
            console.error('Password reset error:', error);
            showMessage('Error', getErrorMessage(error.code), true);
        } finally {
            showLoading(false);
        }
    }

    // Show/hide loading state
    function showLoading(loading) {
        resetBtn.disabled = loading;
        newPasswordInput.disabled = loading;
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
            loginButton.textContent = 'Sign In Now';
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
            case 'auth/expired-action-code':
                return 'This password reset link has expired. Please request a new password reset email.';
            case 'auth/invalid-action-code':
                return 'This password reset link is invalid. Please request a new password reset email.';
            case 'auth/user-disabled':
                return 'This account has been disabled. Please contact support for assistance.';
            case 'auth/user-not-found':
                return 'No account found. The user may have been deleted.';
            case 'auth/weak-password':
                return 'Password is too weak. Please choose a stronger password.';
            case 'auth/network-request-failed':
                return 'Network error. Please check your internet connection and try again.';
            default:
                return 'Unable to reset password. Please try again or contact support if the problem persists.';
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
});