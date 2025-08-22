// Stripe Public Key (Test Mode)
const STRIPE_PUBLIC_KEY = 'pk_test_51RM3mWFqKKPQ6G55T0c4kmMJgVZGobBatUXrTWE16BrYJgDhrZ28LMaicuXveqQQ8k461fPFNLCL1v1IIlGq6OBR00lPAvZr1R';
const stripe = Stripe(STRIPE_PUBLIC_KEY);

// Pricing Configuration
const pricing = {
    practitioner: {
        monthly: { price: 10, id: 'price_1Ryl4vFqKKPQ6G55rwaBOdT0' },
        yearly: { price: 80, id: 'price_1Ryl8PFqKKPQ6G557x2YEQMq', savings: '£40 saved' },
        '2year': { price: 120, id: 'price_1Ryl8PFqKKPQ6G55oFWQXZhi', savings: '£120 saved' }
    },
    clinic: {
        monthly: { price: 30, id: 'price_1Ryl7FFqKKPQ6G55VaLmEhM1' },
        yearly: { price: 160, id: 'price_1Ryl7FFqKKPQ6G55wlwJItIO', savings: '£200 saved' },
        '2year': { price: 240, id: 'price_1Ryl7FFqKKPQ6G55Qww2Rxpx', savings: '£480 saved' }
    }
};

// Current selection
let currentTier = 'practitioner';
let currentPeriod = 'monthly';

// DOM Elements
const tierButtons = document.querySelectorAll('.toggle-btn');
const periodButtons = document.querySelectorAll('.period-btn');
const planName = document.getElementById('plan-name');
const priceAmount = document.getElementById('price-amount');
const pricePeriod = document.getElementById('price-period');
const savingsText = document.getElementById('savings-text');
const subscribeBtn = document.getElementById('subscribe-btn');
const practitionerFeatures = document.getElementById('practitioner-features');
const clinicFeatures = document.getElementById('clinic-features');

// Modal elements
const emailModal = document.getElementById('emailModal');
const emailInput = document.getElementById('emailInput');
const startTrialBtn = document.getElementById('startTrialBtn');
const cancelBtn = document.getElementById('cancelBtn');
const closeModal = document.getElementById('closeModal');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    updateDisplay();
    
    // Tier toggle
    tierButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tierButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTier = btn.dataset.tier;
            updateDisplay();
        });
    });
    
    // Period toggle
    periodButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            periodButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentPeriod = btn.dataset.period;
            updateDisplay();
        });
    });
    
    // Subscribe button
    subscribeBtn.addEventListener('click', showEmailModal);
    
    // Modal event listeners
    startTrialBtn.addEventListener('click', handleSubscribe);
    cancelBtn.addEventListener('click', hideEmailModal);
    closeModal.addEventListener('click', hideEmailModal);
    
    // Close modal on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && emailModal.classList.contains('show')) {
            hideEmailModal();
        }
    });
    
    // Close modal on backdrop click
    emailModal.addEventListener('click', (e) => {
        if (e.target === emailModal) {
            hideEmailModal();
        }
    });
});

// Update pricing display
function updateDisplay() {
    const plan = pricing[currentTier][currentPeriod];
    
    // Update plan name
    planName.textContent = `${currentTier.charAt(0).toUpperCase() + currentTier.slice(1)} Plan`;
    
    // Update price
    priceAmount.textContent = plan.price;
    
    // Update period text
    if (currentPeriod === 'monthly') {
        pricePeriod.textContent = '/month';
    } else if (currentPeriod === 'yearly') {
        pricePeriod.textContent = '/year';
    } else {
        pricePeriod.textContent = '/2 years';
    }
    
    // Update savings
    if (plan.savings) {
        savingsText.textContent = plan.savings;
        savingsText.style.display = 'block';
    } else {
        savingsText.style.display = 'none';
    }
    
    // Update features display
    if (currentTier === 'practitioner') {
        practitionerFeatures.style.display = 'block';
        clinicFeatures.style.display = 'none';
    } else {
        practitionerFeatures.style.display = 'none';
        clinicFeatures.style.display = 'block';
    }
}

// Show email modal
function showEmailModal() {
    emailModal.classList.add('show');
    emailInput.focus();
}

// Hide email modal
function hideEmailModal() {
    emailModal.classList.remove('show');
    emailInput.value = '';
    resetButton();
}

// Validate email
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Handle subscription
async function handleSubscribe() {
    try {
        const email = emailInput.value.trim();
        
        // Validate email
        if (!email) {
            alert('Please enter your email address');
            emailInput.focus();
            return;
        }
        
        if (!isValidEmail(email)) {
            alert('Please enter a valid email address');
            emailInput.focus();
            return;
        }
        
        // Disable button and show loading
        startTrialBtn.disabled = true;
        startTrialBtn.classList.add('loading');
        startTrialBtn.textContent = 'Creating trial...';
        subscribeBtn.disabled = true;
        subscribeBtn.classList.add('loading');
        subscribeBtn.textContent = 'Loading...';
        
        // Get the selected price ID
        const priceId = pricing[currentTier][currentPeriod].id;
        
        // Call your Netlify function to create checkout session
        // Using simplified version for testing without Firebase
        const response = await fetch('/.netlify/functions/create-checkout-simple', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                plan: currentPeriod,
                tier: currentTier,
                email: email,
                successUrl: window.location.origin + '/success',
                cancelUrl: window.location.origin + '/pricing'
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Hide modal before redirecting
        hideEmailModal();
        
        // Redirect to Stripe Checkout
        if (data.url) {
            window.location.href = data.url;
        } else if (data.sessionId) {
            // Alternative: Use Stripe.js to redirect
            const result = await stripe.redirectToCheckout({
                sessionId: data.sessionId
            });
            
            if (result.error) {
                throw result.error;
            }
        }
        
    } catch (error) {
        console.error('Subscription error:', error);
        alert('Error: ' + error.message);
        resetButton();
        resetModalButton();
    }
}

// Reset button state
function resetButton() {
    subscribeBtn.disabled = false;
    subscribeBtn.classList.remove('loading');
    subscribeBtn.textContent = 'Start 14-Day Free Trial';
}

// Reset modal button state
function resetModalButton() {
    startTrialBtn.disabled = false;
    startTrialBtn.classList.remove('loading');
    startTrialBtn.textContent = 'Start Free Trial';
}

// Test mode indicator
if (STRIPE_PUBLIC_KEY.includes('test')) {
    const testBadge = document.createElement('div');
    testBadge.style.cssText = 'position: fixed; top: 10px; right: 10px; background: orange; color: white; padding: 5px 10px; border-radius: 5px; font-size: 12px; z-index: 9999;';
    testBadge.textContent = 'TEST MODE';
    document.body.appendChild(testBadge);
}