// Profile Dropdown Functionality for Homepage
(function() {
    'use strict';
    
    let currentUser = null;
    let isAdmin = false;
    let subscriptionStatus = null;
    
    // Wait for DOM to be ready
    document.addEventListener('DOMContentLoaded', function() {
        initializeProfileDropdown();
    });
    
    function initializeProfileDropdown() {
        const accountIcon = document.querySelector('.account-icon');
        const accountDropdown = document.getElementById('accountDropdown');
        
        if (!accountIcon || !accountDropdown) {
            console.error('Profile dropdown elements not found');
            return;
        }
        
        // Setup hover events for desktop
        const dropdownContainer = document.querySelector('.account-dropdown-container');
        
        // Show on hover (desktop)
        dropdownContainer.addEventListener('mouseenter', function() {
            accountDropdown.classList.add('show');
        });
        
        dropdownContainer.addEventListener('mouseleave', function() {
            accountDropdown.classList.remove('show');
        });
        
        // Toggle on click (mobile)
        accountIcon.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            accountDropdown.classList.toggle('show');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!dropdownContainer.contains(e.target)) {
                accountDropdown.classList.remove('show');
            }
        });
        
        // Check authentication state
        checkAuthState();
    }
    
    function checkAuthState() {
        // Wait for Firebase to be ready
        if (typeof firebase === 'undefined' || !firebase.auth) {
            setTimeout(checkAuthState, 100);
            return;
        }
        
        firebase.auth().onAuthStateChanged(async function(user) {
            currentUser = user;
            
            if (user) {
                // User is logged in
                await checkUserRole(user);
                await checkSubscriptionStatus(user);
                renderLoggedInMenu();
            } else {
                // User is not logged in
                renderGuestMenu();
            }
        });
    }
    
    async function checkUserRole(user) {
        // First check email for admin
        if (user.email && user.email.toLowerCase() === 'team@irislab.com') {
            isAdmin = true;
            subscriptionStatus = 'admin';
            return;
        }
        
        try {
            // Check if user is admin in Firestore
            const db = firebase.firestore();
            const userDoc = await db.collection('users').doc(user.uid).get();
            
            if (userDoc.exists) {
                const userData = userDoc.data();
                isAdmin = userData.role === 'admin' || userData.isAdmin === true;
                subscriptionStatus = userData.subscriptionStatus;
            }
        } catch (error) {
            console.error('Error checking user role:', error);
        }
    }
    
    async function checkSubscriptionStatus(user) {
        try {
            // Call the check-subscription function
            const response = await fetch(`/.netlify/functions/check-subscription?email=${encodeURIComponent(user.email)}`);
            const data = await response.json();
            
            if (data.hasSubscription) {
                if (data.isTrialing) {
                    subscriptionStatus = 'trial';
                } else if (data.isAdmin) {
                    subscriptionStatus = 'admin';
                } else {
                    subscriptionStatus = 'active';
                }
            } else {
                subscriptionStatus = 'none';
            }
        } catch (error) {
            console.error('Error checking subscription:', error);
            subscriptionStatus = 'unknown';
        }
    }
    
    function renderGuestMenu() {
        const dropdown = document.getElementById('accountDropdown');
        
        dropdown.innerHTML = `
            <div class="account-dropdown-menu">
                <a href="/login" class="dropdown-item">
                    <span class="dropdown-item-icon">→</span>
                    Login
                </a>
                <a href="#pricing-cards" class="dropdown-item" onclick="scrollToPricing(event)">
                    <span class="dropdown-item-icon">✦</span>
                    Start Free Trial
                </a>
            </div>
        `;
    }
    
    function renderLoggedInMenu() {
        const dropdown = document.getElementById('accountDropdown');
        const userEmail = currentUser.email;
        
        // Debug log
        console.log('Rendering menu for:', userEmail, 'isAdmin:', isAdmin, 'status:', subscriptionStatus);
        
        // Determine badge based on status
        let badgeHtml = '';
        if (isAdmin) {
            badgeHtml = '<span class="account-badge">ADMIN</span>';
        } else if (subscriptionStatus === 'trial') {
            badgeHtml = '<span class="account-badge trial">TRIAL</span>';
        } else if (subscriptionStatus === 'active') {
            badgeHtml = '<span class="account-badge active">ACTIVE</span>';
        }
        
        // Build menu HTML based on user type
        let menuItems = '';
        
        if (isAdmin) {
            // Admin menu
            menuItems = `
                <a href="/admin-dashboard" class="dropdown-item">
                    <span class="dropdown-item-icon">▣</span>
                    Admin Dashboard
                </a>
                <a href="/app" class="dropdown-item">
                    <span class="dropdown-item-icon">◉</span>
                    Open App
                </a>
                <div class="dropdown-divider"></div>
                <button class="dropdown-item" onclick="handleLogout()">
                    <span class="dropdown-item-icon">↗</span>
                    Logout
                </button>
            `;
        } else {
            // Regular user menu
            menuItems = `
                <a href="/app" class="dropdown-item">
                    <span class="dropdown-item-icon">◉</span>
                    Open App
                </a>
                <a href="https://billing.stripe.com/p/login/bJebJ15MN39E2QY3JN1gs00" class="dropdown-item">
                    <span class="dropdown-item-icon">▢</span>
                    Manage Plan
                </a>
                <div class="dropdown-divider"></div>
                <button class="dropdown-item" onclick="handleLogout()">
                    <span class="dropdown-item-icon">↗</span>
                    Logout
                </button>
            `;
        }
        
        dropdown.innerHTML = `
            <div class="account-dropdown-header">
                <p class="account-email">${userEmail}</p>
                ${badgeHtml}
            </div>
            <div class="account-dropdown-menu">
                ${menuItems}
            </div>
        `;
    }
    
    // Global functions for onclick handlers
    window.scrollToPricing = function(event) {
        event.preventDefault();
        const pricingSection = document.getElementById('pricing-cards');
        if (pricingSection) {
            pricingSection.scrollIntoView({ behavior: 'smooth' });
        }
        // Close dropdown
        document.getElementById('accountDropdown').classList.remove('show');
    };
    
    window.handleLogout = async function() {
        try {
            await firebase.auth().signOut();
            // Redirect to homepage after logout
            window.location.href = '/';
        } catch (error) {
            console.error('Error logging out:', error);
            alert('Error logging out. Please try again.');
        }
    };
    
})();