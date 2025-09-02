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
            
            try {
                // For now, simulate sending invite
                // In production, this would call a Netlify function
                console.log('Sending invite to:', email, 'with access:', accessType);
                
                // Show success modal
                document.getElementById('successMessage').textContent = `Invitation sent to ${email}`;
                document.getElementById('successModal').classList.add('show');
                
                // Clear form
                inviteForm.reset();
                
                // Reload invite history
                loadInviteHistory();
                
            } catch (error) {
                console.error('Error sending invite:', error);
                document.getElementById('errorMessage').textContent = 'Failed to send invitation';
                document.getElementById('errorModal').classList.add('show');
            }
        });
    }
    
    // Load invite history
    async function loadInviteHistory() {
        const invitesHistory = document.getElementById('invitesHistory');
        
        // For now, show placeholder
        invitesHistory.innerHTML = `
            <div class="invite-item">
                <p>Invite history will be available after backend implementation</p>
            </div>
        `;
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
    
    // Global function to view user (temporary)
    window.viewUser = function(userId) {
        console.log('View user:', userId);
        // Future: Show user details modal
    };
    
})();