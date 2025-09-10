// Admin Dashboard Logic with Security Checks

(function() {
    'use strict';
    
    // Security check - verify admin immediately
    let currentUser = null;
    let isAdmin = false;
    
    // Initialize Firebase auth listener
    firebase.auth().onAuthStateChanged(async (user) => {
        if (!user) {
            // Not logged in, redirect to login
            console.log('No user logged in, redirecting to login');
            window.location.href = '/login';
            return;
        }
        
        currentUser = user;
        
        // Verify admin status
        const adminStatus = await verifyAdminStatus(user);
        if (!adminStatus) {
            console.log('User is not admin, redirecting to app');
            window.location.href = '/app';
            return;
        }
        
        // User is admin, initialize dashboard
        isAdmin = true;
        initializeDashboard(user);
    });
    
    // Verify admin status from Firestore
    async function verifyAdminStatus(user) {
        try {
            const db = firebase.firestore();
            const userDoc = await db.collection('users').doc(user.uid).get();
            
            if (!userDoc.exists) {
                return false;
            }
            
            const userData = userDoc.data();
            
            // Check for admin role or isAdmin flag
            return userData.role === 'admin' || userData.isAdmin === true;
            
        } catch (error) {
            console.error('Error verifying admin status:', error);
            return false;
        }
    }
    
    // Initialize dashboard after verification
    function initializeDashboard(user) {
        // Show admin email
        document.getElementById('adminEmail').textContent = user.email;
        
        // Load initial data
        loadOverviewStats();
        loadUsers();
        
        // Setup navigation
        setupNavigation();
        
        // Setup user menu
        setupUserMenu();
        
        // Setup forms
        setupInviteForm();
        
        // Setup search and filters
        setupFilters();
        
        // Setup invite user button
        setupInviteUserButton();
        
        // Setup real-time analytics
        setupRealTimeAnalytics();
        startAnalyticsAutoRefresh();
    }
    
    // Navigation between sections
    function setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        const sections = document.querySelectorAll('.content-section');
        
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Remove active class from all
                navItems.forEach(nav => nav.classList.remove('active'));
                sections.forEach(section => section.classList.remove('active'));
                
                // Add active to clicked
                item.classList.add('active');
                const targetSection = item.dataset.section;
                document.getElementById(targetSection).classList.add('active');
                
                // Load section-specific data
                if (targetSection === 'analytics') {
                    loadAnalytics();
                } else if (targetSection === 'invites') {
                    loadInviteHistory();
                }
            });
        });
    }
    
    // User menu dropdown
    function setupUserMenu() {
        const userMenuBtn = document.getElementById('userMenuBtn');
        const dropdownMenu = document.getElementById('dropdownMenu');
        const logoutBtn = document.getElementById('logoutBtn');
        
        userMenuBtn.addEventListener('click', () => {
            dropdownMenu.classList.toggle('show');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!userMenuBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
                dropdownMenu.classList.remove('show');
            }
        });
        
        // Logout functionality
        logoutBtn.addEventListener('click', async () => {
            try {
                await firebase.auth().signOut();
                window.location.href = '/login';
            } catch (error) {
                console.error('Logout error:', error);
            }
        });
    }
    
    // Global refresh function for overview
    window.refreshOverview = function() {
        loadOverviewStats();
    };
    
    // Load overview statistics
    async function loadOverviewStats() {
        try {
            const db = firebase.firestore();
            
            // Get users collection
            const usersSnapshot = await db.collection('users').get();
            const totalUsers = usersSnapshot.size;
            
            let activeSubscriptions = 0;
            let activeTrials = 0;
            let monthlyRevenue = 0;
            
            usersSnapshot.forEach(doc => {
                const user = doc.data();
                if (user.subscriptionStatus === 'active') {
                    activeSubscriptions++;
                    
                    // Calculate revenue (simplified)
                    if (user.subscriptionTier === 'practitioner') {
                        if (user.subscriptionPlan === 'monthly') monthlyRevenue += 10;
                        else if (user.subscriptionPlan === 'yearly') monthlyRevenue += 8.33; // £100/12
                        else if (user.subscriptionPlan === '2year') monthlyRevenue += 7.08; // £170/24
                    } else if (user.subscriptionTier === 'clinic') {
                        if (user.subscriptionPlan === 'monthly') monthlyRevenue += 30;
                        else if (user.subscriptionPlan === 'yearly') monthlyRevenue += 25; // £300/12
                        else if (user.subscriptionPlan === '2year') monthlyRevenue += 18.75; // £450/24
                    }
                } else if (user.subscriptionStatus === 'trialing') {
                    activeTrials++;
                }
            });
            
            // Update UI
            document.getElementById('totalUsers').textContent = totalUsers;
            document.getElementById('activeSubscriptions').textContent = activeSubscriptions;
            document.getElementById('activeTrials').textContent = activeTrials;
            document.getElementById('monthlyRevenue').textContent = `£${monthlyRevenue.toFixed(2)}`;
            
            // Load recent activity
            loadRecentActivity();
            
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }
    
    // Load recent activity
    async function loadRecentActivity() {
        const activityList = document.getElementById('activityList');
        
        try {
            const db = firebase.firestore();
            
            // Get recent users (last 5)
            const recentUsers = await db.collection('users')
                .orderBy('createdAt', 'desc')
                .limit(5)
                .get();
            
            let activityHTML = '';
            
            recentUsers.forEach(doc => {
                const user = doc.data();
                const date = user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleDateString('en-GB') : 'Unknown';
                activityHTML += `
                    <div class="activity-item">
                        <span class="activity-icon">👤</span>
                        <div class="activity-details">
                            <p>New user: ${user.email}</p>
                            <small>${date}</small>
                        </div>
                    </div>
                `;
            });
            
            activityList.innerHTML = activityHTML || '<p>No recent activity</p>';
            
        } catch (error) {
            activityList.innerHTML = '<p>Error loading activity</p>';
            console.error('Error loading activity:', error);
        }
    }
    
    // Load users table
    async function loadUsers() {
        const tableBody = document.getElementById('usersTableBody');
        
        try {
            const db = firebase.firestore();
            const usersSnapshot = await db.collection('users').get();
            
            let tableHTML = '';
            
            usersSnapshot.forEach(doc => {
                const user = doc.data();
                const joinDate = user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleDateString('en-GB') : 'Unknown';
                const status = user.subscriptionStatus || 'none';
                const plan = user.subscriptionTier || '-';
                
                // Status badge color
                let statusClass = '';
                if (status === 'active') statusClass = 'status-active';
                else if (status === 'trialing') statusClass = 'status-trial';
                else if (status === 'admin') statusClass = 'status-admin';
                else statusClass = 'status-inactive';
                
                tableHTML += `
                    <tr>
                        <td>${user.email}</td>
                        <td><span class="status-badge ${statusClass}">${status}</span></td>
                        <td>${plan}</td>
                        <td>${joinDate}</td>
                        <td>
                            <button class="btn-small" onclick="viewUser('${doc.id}')">View</button>
                        </td>
                    </tr>
                `;
            });
            
            tableBody.innerHTML = tableHTML || '<tr><td colspan="5">No users found</td></tr>';
            
        } catch (error) {
            tableBody.innerHTML = '<tr><td colspan="5">Error loading users</td></tr>';
            console.error('Error loading users:', error);
        }
    }
    
    // Setup invite form
    function setupInviteForm() {
        const inviteForm = document.getElementById('inviteForm');
        const accessTypeSelect = document.getElementById('accessType');
        const planSelection = document.getElementById('planSelection');
        const billingPeriod = document.getElementById('billingPeriod');
        
        // Show/hide additional fields based on access type
        accessTypeSelect.addEventListener('change', (e) => {
            const isDiscount = e.target.value.startsWith('discount_');
            planSelection.style.display = isDiscount ? 'block' : 'none';
            billingPeriod.style.display = isDiscount ? 'block' : 'none';
        });
        
        inviteForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('inviteEmail').value;
            const accessType = document.getElementById('accessType').value;
            const message = document.getElementById('personalMessage').value;
            const selectedPlan = document.getElementById('selectedPlan').value;
            const selectedPeriod = document.getElementById('selectedPeriod').value;
            
            // Show loading state
            const submitBtn = inviteForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<span>⏳</span> Sending...';
            submitBtn.disabled = true;
            
            try {
                // Call the Netlify function
                const response = await fetch('/.netlify/functions/admin-invite-user', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email: email,
                        accessType: accessType,
                        personalMessage: message,
                        adminUid: currentUser.uid,
                        selectedPlan: selectedPlan,
                        selectedPeriod: selectedPeriod
                    })
                });
                
                const result = await response.json();
                
                if (response.ok && result.success) {
                    // Show success modal with detailed info
                    let successMessage = `Invitation sent to ${email}`;
                    if (result.couponId) {
                        successMessage += ` with coupon code: ${result.couponId}`;
                    }
                    if (result.checkoutUrl) {
                        successMessage += ` with direct checkout link`;
                    }
                    if (result.trackingError) {
                        successMessage += ` (Note: Email sent but tracking failed)`;
                    }
                    
                    document.getElementById('successMessage').textContent = successMessage;
                document.getElementById('successModal').classList.add('show');
                
                // Clear form
                inviteForm.reset();
                
                // Reload invite history
                loadInviteHistory();
                } else {
                    throw new Error(result.error || 'Failed to send invitation');
                }
                
            } catch (error) {
                console.error('Error sending invite:', error);
                document.getElementById('errorMessage').textContent = error.message || 'Failed to send invitation';
                document.getElementById('errorModal').classList.add('show');
            } finally {
                // Reset button state
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        });
    }
    
    // Global refresh function for invites
    window.refreshInvites = function() {
        loadInviteHistory();
    };
    
    // Load invite history
    async function loadInviteHistory() {
        const invitesHistory = document.getElementById('invitesHistory');
        
        try {
            const db = firebase.firestore();
            
            // Get recent invites (last 10)
            const invitesSnapshot = await db.collection('invites')
                .orderBy('sentAt', 'desc')
                .limit(10)
                .get();
            
            let historyHTML = '';
            let inviteCount = 0;
            
            if (invitesSnapshot.empty) {
                historyHTML = '<div class="invite-item"><p>No invitations sent yet</p></div>';
            } else {
                invitesSnapshot.forEach(doc => {
                    const invite = doc.data();
                    const sentDate = invite.sentAt ? new Date(invite.sentAt.seconds * 1000).toLocaleDateString('en-GB') : 'Unknown';
                    const statusClass = invite.status === 'sent' ? 'status-sent' : 'status-pending';
                    
                    historyHTML += `
            <div class="invite-item">
                            <div class="invite-details">
                                <p><strong>${invite.email}</strong></p>
                                <p>Access: ${invite.accessType} • Sent: ${sentDate}</p>
                                ${invite.couponId ? `<p>Coupon: <code>${invite.couponId}</code></p>` : ''}
                                <span class="status-badge ${statusClass}">${invite.status}</span>
                            </div>
            </div>
        `;
                    inviteCount++;
                });
            }
            
            invitesHistory.innerHTML = historyHTML;
            
            // Update invite count
            const inviteCountElement = document.getElementById('inviteCount');
            if (inviteCountElement) {
                inviteCountElement.textContent = `${inviteCount} invitation${inviteCount !== 1 ? 's' : ''}`;
            }
            
        } catch (error) {
            console.error('Error loading invite history:', error);
            invitesHistory.innerHTML = '<div class="invite-item"><p>Error loading invite history</p></div>';
        }
    }
    
    // Global refresh function for analytics
    window.refreshAnalytics = function() {
        loadAnalytics();
    };
    
    // Setup real-time analytics updates
    function setupRealTimeAnalytics() {
        try {
            const db = firebase.firestore();
            
            // Debounce function to prevent too many rapid updates
            let updateTimeout;
            const debouncedLoadAnalytics = () => {
                clearTimeout(updateTimeout);
                updateTimeout = setTimeout(() => {
                    if (document.getElementById('analytics') && document.getElementById('analytics').classList.contains('active')) {
                        loadAnalytics();
                    }
                }, 1000); // Wait 1 second before updating
            };
            
            // Listen for changes in analytics collection
            db.collection('analytics').doc('system_metrics').onSnapshot((doc) => {
                if (doc.exists) {
                    console.log('Analytics updated in real-time');
                    debouncedLoadAnalytics();
                }
            }, (error) => {
                console.error('Error in analytics listener:', error);
            });
            
            // Listen for changes in users collection (less frequent updates)
            db.collection('users').onSnapshot((snapshot) => {
                console.log('Users collection updated in real-time');
                debouncedLoadAnalytics();
            }, (error) => {
                console.error('Error in users listener:', error);
            });
            
            console.log('Real-time analytics listeners set up');
            
        } catch (error) {
            console.error('Error setting up real-time analytics:', error);
        }
    }
    
    // Auto-refresh analytics every 30 seconds
    function startAnalyticsAutoRefresh() {
        setInterval(() => {
            if (document.getElementById('analytics').classList.contains('active')) {
                loadAnalytics();
            }
        }, 30000); // 30 seconds
    }
    
    // Global export function for analytics
    window.exportAnalytics = function() {
        // TODO: Implement analytics export functionality
        alert('Analytics export functionality coming soon!');
    };
    
    // Load analytics
    async function loadAnalytics() {
        try {
            const db = firebase.firestore();
            
            // Load analytics from the analytics collection
            const analyticsDoc = await db.collection('analytics').doc('system_metrics').get();
            const metrics = analyticsDoc.exists ? analyticsDoc.data() : {};
            
            // Load user data for detailed analytics
            const usersSnapshot = await db.collection('users').get();
            const users = [];
            usersSnapshot.forEach(doc => {
                users.push({ id: doc.id, ...doc.data() });
            });
            
            // Calculate login activity
            const today = new Date().toISOString().split('T')[0];
            const todayLogins = metrics.dailyActiveUsers?.[today]?.length || 0;
            const totalLogins = users.reduce((sum, user) => sum + (user.loginCount || 0), 0);
            const activeUsers = users.filter(user => {
                if (!user.lastActiveAt) return false;
                const lastActive = user.lastActiveAt.toDate();
                const now = new Date();
                const diffMinutes = (now - lastActive) / (1000 * 60);
                return diffMinutes < 30; // Active if last seen within 30 minutes
            }).length;
            
            // Update login activity
            document.getElementById('todayLogins').textContent = todayLogins;
            document.getElementById('activeUsers').textContent = activeUsers;
            document.getElementById('totalLogins').textContent = totalLogins;
            
            // Load recent logins
            const recentLogins = users
                .filter(user => user.lastLoginAt)
                .sort((a, b) => b.lastLoginAt.toDate() - a.lastLoginAt.toDate())
                .slice(0, 5);
            
            const loginList = document.getElementById('loginList');
            if (recentLogins.length > 0) {
                loginList.innerHTML = recentLogins.map(user => {
                    const loginTime = user.lastLoginAt.toDate().toLocaleString();
                    return `
                        <div class="activity-item">
                            <span class="activity-icon">👤</span>
                            <div class="activity-details">
                                <p>${user.email}</p>
                                <small>${loginTime}</small>
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                loginList.innerHTML = '<p>No recent logins</p>';
            }
            
            // Calculate usage statistics
            const totalImagesUploaded = users.reduce((sum, user) => sum + (user.usageStats?.imageUpload || 0), 0);
            const totalExports = users.reduce((sum, user) => sum + (user.usageStats?.imageExport || 0), 0);
            const totalAdjustments = users.reduce((sum, user) => sum + (user.usageStats?.adjustment || 0), 0);
            const totalSessionTime = users.reduce((sum, user) => sum + (user.usageStats?.sessionTime || 0), 0);
            const avgSessionTime = users.length > 0 ? Math.round(totalSessionTime / users.length / (1000 * 60)) : 0;
            
            // Update usage statistics (only elements that exist)
            const totalImagesElement = document.getElementById('totalImagesUploaded');
            const totalExportsElement = document.getElementById('totalExports');
            const totalAdjustmentsElement = document.getElementById('totalAdjustments');
            const avgSessionElement = document.getElementById('avgSessionTime');
            const apiCallsElement = document.getElementById('apiCallsToday');

            if (totalImagesElement) totalImagesElement.textContent = totalImagesUploaded;
            if (totalExportsElement) totalExportsElement.textContent = totalExports;
            if (totalAdjustmentsElement) totalAdjustmentsElement.textContent = totalAdjustments;
            if (avgSessionElement) avgSessionElement.textContent = `${avgSessionTime}m`;
            if (apiCallsElement) apiCallsElement.textContent = metrics.apiCalls?.todayTotal || 0;
            
            // Update Top Maps display
            updateTopMapsDisplay(metrics);
            
            console.log('Analytics loaded successfully');
            
        } catch (error) {
            console.error('Error loading analytics:', error);
            // Show error in UI safely
            const loginListElement = document.getElementById('loginList');
            if (loginListElement) {
                loginListElement.innerHTML = '<p>Error loading data</p>';
            }
            
            // Set default values for elements that exist
            const elements = [
                'todayLogins', 'activeUsers', 'totalLogins', 'totalImagesUploaded',
                'totalExports', 'totalAdjustments', 'avgSessionTime'
            ];
            
            // Handle Top Maps display separately
            const topMapsElement = document.getElementById('topMapsDisplay');
            const mapChangesElement = document.getElementById('mapChangesCount');
            if (topMapsElement) topMapsElement.innerHTML = '<div style="font-size: 14px; color: #586069;">No data available</div>';
            if (mapChangesElement) mapChangesElement.textContent = 'No changes yet';
            
            elements.forEach(elementId => {
                const element = document.getElementById(elementId);
                if (element && element.textContent === '') {
                    element.textContent = '0';
                }
            });
        }
    }
    
    // Format map names for display
    function formatMapName(mapFileName) {
        if (!mapFileName) return 'Unknown Map';
        
        const parts = mapFileName.split('_');
        const mapName = parts[0]; // e.g., "Jensen", "IrisLAB", "Angerer"
        const langCode = parts.find(p => p === 'DE' || p === 'EN' || p === 'FR');
        
        let language = '';
        switch (langCode) {
            case 'DE': language = 'German'; break;
            case 'EN': language = 'English'; break;
            case 'FR': language = 'French'; break;
            default: language = 'Unknown';
        }
        
        return `${mapName} Map (${language})`;
    }
    
    // Update Top Maps display
    function updateTopMapsDisplay(metrics) {
        const topMapsElement = document.getElementById('topMapsDisplay');
        const mapChangesElement = document.getElementById('mapChangesCount');
        
        if (!topMapsElement || !mapChangesElement) return;
        
        try {
            const mapUsageStats = metrics.mapUsageStats || {};
            const totalMapChanges = metrics.totalMapChanges || 0;
            
            // Convert to array and sort by usage count
            const mapEntries = Object.entries(mapUsageStats)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 3); // Top 3
            
            if (mapEntries.length === 0) {
                topMapsElement.innerHTML = '<div style="font-size: 14px; color: #586069;">No map usage data</div>';
                mapChangesElement.textContent = 'No changes yet';
                return;
            }
            
            // Calculate percentages
            const totalSelections = Object.values(mapUsageStats).reduce((sum, count) => sum + count, 0);
            
            // Format top maps display
            const topMapsHtml = mapEntries.map(([mapName, count], index) => {
                const percentage = totalSelections > 0 ? Math.round((count / totalSelections) * 100) : 0;
                const formattedName = formatMapName(mapName);
                return `<div style="font-size: 12px; margin: 2px 0; color: #24292e;">
                    ${index + 1}. ${formattedName} ${count} (${percentage}%)
                </div>`;
            }).join('');
            
            topMapsElement.innerHTML = topMapsHtml;
            mapChangesElement.textContent = `+${totalMapChanges} changes total`;
            
        } catch (error) {
            console.error('Error updating top maps display:', error);
            topMapsElement.innerHTML = '<div style="font-size: 14px; color: #586069;">Error loading maps</div>';
            mapChangesElement.textContent = 'Error loading data';
        }
    }
    
    // Setup filters
    function setupFilters() {
        const searchInput = document.getElementById('userSearch');
        const statusFilter = document.getElementById('statusFilter');
        const planFilter = document.getElementById('planFilter');
        
        // Search functionality
        searchInput?.addEventListener('input', (e) => {
            filterUsers(e.target.value, statusFilter?.value, planFilter?.value);
        });
        
        // Status filter
        statusFilter?.addEventListener('change', (e) => {
            filterUsers(searchInput?.value, e.target.value, planFilter?.value);
        });
        
        // Plan filter
        planFilter?.addEventListener('change', (e) => {
            filterUsers(searchInput?.value, statusFilter?.value, e.target.value);
        });
    }
    
    // Global refresh function for users
    window.refreshUsers = function() {
        loadUsers();
    };
    
    // Global export function for users
    window.exportUsers = function() {
        // TODO: Implement user export functionality
        alert('Export functionality coming soon!');
    };
    
    // Filter users table
    function filterUsers(searchTerm, statusFilter, planFilter) {
        const rows = document.querySelectorAll('#usersTableBody tr');
        let visibleCount = 0;
        
        rows.forEach(row => {
            const email = row.cells[0]?.textContent.toLowerCase();
            const status = row.cells[1]?.textContent.toLowerCase();
            const plan = row.cells[2]?.textContent.toLowerCase();
            
            const matchesSearch = !searchTerm || email.includes(searchTerm.toLowerCase());
            const matchesStatus = !statusFilter || status.includes(statusFilter.toLowerCase());
            const matchesPlan = !planFilter || plan.includes(planFilter.toLowerCase());
            
            const isVisible = matchesSearch && matchesStatus && matchesPlan;
            row.style.display = isVisible ? '' : 'none';
            
            if (isVisible) visibleCount++;
        });
        
        // Update user count
        const userCountElement = document.getElementById('userCount');
        if (userCountElement) {
            userCountElement.textContent = `${visibleCount} user${visibleCount !== 1 ? 's' : ''}`;
        }
    }
    
    // Modal handlers
    document.getElementById('closeSuccessModal')?.addEventListener('click', () => {
        document.getElementById('successModal').classList.remove('show');
    });
    
    document.getElementById('closeErrorModal')?.addEventListener('click', () => {
        document.getElementById('errorModal').classList.remove('show');
    });
    
    // Setup invite user button functionality
    function setupInviteUserButton() {
        const inviteUserBtn = document.getElementById('inviteUserBtn');
        
        if (inviteUserBtn) {
            inviteUserBtn.addEventListener('click', () => {
                // Switch to invites section
                const invitesNavItem = document.querySelector('[data-section="invites"]');
                const invitesSection = document.getElementById('invites');
                
                if (invitesNavItem && invitesSection) {
                    // Remove active class from all nav items and sections
                    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
                    document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));
                    
                    // Add active class to invites
                    invitesNavItem.classList.add('active');
                    invitesSection.classList.add('active');
                    
                    // Load invite history
                    loadInviteHistory();
                    
                    // Scroll to top of content area
                    document.querySelector('.content').scrollTop = 0;
                }
            });
        }
    }
    
    // Global function to view user details
    window.viewUser = async function(userId) {
        try {
            const db = firebase.firestore();
            const userDoc = await db.collection('users').doc(userId).get();
            
            if (userDoc.exists) {
                const userData = userDoc.data();
                showUserDetailsModal(userData, userId);
            } else {
                alert('User not found');
            }
        } catch (error) {
            console.error('Error loading user details:', error);
            alert('Error loading user details');
        }
    };
    
    // Show user details modal
    function showUserDetailsModal(userData, userId) {
        // Create modal HTML
        const modalHTML = `
            <div id="userDetailsModal" class="modal show">
                <div class="modal-content" style="max-width: 600px;">
                    <h3>User Details</h3>
                    <div class="user-details">
                        <div class="detail-row">
                            <label>Email:</label>
                            <span>${userData.email || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <label>Status:</label>
                            <span class="status-badge ${getStatusClass(userData.subscriptionStatus)}">${userData.subscriptionStatus || 'none'}</span>
                        </div>
                        <div class="detail-row">
                            <label>Plan:</label>
                            <span>${userData.subscriptionTier || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <label>Role:</label>
                            <span>${userData.role || 'user'}</span>
                        </div>
                        <div class="detail-row">
                            <label>Created:</label>
                            <span>${userData.createdAt ? new Date(userData.createdAt.seconds * 1000).toLocaleDateString('en-GB') : 'Unknown'}</span>
                        </div>
                        <div class="detail-row">
                            <label>UID:</label>
                            <span style="font-family: monospace; font-size: 0.8rem;">${userId}</span>
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button class="btn-secondary" onclick="manageUserSubscription('${userId}')">Manage Subscription</button>
                        <button class="btn-primary" onclick="closeUserDetailsModal()">Close</button>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    
    // Close user details modal
    window.closeUserDetailsModal = function() {
        const modal = document.getElementById('userDetailsModal');
        if (modal) {
            modal.remove();
        }
    };
    
    // Get status class for styling
    function getStatusClass(status) {
        if (status === 'active') return 'status-active';
        if (status === 'trialing') return 'status-trial';
        if (status === 'admin') return 'status-admin';
        return 'status-inactive';
    }
    
    // Global function to manage user subscription
    window.manageUserSubscription = async function(userId) {
        try {
            const db = firebase.firestore();
            const userDoc = await db.collection('users').doc(userId).get();
            
            if (userDoc.exists) {
                const userData = userDoc.data();
                showSubscriptionManagementModal(userData, userId);
            } else {
                alert('User not found');
            }
        } catch (error) {
            console.error('Error loading user for subscription management:', error);
            alert('Error loading user details');
        }
    };
    
    // Show subscription management modal
    function showSubscriptionManagementModal(userData, userId) {
        const currentStatus = userData.subscriptionStatus || 'none';
        const currentPlan = userData.subscriptionTier || 'none';
        
        // Create modal HTML
        const modalHTML = `
            <div id="subscriptionModal" class="modal show">
                <div class="modal-content" style="max-width: 500px;">
                    <h3>Manage Subscription</h3>
                    <div class="user-info">
                        <p><strong>User:</strong> ${userData.email}</p>
                        <p><strong>Current Status:</strong> <span class="status-badge ${getStatusClass(currentStatus)}">${currentStatus}</span></p>
                        <p><strong>Current Plan:</strong> ${currentPlan}</p>
                    </div>
                    
                    <div class="subscription-actions">
                        <h4>Subscription Actions</h4>
                        
                        <div class="action-group">
                            <label>Extend Trial Period</label>
                            <div class="action-controls">
                                <input type="number" id="trialDays" placeholder="Days" min="1" max="365" value="7">
                                <button class="btn-primary" onclick="extendTrial('${userId}')">Extend Trial</button>
                            </div>
                        </div>
                        
                        <div class="action-group">
                            <label>Grant Free Access</label>
                            <div class="action-controls">
                                <select id="freeAccessType">
                                    <option value="permanent">Permanent Free Access</option>
                                    <option value="90days">90 Days Free</option>
                                    <option value="30days">30 Days Free</option>
                                </select>
                                <button class="btn-primary" onclick="grantFreeAccess('${userId}')">Grant Access</button>
                            </div>
                        </div>
                        
                        <div class="action-group">
                            <label>Cancel Subscription</label>
                            <div class="action-controls">
                                <input type="text" id="cancelReason" placeholder="Reason for cancellation">
                                <button class="btn-danger" onclick="cancelSubscription('${userId}')">Cancel Subscription</button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="modal-actions">
                        <button class="btn-secondary" onclick="closeSubscriptionModal()">Close</button>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    
    // Close subscription management modal
    window.closeSubscriptionModal = function() {
        const modal = document.getElementById('subscriptionModal');
        if (modal) {
            modal.remove();
        }
    };
    
    // Extend trial function
    window.extendTrial = async function(userId) {
        const days = document.getElementById('trialDays').value;
        if (!days || days < 1) {
            alert('Please enter a valid number of days');
            return;
        }
        
        try {
            const response = await fetch('/.netlify/functions/admin-manage-subscription', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'extend_trial',
                    userId: userId,
                    days: parseInt(days),
                    adminUid: currentUser.uid
                })
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                alert(`Trial extended by ${days} days successfully!`);
                closeSubscriptionModal();
                // Refresh user details if modal is still open
                if (document.getElementById('userDetailsModal')) {
                    viewUser(userId);
                }
            } else {
                throw new Error(result.error || 'Failed to extend trial');
            }
            
        } catch (error) {
            console.error('Error extending trial:', error);
            alert('Error extending trial: ' + error.message);
        }
    };
    
    // Grant free access function
    window.grantFreeAccess = async function(userId) {
        const accessType = document.getElementById('freeAccessType').value;
        
        try {
            const response = await fetch('/.netlify/functions/admin-manage-subscription', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'grant_free_access',
                    userId: userId,
                    accessType: accessType,
                    adminUid: currentUser.uid
                })
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                alert(`Free access granted successfully!`);
                closeSubscriptionModal();
                // Refresh user details if modal is still open
                if (document.getElementById('userDetailsModal')) {
                    viewUser(userId);
                }
            } else {
                throw new Error(result.error || 'Failed to grant free access');
            }
            
        } catch (error) {
            console.error('Error granting free access:', error);
            alert('Error granting free access: ' + error.message);
        }
    };
    
    // Cancel subscription function
    window.cancelSubscription = async function(userId) {
        const reason = document.getElementById('cancelReason').value;
        if (!reason.trim()) {
            alert('Please provide a reason for cancellation');
            return;
        }
        
        if (!confirm('Are you sure you want to cancel this user\'s subscription?')) {
            return;
        }
        
        try {
            const response = await fetch('/.netlify/functions/admin-manage-subscription', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'cancel_subscription',
                    userId: userId,
                    reason: reason,
                    adminUid: currentUser.uid
                })
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                alert('Subscription cancelled successfully!');
                closeSubscriptionModal();
                // Refresh user details if modal is still open
                if (document.getElementById('userDetailsModal')) {
                    viewUser(userId);
                }
            } else {
                throw new Error(result.error || 'Failed to cancel subscription');
            }
            
        } catch (error) {
            console.error('Error cancelling subscription:', error);
            alert('Error cancelling subscription: ' + error.message);
        }
    };
    
})();