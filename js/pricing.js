// Stripe Public Key (Test Mode)
const STRIPE_PUBLIC_KEY = 'pk_test_51RM3mWFqKKPQ6G55T0c4kmMJgVZGobBatUXrTWE16BrYJgDhrZ28LMaicuXveqQQ8k461fPFNLCL1v1IIlGq6OBR00lPAvZr1R';
const stripe = Stripe(STRIPE_PUBLIC_KEY);

// Pricing Configuration
const pricing = {
    practitioner: {
        monthly: { price: 10, id: 'price_1Ryl4vFqKKPQ6G55rwaBOdT0' },
        yearly: { price: 100, id: 'price_1Ryl8PFqKKPQ6G557x2YEQMq', savings: '£20 saved' },
        '2year': { price: 170, id: 'price_1Ryl8PFqKKPQ6G55oFWQXZhi', savings: '£70 saved' }
    },
    clinic: {
        monthly: { price: 30, id: 'price_1Ryl7FFqKKPQ6G55VaLmEhM1' },
        yearly: { price: 300, id: 'price_1Ryl7FFqKKPQ6G55wlwJItIO', savings: '£60 saved' },
        '2year': { price: 450, id: 'price_1Ryl7FFqKKPQ6G55Qww2Rxpx', savings: '£270 saved' }
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

// COMPREHENSIVE CTA HANDLING

// CTA Elements
const heroTrialBtn = document.getElementById('heroTrialBtn');
const heroDemoBtn = document.getElementById('heroDemoBtn');
const videoCta = document.getElementById('videoCta');
const socialProofCta = document.getElementById('socialProofCta');
const featuresCta = document.getElementById('featuresCta');
const faqCta = document.getElementById('faqCta');
const resultsCta = document.getElementById('resultsCta');
const supportCta = document.getElementById('supportCta');
const mobileTrialBtn = document.getElementById('mobileTrialBtn');

// Video thumbnails
const videoThumbnails = document.querySelectorAll('.video-thumbnail');

// Contact form
const contactForm = document.getElementById('contactForm');

// CTA Landing Functions
function openEmailModal(source) {
    console.log(`CTA clicked from: ${source}`);
    emailModal.classList.add('show');
    emailInput.focus();
}

function scrollToPricing(highlight = false) {
    const pricingSection = document.getElementById('pricing-section');
    pricingSection.scrollIntoView({ 
        behavior: 'smooth',
        block: 'center'
    });
    
    if (highlight) {
        const priceCard = document.querySelector('.price-card');
        priceCard.classList.add('highlight-glow');
        setTimeout(() => {
            priceCard.classList.remove('highlight-glow');
        }, 2000);
    }
}

function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
        });
    }
}

// CTA Event Handlers
document.addEventListener('DOMContentLoaded', () => {
    
    // Hero CTAs
    if (heroTrialBtn) {
        heroTrialBtn.addEventListener('click', () => openEmailModal('hero_primary'));
    }
    
    if (heroDemoBtn) {
        heroDemoBtn.addEventListener('click', () => scrollToSection('demo-section'));
    }
    
    // Video Section CTAs
    if (videoCta) {
        videoCta.addEventListener('click', () => scrollToPricing(true));
    }
    
    // Video thumbnails (placeholder - would integrate with actual video player)
    videoThumbnails.forEach(thumbnail => {
        thumbnail.addEventListener('click', () => {
            const videoType = thumbnail.dataset.video;
            console.log(`Playing video: ${videoType}`);
            // Placeholder for video player integration
            alert(`Video player would open here for: ${videoType}`);
        });
    });
    
    // Social Proof CTA
    if (socialProofCta) {
        socialProofCta.addEventListener('click', () => scrollToPricing(true));
    }
    
    // Features CTA
    if (featuresCta) {
        featuresCta.addEventListener('click', () => openEmailModal('features'));
    }
    
    // FAQ CTA
    if (faqCta) {
        faqCta.addEventListener('click', () => scrollToPricing(false));
    }
    
    // Results CTA
    if (resultsCta) {
        resultsCta.addEventListener('click', () => openEmailModal('results'));
    }
    
    // Support CTA
    if (supportCta) {
        supportCta.addEventListener('click', () => openEmailModal('support'));
    }
    
    // Mobile Sticky CTA
    if (mobileTrialBtn) {
        mobileTrialBtn.addEventListener('click', () => openEmailModal('mobile_sticky'));
    }
    
    // Contact Form Handler
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(contactForm);
            const submitBtn = contactForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            
            try {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Sending...';
                
                // Placeholder for actual form submission
                console.log('Contact form submitted:', Object.fromEntries(formData));
                
                // Simulate API call
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                alert('Message sent successfully! We\'ll respond within 24 hours.');
                contactForm.reset();
                
            } catch (error) {
                console.error('Contact form error:', error);
                alert('Failed to send message. Please try again.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }
    
    // Mobile sticky CTA visibility
    const mobileCta = document.getElementById('mobileCta');
    if (mobileCta) {
        let isVisible = false;
        
        window.addEventListener('scroll', () => {
            const scrolled = window.scrollY;
            const shouldShow = scrolled > 500 && window.innerWidth <= 768;
            
            if (shouldShow && !isVisible) {
                mobileCta.style.display = 'block';
                isVisible = true;
            } else if (!shouldShow && isVisible) {
                mobileCta.style.display = 'none';
                isVisible = false;
            }
        });
    }
});

// Test mode indicator
if (STRIPE_PUBLIC_KEY.includes('test')) {
    const testBadge = document.createElement('div');
    testBadge.style.cssText = 'position: fixed; top: 10px; right: 10px; background: orange; color: white; padding: 5px 10px; border-radius: 5px; font-size: 12px; z-index: 9999;';
    testBadge.textContent = 'TEST MODE';
    document.body.appendChild(testBadge);
}