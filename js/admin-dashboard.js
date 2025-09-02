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
        
        inviteForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('inviteEmail').value;
            const accessType = document.getElementById('accessType').value;
            const message = document.getElementById('personalMessage').value;
            
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
                        adminUid: currentUser.uid
                    })
                });
                
                const result = await response.json();
                
                if (response.ok && result.success) {
                    // Show success modal
                    document.getElementById('successMessage').textContent = `Invitation sent to ${email}${result.couponId ? ' with coupon code' : ''}`;
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
                });
            }
            
            invitesHistory.innerHTML = historyHTML;
            
        } catch (error) {
            console.error('Error loading invite history:', error);
            invitesHistory.innerHTML = '<div class="invite-item"><p>Error loading invite history</p></div>';
        }
    }
    
    // Load analytics
    async function loadAnalytics() {
        try {
            const db = firebase.firestore();
            
            // Load analytics from the analytics collection
            const analyticsDoc = await db.collection('analytics').doc('system_metrics').get();
            
            if (analyticsDoc.exists) {
                const metrics = analyticsDoc.data();
                
                // Update feature usage
                const featureUsage = document.getElementById('featureUsage');
                featureUsage.innerHTML = `
                    <li>Total Maps Used: ${metrics.featureUsageStats?.totalMapsUsed || 0}</li>
                    <li>Total Exports: ${metrics.featureUsageStats?.totalExports || 0}</li>
                    <li>Total Adjustments: ${metrics.featureUsageStats?.totalAdjustments || 0}</li>
                `;
                
                // Update conversion metrics
                const conversionMetrics = document.getElementById('conversionMetrics');
                const conversionRate = metrics.trialConversions?.conversionRate || 0;
                conversionMetrics.innerHTML = `
                    <p>Trials Started: ${metrics.trialConversions?.trialsStarted || 0}</p>
                    <p>Trials Converted: ${metrics.trialConversions?.trialsConverted || 0}</p>
                    <p>Conversion Rate: ${conversionRate}%</p>
                `;
                
                // Update system health
                const systemHealth = document.getElementById('systemHealth');
                systemHealth.innerHTML = `
                    <p class="health-good">✅ All systems operational</p>
                    <p>API Calls Today: ${metrics.apiCalls?.todayTotal || 0}</p>
                `;
            }
            
        } catch (error) {
            console.error('Error loading analytics:', error);
        }
    }
    
    // Setup filters
    function setupFilters() {
        const searchInput = document.getElementById('userSearch');
        const statusFilter = document.getElementById('statusFilter');
        
        // Search functionality
        searchInput?.addEventListener('input', (e) => {
            filterUsers(e.target.value, statusFilter?.value);
        });
        
        // Status filter
        statusFilter?.addEventListener('change', (e) => {
            filterUsers(searchInput?.value, e.target.value);
        });
    }
    
    // Filter users table
    function filterUsers(searchTerm, statusFilter) {
        const rows = document.querySelectorAll('#usersTableBody tr');
        
        rows.forEach(row => {
            const email = row.cells[0]?.textContent.toLowerCase();
            const status = row.cells[1]?.textContent.toLowerCase();
            
            const matchesSearch = !searchTerm || email.includes(searchTerm.toLowerCase());
            const matchesStatus = !statusFilter || status.includes(statusFilter.toLowerCase());
            
            row.style.display = matchesSearch && matchesStatus ? '' : 'none';
        });
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
    
})();