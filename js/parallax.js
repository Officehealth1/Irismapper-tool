// Parallax Scroll Effect for Hero Section with Scroll Lock
(function() {
    let ticking = false;
    let scrollProgress = 0;
    let animationComplete = false;
    let lastScrollTop = 0;
    
    // Elements
    const hero = document.getElementById('hero');
    const eyeLayer = document.querySelector('.parallax-eye');
    const map1 = document.getElementById('map1');
    const map2 = document.getElementById('map2');
    const map3 = document.getElementById('map3');
    const heroText = document.getElementById('hero-text');
    const heroSubtext = document.getElementById('hero-subtext');
    const heroCta = document.getElementById('hero-cta');
    const scrollIndicator = document.querySelector('.scroll-indicator');
    const progressBar = document.getElementById('scrollProgressBar');
    
    // Animation stages configuration
    const stages = {
        0: {
            text: 'Professional iris mapping software',
            subtext: 'Discover the power of iris analysis',
            eyeScale: 1.0,
            map1Opacity: 0,
            map2Opacity: 0,
            map3Opacity: 0
        },
        20: {
            text: 'Professional iris mapping software',
            subtext: '8 professional mapping systems',
            eyeScale: 1.05,
            map1Opacity: 0.7,
            map2Opacity: 0,
            map3Opacity: 0
        },
        40: {
            text: 'Choose your mapping system',
            subtext: 'Jensen • IrisLAB • Angerer • More',
            eyeScale: 1.08,
            map1Opacity: 0,
            map2Opacity: 0.7,
            map3Opacity: 0
        },
        60: {
            text: 'Advanced analysis tools',
            subtext: 'Real-time adjustments & exports',
            eyeScale: 1.1,
            map1Opacity: 0,
            map2Opacity: 0,
            map3Opacity: 0.7
        },
        80: {
            text: 'Start your journey today',
            subtext: '14-day free trial • No credit card required',
            eyeScale: 1.12,
            map1Opacity: 0,
            map2Opacity: 0,
            map3Opacity: 0.9
        },
        100: {
            text: 'Start your journey today',
            subtext: 'Join thousands of practitioners',
            eyeScale: 1.15,
            map1Opacity: 0,
            map2Opacity: 0,
            map3Opacity: 1
        }
    };
    
    // Get interpolated value between stages
    function interpolate(progress, property) {
        const keys = Object.keys(stages).map(Number).sort((a, b) => a - b);
        
        // Find surrounding stages
        let lowerKey = 0;
        let upperKey = 100;
        
        for (let i = 0; i < keys.length - 1; i++) {
            if (progress >= keys[i] && progress <= keys[i + 1]) {
                lowerKey = keys[i];
                upperKey = keys[i + 1];
                break;
            }
        }
        
        // Calculate interpolation
        const lowerValue = stages[lowerKey][property];
        const upperValue = stages[upperKey][property];
        
        if (typeof lowerValue === 'number') {
            const range = upperKey - lowerKey;
            const localProgress = (progress - lowerKey) / range;
            return lowerValue + (upperValue - lowerValue) * localProgress;
        }
        
        // For text, use threshold switching
        return progress >= upperKey / 2 + lowerKey / 2 ? upperValue : lowerValue;
    }
    
    // Update parallax based on scroll
    function updateParallax(scrollDelta = 0) {
        if (!hero) return;
        
        const heroRect = hero.getBoundingClientRect();
        const heroHeight = hero.offsetHeight;
        const windowHeight = window.innerHeight;
        
        // Calculate scroll progress (0-100) based on virtual scroll
        if (scrollDelta !== 0 && !animationComplete) {
            // Update progress based on scroll delta when locked
            scrollProgress = Math.min(100, Math.max(0, scrollProgress + (scrollDelta * 0.05)));
        } else if (!animationComplete) {
            // Normal scroll progress calculation
            if (heroRect.top <= 0 && heroRect.bottom > 0) {
                scrollProgress = Math.min(100, Math.max(0, (-heroRect.top / heroHeight) * 100));
            } else if (heroRect.top > 0) {
                scrollProgress = 0;
            }
        }
        
        // Check if animation is complete
        if (scrollProgress >= 100) {
            animationComplete = true;
        } else if (scrollProgress <= 0 && window.scrollY === 0) {
            animationComplete = false;
        }
        
        // Apply transformations
        if (eyeLayer) {
            const scale = interpolate(scrollProgress, 'eyeScale');
            eyeLayer.style.transform = `scale(${scale})`;
        }
        
        // Update map opacities
        if (map1) map1.style.opacity = interpolate(scrollProgress, 'map1Opacity');
        if (map2) map2.style.opacity = interpolate(scrollProgress, 'map2Opacity');
        if (map3) map3.style.opacity = interpolate(scrollProgress, 'map3Opacity');
        
        // Update text
        if (scrollProgress > 5) {
            if (heroText) heroText.textContent = interpolate(scrollProgress, 'text');
            if (heroSubtext) {
                heroSubtext.textContent = interpolate(scrollProgress, 'subtext');
                heroSubtext.style.opacity = '1';
            }
        } else {
            if (heroSubtext) heroSubtext.style.opacity = '0';
        }
        
        // Hide scroll indicator after scrolling starts
        if (scrollIndicator) {
            scrollIndicator.style.opacity = scrollProgress > 10 ? '0' : '1';
            scrollIndicator.style.pointerEvents = scrollProgress > 10 ? 'none' : 'auto';
        }
        
        // Show/hide CTA based on progress
        if (heroCta) {
            heroCta.style.opacity = scrollProgress > 70 ? '1' : '0.3';
            heroCta.style.transform = scrollProgress > 70 ? 'scale(1.1)' : 'scale(1)';
        }
        
        // Update progress bar
        if (progressBar) {
            progressBar.style.width = scrollProgress + '%';
        }
        
        ticking = false;
    }
    
    // Request animation frame for smooth performance
    function requestTick() {
        if (!ticking) {
            requestAnimationFrame(updateParallax);
            ticking = true;
        }
    }
    
    // Scroll event listener
    function onScroll() {
        requestTick();
    }
    
    // Implement scroll lock during animation
    function initScrollLock() {
        let scrollAccumulator = 0;
        
        // Wheel event for scroll locking
        window.addEventListener('wheel', function(e) {
            const heroRect = hero.getBoundingClientRect();
            const heroBottom = heroRect.bottom;
            const isInHero = heroRect.top <= 0 && heroBottom > 100;
            
            // Lock scroll while in hero and animation not complete
            if (isInHero && !animationComplete) {
                e.preventDefault();
                
                // Accumulate scroll to progress the animation
                scrollAccumulator += e.deltaY;
                
                // Update parallax with scroll delta
                updateParallax(e.deltaY);
                
                // Once animation is complete, scroll to next section
                if (animationComplete) {
                    setTimeout(() => {
                        const nextSection = document.querySelector('.how-it-works');
                        if (nextSection) {
                            nextSection.scrollIntoView({ behavior: 'smooth' });
                        }
                    }, 300);
                }
            }
        }, { passive: false });
        
        // Touch events for mobile
        let touchStartY = 0;
        
        window.addEventListener('touchstart', function(e) {
            touchStartY = e.touches[0].clientY;
        }, { passive: true });
        
        window.addEventListener('touchmove', function(e) {
            const heroRect = hero.getBoundingClientRect();
            const isInHero = heroRect.top <= 0 && heroRect.bottom > 100;
            
            if (isInHero && !animationComplete) {
                e.preventDefault();
                
                const touchDelta = touchStartY - e.touches[0].clientY;
                updateParallax(touchDelta);
                
                touchStartY = e.touches[0].clientY;
            }
        }, { passive: false });
        
        // Regular scroll event for fallback
        window.addEventListener('scroll', function() {
            const currentScrollTop = window.scrollY;
            const heroRect = hero.getBoundingClientRect();
            
            // If trying to scroll past hero before animation complete
            if (!animationComplete && heroRect.top < -10 && scrollProgress < 100) {
                window.scrollTo(0, lastScrollTop);
            } else {
                lastScrollTop = currentScrollTop;
            }
            
            requestTick();
        }, { passive: true });
    }
    
    // Initialize
    function init() {
        if (!hero) return;
        
        // Set initial state
        updateParallax();
        
        // Add event listeners
        window.addEventListener('resize', requestTick, { passive: true });
        
        // Enable scroll lock for controlled animation
        initScrollLock();
    }
    
    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();