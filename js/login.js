// Login page functionality
document.addEventListener('DOMContentLoaded', function() {
    console.log('Login page loaded');
    
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
            window.location.href = '/app';
        }
    });

    // Login form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleLogin();
    });

    // Signup button
    signupBtn.addEventListener('click', () => {
        window.location.href = '/#pricing-cards';
    });

    // Forgot password - let the link navigate naturally
    // No JavaScript override needed

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
                window.location.href = '/app';
            } else {
                // No active subscription, redirect to pricing
                showError('Your subscription has expired. Please renew your subscription to continue using Iris Mapper Pro.');
                setTimeout(() => {
                    window.location.href = '/pricing';
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
});