// This is a simpler authentication check specifically for app.html
(function() {
    // Auth check running for app.html
    
    // Function to get base path
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
    
    // Check Firebase is loaded before continuing
    function checkFirebase() {
        if (typeof firebase === 'undefined' || !firebase.auth) {
            // Firebase not loaded yet, checking again in 100ms
            setTimeout(checkFirebase, 100);
            return;
        }
        
        // Once Firebase is loaded, check auth
        firebase.auth().onAuthStateChanged((user) => {
            if (!user) {
                // User not logged in, redirecting to login page
                const basePath = getBasePath();
                window.location.href = basePath + 'login';
            } else {
                // User authenticated
            }
        });
    }
    
    // Start the check
    checkFirebase();
})(); 