// Subscription gate for main application
(function() {
    console.log('Checking subscription status...');
    
    // Skip redirect if we're already on pricing or success pages
    const currentPath = window.location.pathname;
    if (currentPath.includes('/pricing') || 
        currentPath.includes('/success') || 
        currentPath.includes('/login') ||
        currentPath === '/' ||
        currentPath.includes('/forgot-password') ||
        currentPath.includes('/reset-password') ||
        currentPath.includes('/setup-password') ||
        currentPath.includes('/verify-email')) {
        return;
    }
    
    // Check if user has active subscription
    async function checkSubscriptionStatus() {
        try {
            // First check if user is authenticated
            if (typeof firebase === 'undefined' || !firebase.auth) {
                console.log('Firebase not loaded, redirecting to pricing');
                redirectToPricing();
                return;
            }
            
            firebase.auth().onAuthStateChanged(async (user) => {
                if (!user) {
                    console.log('User not authenticated, redirecting to pricing');
                    redirectToPricing();
                    return;
                }
                
                try {
                    // Call Netlify function to check subscription
                    const response = await fetch('/.netlify/functions/check-subscription?email=' + encodeURIComponent(user.email));
                    const data = await response.json();
                    
                    if (!data.hasSubscription) {
                        console.log('No active subscription, redirecting to pricing');
                        redirectToPricing();
                        return;
                    }
                    
                    // Show trial status if applicable
                    if (data.isTrialing && data.trialDaysRemaining > 0) {
                        showTrialBanner(data.trialDaysRemaining);
                    }
                    
                    console.log('Subscription verified, allowing access');
                    
                } catch (error) {
                    console.error('Error checking subscription:', error);
                    // On error, redirect to pricing for safety
                    redirectToPricing();
                }
            });
            
        } catch (error) {
            console.error('Auth check error:', error);
            redirectToPricing();
        }
    }
    
    function redirectToPricing() {
        const basePath = getBasePath();
        window.location.href = basePath + 'pricing';
    }
    
    function getBasePath() {
        const path = window.location.pathname;
        const segments = path.split('/').filter(segment => segment.length > 0);
        const projectRepoNames = ['irismapper', 'irismapper-main', 'irismapperproplan'];
        
        if (segments.length > 0) {
            const firstSegmentLower = segments[0].toLowerCase();
            for (const repoName of projectRepoNames) {
                if (firstSegmentLower === repoName) {
                    return `/${repoName}/`;
                }
            }
        }
        return '/';
    }
    
    function showTrialBanner(daysRemaining) {
        const banner = document.createElement('div');
        banner.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #4A90E2;
            color: white;
            text-align: center;
            padding: 10px;
            font-size: 14px;
            z-index: 10000;
            font-family: 'Josefin Sans', sans-serif;
        `;
        banner.innerHTML = `
            <strong>Free Trial:</strong> ${daysRemaining} days remaining
        `;
        document.body.appendChild(banner);
        
        // Adjust body padding to account for banner
        document.body.style.paddingTop = '45px';
    }
    
    // Start the check after a short delay to allow Firebase to load
    setTimeout(checkSubscriptionStatus, 500);
})();