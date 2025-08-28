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
const periodButtons = document.querySelectorAll('.period-btn');
const pricingCtas = document.querySelectorAll('.pricing-cta');

// Modal elements
const emailModal = document.getElementById('emailModal');
const emailInput = document.getElementById('emailInput');
const startTrialBtn = document.getElementById('startTrialBtn');
const cancelBtn = document.getElementById('cancelBtn');
const closeModal = document.getElementById('closeModal');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    updatePricingDisplay();
    
    // Period toggle
    periodButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            periodButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentPeriod = btn.dataset.period;
            updatePricingDisplay();
        });
    });
    
    // CTA buttons
    pricingCtas.forEach(btn => {
        btn.addEventListener('click', () => {
            currentTier = btn.dataset.plan;
            showEmailModal();
        });
    });
    
    // These CTAs link directly to pricing section via href, no JS needed
    // Removed unnecessary event listeners for non-existent elements
    
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
function updatePricingDisplay() {
    // Hide all price displays first
    document.querySelectorAll('.monthly-price, .yearly-price, .twoyear-price, .yearly-savings, .twoyear-savings').forEach(el => {
        el.style.display = 'none';
    });
    
    // Show appropriate price displays
    if (currentPeriod === 'monthly') {
        document.querySelectorAll('.monthly-price').forEach(el => el.style.display = 'block');
    } else if (currentPeriod === 'yearly') {
        document.querySelectorAll('.yearly-price').forEach(el => el.style.display = 'block');
        document.querySelectorAll('.yearly-savings').forEach(el => el.style.display = 'block');
    } else if (currentPeriod === '2year') {
        document.querySelectorAll('.twoyear-price').forEach(el => el.style.display = 'block');
        document.querySelectorAll('.twoyear-savings').forEach(el => el.style.display = 'block');
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
    resetModalButton();
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
                cancelUrl: window.location.origin + '/'
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
        resetModalButton();
    }
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
const headerCtaBtn = document.querySelector('.nav-cta-btn');
const resultsCta = document.getElementById('resultsCta');
const supportCta = document.getElementById('supportCta');
const mobileTrialBtn = document.getElementById('mobileTrialBtn');
const testimonialDemo = document.getElementById('testimonialDemo');
const faqContact = document.getElementById('faqContact');
const resultsDemo = document.getElementById('resultsDemo');

// FAQ inline CTAs
const faqInlineCtas = document.querySelectorAll('[data-source^="faq_"]');
// Results inline CTAs
const resultsInlineCtas = document.querySelectorAll('[data-source^="results_"]');

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
    
    // Header Navigation Links - Smooth Scrolling with offset for fixed header
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                const headerOffset = 80; // Height of fixed header
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                
                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // Hero CTAs
    if (heroTrialBtn) {
        heroTrialBtn.addEventListener('click', () => openEmailModal('hero_primary'));
    }
    
    if (heroDemoBtn) {
        heroDemoBtn.addEventListener('click', () => scrollToSection('demo-section'));
    }
    
    if (headerCtaBtn) {
        headerCtaBtn.addEventListener('click', () => openEmailModal('header_cta'));
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
        socialProofCta.addEventListener('click', () => openEmailModal('social_proof'));
    }
    
    if (testimonialDemo) {
        testimonialDemo.addEventListener('click', () => scrollToSection('demo-section'));
    }
    
    // Features CTA
    if (featuresCta) {
        featuresCta.addEventListener('click', () => openEmailModal('features'));
    }
    
    // FAQ CTA
    if (faqCta) {
        faqCta.addEventListener('click', () => openEmailModal('faq_final'));
    }
    
    if (faqContact) {
        faqContact.addEventListener('click', () => scrollToSection('contact'));
    }
    
    // FAQ inline CTAs
    faqInlineCtas.forEach(btn => {
        btn.addEventListener('click', () => {
            const source = btn.getAttribute('data-source');
            if (source === 'faq_trial') {
                openEmailModal('faq_trial');
            } else if (source === 'faq_clinic') {
                scrollToPricing(true);
            }
        });
    });
    
    // Results CTAs
    if (resultsCta) {
        resultsCta.addEventListener('click', () => openEmailModal('results_main'));
    }
    
    if (resultsDemo) {
        resultsDemo.addEventListener('click', () => scrollToSection('demo-section'));
    }
    
    // Results inline CTAs
    resultsInlineCtas.forEach(btn => {
        btn.addEventListener('click', () => {
            const source = btn.getAttribute('data-source');
            if (source === 'results_efficiency') {
                openEmailModal('results_efficiency');
            }
        });
    });
    
    // Support CTA
    if (supportCta) {
        supportCta.addEventListener('click', () => openEmailModal('support'));
    }
    
    // Mobile Sticky CTA
    if (mobileTrialBtn) {
        mobileTrialBtn.addEventListener('click', () => openEmailModal('mobile_sticky'));
    }
    
    // New Contact Section Button Handlers
    const bookSetupCall = document.getElementById('bookSetupCall');
    const chatWithUs = document.getElementById('chatWithUs');
    
    if (bookSetupCall) {
        bookSetupCall.addEventListener('click', () => {
            // Open calendar booking system (placeholder)
            console.log('Opening calendar booking system...');
            window.open('https://calendly.com/irismapper-support', '_blank');
        });
    }
    
    if (chatWithUs) {
        chatWithUs.addEventListener('click', () => {
            // Open live chat system (placeholder)
            console.log('Opening live chat...');
            // Replace with actual chat widget or mailto
            window.location.href = 'mailto:team@irislab.com?subject=Live%20Chat%20Request';
        });
    }
    
    // Contact Form Handler
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(contactForm);
            const submitBtn = contactForm.querySelector('.contact-submit-btn');
            const btnText = submitBtn.querySelector('.btn-text');
            const btnSpinner = submitBtn.querySelector('.btn-spinner');
            
            try {
                // Show loading state
                submitBtn.disabled = true;
                btnText.textContent = 'Sending...';
                btnSpinner.style.display = 'block';
                
                // Validate required fields
                const name = formData.get('name');
                const email = formData.get('email');
                const message = formData.get('message');
                
                if (!name || !email || !message) {
                    throw new Error('Please fill in all required fields.');
                }
                
                // Send to backend API
                const response = await fetch('/.netlify/functions/send-contact-email', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name: name,
                        email: email,
                        subject: formData.get('subject') || '',
                        message: message
                    })
                });

                // Handle different response scenarios
                let result;
                const contentType = response.headers.get('content-type');
                
                if (contentType && contentType.includes('application/json')) {
                    result = await response.json();
                } else {
                    const text = await response.text();
                    result = { error: text || 'Unknown server error' };
                }
                
                if (!response.ok) {
                    if (response.status === 405) {
                        throw new Error('Contact form is not available in development. Please use "npm run dev" or deploy to test the contact form.');
                    }
                    throw new Error(result.error || `Server error: ${response.status}`);
                }
                
                // Success
                alert(result.message || 'Message sent successfully! We\'ll respond within 24 hours.');
                contactForm.reset();
                
            } catch (error) {
                console.error('Contact form error:', error);
                alert('Error: ' + error.message);
            } finally {
                // Reset button state
                submitBtn.disabled = false;
                btnText.textContent = 'Send Message';
                btnSpinner.style.display = 'none';
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