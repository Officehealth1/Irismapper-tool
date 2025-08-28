// Parallax Scroll Effect with Sticky Pin Scrubbing (no body lock)
(function() {
    // State variables
    let animationProgress = 0; // 0..100
    let heroSection = null;
    let heroPin = null;
    let nextSection = null;
    let progressBar = null;
    let rafId = null;
    
    // DOM element variables
    let eyeLayer, jensenMap, heroText, heroSubtext, heroCta;
    
    // Cache DOM elements
    function cacheElements() {
        heroSection = document.getElementById('hero');
        heroPin = document.getElementById('heroPin');
        nextSection = document.querySelector('.how-it-works');
        progressBar = document.getElementById('scrollProgressBar');
        
        // Layer elements
        eyeLayer = document.querySelector('.parallax-eye');
        jensenMap = document.getElementById('jensen-map');
        heroText = document.getElementById('hero-text');
        heroSubtext = document.getElementById('hero-subtext');
        heroCta = document.getElementById('hero-cta');
    }
    
    // Animation stages tuned for IrisLAB map
    const stages = {
        0: {
            text: 'Professional iris mapping software',
            subtext: '',
            eyeScale: 1.00,
            jensenOpacity: 0.00
        },
        25: {
            text: 'Professional iris mapping software',
            subtext: 'IrisLAB professional mapping system',
            eyeScale: 1.02,
            jensenOpacity: 0.25
        },
        50: {
            text: 'IrisLAB diagnostic zones',
            subtext: 'Precise organ zone definitions',
            eyeScale: 1.05,
            jensenOpacity: 0.55
        },
        75: {
            text: 'Advanced iris analysis',
            subtext: 'IrisLAB alignment and analysis',
            eyeScale: 1.07,
            jensenOpacity: 0.80
        },
        100: {
            text: 'Start your analysis today',
            subtext: '14-day free trial • No credit card required',
            eyeScale: 1.09,
            jensenOpacity: 0.92
        }
    };
    
    // Get interpolated values
    function getStageValue(progress, property) {
        const keys = Object.keys(stages).map(Number).sort((a, b) => a - b);
        let lower = 0, upper = 100;
        
        for (let i = 0; i < keys.length - 1; i++) {
            if (progress >= keys[i] && progress <= keys[i + 1]) {
                lower = keys[i];
                upper = keys[i + 1];
                break;
            }
        }
        
        const lowerVal = stages[lower][property];
        const upperVal = stages[upper][property];
        
        if (typeof lowerVal === 'number') {
            const t = (progress - lower) / (upper - lower);
            return lowerVal + (upperVal - lowerVal) * t;
        } else if (Array.isArray(lowerVal)) {
            return lowerVal.map((val, i) => {
                const t = (progress - lower) / (upper - lower);
                return val + (upperVal[i] - val) * t;
            });
        }
        
        // For text, switch at midpoint
        return progress >= (upper + lower) / 2 ? upperVal : lowerVal;
    }
    
    // Update the visual elements based on progress
    function updateAnimation(progress) {
        if (!heroSection) return;
        
        // Update progress bar
        if (progressBar) {
            progressBar.style.width = progress + '%';
        }
        
        // Update eye scale
        if (eyeLayer) {
            const scale = getStageValue(progress, 'eyeScale');
            eyeLayer.style.transform = `scale(${scale})`;
        }
        
        // Update IrisLAB map opacity and subtle depth translate
        if (jensenMap) {
            const jensenOpacity = getStageValue(progress, 'jensenOpacity');
            jensenMap.style.opacity = jensenOpacity;
            const translate = (1 - (progress / 100)) * 6; // 6px -> 0px
            jensenMap.style.transform = `translateY(${translate}px)`;
        }
        
        // Update text
        if (heroText) {
            heroText.textContent = getStageValue(progress, 'text');
        }
        if (heroSubtext) {
            const subtext = getStageValue(progress, 'subtext');
            heroSubtext.textContent = subtext;
            heroSubtext.style.opacity = subtext ? '1' : '0';
        }
        
        // Update CTA button - only show when animation is complete
        if (heroCta) {
            heroCta.style.opacity = progress >= 100 ? '1' : '0';
            heroCta.style.transform = progress >= 100 ? 'scale(1.1)' : 'scale(1)';
        }
        
        // Scroll indicator removed from HTML
    }
    
    // Compute progress from real scroll within pin wrapper
    function computeProgressFromScroll() {
        if (!heroPin) return 0;
        const pinRect = heroPin.getBoundingClientRect();
        const viewport = window.innerHeight;
        const total = pinRect.height - viewport; // scrub distance
        const travelled = Math.min(Math.max(-pinRect.top, 0), total);
        const progress = total > 0 ? (travelled / total) * 100 : 0;
        return Math.max(0, Math.min(100, progress));
    }
    
    // Initialize event listeners
    function initEvents() {
        const onScroll = () => {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                const p = computeProgressFromScroll();
                animationProgress = p;
                updateAnimation(animationProgress);
            });
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll, { passive: true });
    }
    
    // Initialize
    function init() {
        cacheElements();
        
        if (!heroSection) {
            console.log('Hero section not found');
            return;
        }
        
        // Set initial state
        updateAnimation(0);
        
        // Initialize events
        initEvents();
        
        // Initial paint based on scroll
        const p = computeProgressFromScroll();
        animationProgress = p;
        updateAnimation(animationProgress);
        
        console.log('Parallax sticky pin initialized');
    }
    
    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();