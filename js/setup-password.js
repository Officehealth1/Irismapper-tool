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
    const emailFromUrl = urlParams.get('email');
    const isNew = urlParams.get('new');

    if (!emailFromUrl) {
        showMessage('Error', 'Invalid setup link. Please contact support.', true);
        return;
    }

    // Pre-fill email and update display
    emailInput.value = emailFromUrl;
    emailDisplay.textContent = `Create password for ${emailFromUrl}`;

    // Form submission
    setupPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handlePasswordSetup();
    });

    // Close modal
    closeModal.addEventListener('click', () => {
        hideModal();
    });

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
            
            // Check if user already has an account
            firebase.auth().onAuthStateChanged(async (currentUser) => {
                if (currentUser) {
                    // User is already signed in, just update password
                    await currentUser.updatePassword(password);
                    console.log('Password updated for existing user');
                    showSuccessAndRedirect();
                    return;
                }
                
                // Try to sign in first to see if account exists
                try {
                    await firebase.auth().signInWithEmailAndPassword(email, password);
                    console.log('User already has this password set');
                    showSuccessAndRedirect();
                } catch (signInError) {
                    if (signInError.code === 'auth/wrong-password' || signInError.code === 'auth/user-not-found') {
                        // Account exists but wrong password, or no account - create new one
                        try {
                            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
                            console.log('New account created:', userCredential.user.email);
                            showSuccessAndRedirect();
                        } catch (createError) {
                            if (createError.code === 'auth/email-already-in-use') {
                                // Account exists, send password reset instead
                                showMessage('Account Exists', 
                                    'An account with this email already exists. We\'ve sent you a password reset link to set up your password.',
                                    false);
                                
                                // Send password reset email
                                await firebase.auth().sendPasswordResetEmail(email, {
                                    url: 'https://irismapper.com/login',
                                    handleCodeInApp: false
                                });
                            } else {
                                throw createError;
                            }
                        }
                    } else {
                        throw signInError;
                    }
                }
            });
            
        } catch (error) {
            console.error('Password setup error:', error);
            showMessage('Error', getErrorMessage(error.code), true);
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

    // Get user-friendly error messages
    function getErrorMessage(errorCode) {
        switch (errorCode) {
            case 'auth/email-already-in-use':
                return 'An account with this email already exists. Please sign in instead.';
            case 'auth/invalid-email':
                return 'Please enter a valid email address.';
            case 'auth/weak-password':
                return 'Password is too weak. Please choose a stronger password.';
            case 'auth/network-request-failed':
                return 'Network error. Please check your internet connection and try again.';
            case 'auth/too-many-requests':
                return 'Too many attempts. Please try again later.';
            default:
                return 'Unable to set up your password. Please try again or contact support.';
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