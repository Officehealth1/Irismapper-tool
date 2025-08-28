// Parallax Scroll Effect with Proper Scroll Lock
(function() {
    // State variables
    let isLocked = false;
    let virtualScroll = 0;
    let animationProgress = 0;
    let heroSection = null;
    let nextSection = null;
    let progressBar = null;
    let scrollSensitivity = 0.1; // How fast the animation progresses
    
    // DOM element variables
    let eyeLayer, jensenMap, heroText, heroSubtext, heroCta;
    
    // Cache DOM elements
    function cacheElements() {
        heroSection = document.getElementById('hero');
        nextSection = document.querySelector('.how-it-works');
        progressBar = document.getElementById('scrollProgressBar');
        
        // Layer elements
        eyeLayer = document.querySelector('.parallax-eye');
        jensenMap = document.getElementById('jensen-map');
        heroText = document.getElementById('hero-text');
        heroSubtext = document.getElementById('hero-subtext');
        heroCta = document.getElementById('hero-cta');
    }
    
    // Animation stages for single Jensen map
    const stages = {
        0: {
            text: 'Professional iris mapping software',
            subtext: '',
            eyeScale: 1.0,
            jensenOpacity: 0
        },
        25: {
            text: 'Professional iris mapping software',
            subtext: 'Bernard Jensen diagnostic system',
            eyeScale: 1.03,
            jensenOpacity: 0.3
        },
        50: {
            text: 'Professional diagnostic zones',
            subtext: 'Precise organ zone mapping',
            eyeScale: 1.06,
            jensenOpacity: 0.6
        },
        75: {
            text: 'Advanced iris analysis',
            subtext: 'Trusted by practitioners worldwide',
            eyeScale: 1.09,
            jensenOpacity: 0.85
        },
        100: {
            text: 'Start your analysis today',
            subtext: '14-day free trial • No credit card required',
            eyeScale: 1.12,
            jensenOpacity: 1.0
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
        
        // Update Jensen map opacity
        if (jensenMap) {
            const jensenOpacity = getStageValue(progress, 'jensenOpacity');
            jensenMap.style.opacity = jensenOpacity;
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
    
    // Lock the scroll
    function lockScroll() {
        if (isLocked) return;
        
        isLocked = true;
        virtualScroll = 0;
        
        // Save current scroll position
        const scrollY = window.scrollY;
        
        // Lock body scroll
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = '100%';
        document.body.style.overflow = 'hidden';
        
        // Make hero section full screen during animation
        if (heroSection) {
            heroSection.style.height = '100vh';
            heroSection.style.minHeight = '100vh';
            heroSection.style.transition = 'height 0.3s ease, min-height 0.3s ease';
        }
        
        console.log('Scroll locked at position:', scrollY);
    }
    
    // Unlock the scroll
    function unlockScroll() {
        if (!isLocked) return;
        
        isLocked = false;
        
        // Restore scroll position
        const scrollY = Math.abs(parseInt(document.body.style.top || '0'));
        
        // Restore hero section to original size with smooth transition
        if (heroSection) {
            heroSection.style.height = '';
            heroSection.style.minHeight = '85vh';
            // Keep transition for smooth exit
            setTimeout(() => {
                heroSection.style.transition = '';
            }, 300);
        }
        
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        
        // Restore scroll position without jumping to next section
        window.scrollTo(0, scrollY);
        
        // Add visual completion indicator
        if (animationProgress >= 100) {
            console.log('Animation complete - scroll naturally unlocked');
        }
        
        console.log('Scroll unlocked');
    }
    
    // Handle scroll attempts while locked
    function handleScrollAttempt(delta) {
        if (!isLocked) return;
        
        // Update virtual scroll
        virtualScroll += delta;
        
        // Convert to progress (0-100)
        animationProgress = Math.max(0, Math.min(100, animationProgress + (delta * scrollSensitivity)));
        
        // Update animation
        updateAnimation(animationProgress);
        
        // Check if animation is complete
        if (animationProgress >= 100) {
            setTimeout(() => {
                unlockScroll();
            }, 500);
        }
    }
    
    // Check if we should lock/unlock based on scroll position
    function checkScrollPosition() {
        if (!heroSection) return;
        
        const rect = heroSection.getBoundingClientRect();
        const heroTop = rect.top;
        const heroBottom = rect.bottom;
        const windowHeight = window.innerHeight;
        
        // Should we lock? (Hero is taking up most of the viewport)
        if (heroTop <= 0 && heroBottom > windowHeight * 0.5 && animationProgress < 100) {
            if (!isLocked) {
                lockScroll();
            }
        }
        // Should we unlock? (scrolled past hero or animation complete)
        else if (isLocked && (heroTop > 100 || animationProgress >= 100)) {
            unlockScroll();
        }
        
        // Reset animation if scrolled back to top
        if (heroTop > 0 && animationProgress > 0) {
            animationProgress = 0;
            updateAnimation(0);
        }
    }
    
    // Initialize event listeners
    function initEvents() {
        // Wheel event (mouse scroll)
        window.addEventListener('wheel', function(e) {
            if (isLocked) {
                e.preventDefault();
                e.stopPropagation();
                handleScrollAttempt(e.deltaY);
                return false;
            }
        }, { passive: false, capture: true });
        
        // Keyboard events
        window.addEventListener('keydown', function(e) {
            if (isLocked) {
                const keys = [32, 33, 34, 35, 36, 37, 38, 39, 40]; // Space, Page Up/Down, End, Home, Arrow keys
                if (keys.includes(e.keyCode)) {
                    e.preventDefault();
                    
                    // Simulate scroll for common keys
                    let delta = 0;
                    switch(e.keyCode) {
                        case 32: // Space
                        case 34: // Page Down
                        case 40: // Arrow Down
                            delta = 100;
                            break;
                        case 33: // Page Up
                        case 38: // Arrow Up
                            delta = -100;
                            break;
                        case 35: // End
                            delta = 1000;
                            break;
                        case 36: // Home
                            delta = -1000;
                            break;
                    }
                    
                    if (delta !== 0) {
                        handleScrollAttempt(delta);
                    }
                    return false;
                }
            }
        }, { passive: false });
        
        // Touch events for mobile
        let touchStartY = 0;
        let touchStartTime = 0;
        
        window.addEventListener('touchstart', function(e) {
            if (isLocked) {
                touchStartY = e.touches[0].clientY;
                touchStartTime = Date.now();
            }
        }, { passive: true });
        
        window.addEventListener('touchmove', function(e) {
            if (isLocked) {
                e.preventDefault();
                const touchDelta = touchStartY - e.touches[0].clientY;
                const timeDelta = Date.now() - touchStartTime;
                
                if (timeDelta > 16) { // Throttle to ~60fps
                    handleScrollAttempt(touchDelta * 2); // Multiply for better mobile sensitivity
                    touchStartY = e.touches[0].clientY;
                    touchStartTime = Date.now();
                }
                return false;
            }
        }, { passive: false });
        
        // Regular scroll event (for detecting position)
        window.addEventListener('scroll', function() {
            if (!isLocked) {
                checkScrollPosition();
            }
        }, { passive: true });
        
        // Prevent scrollbar dragging
        window.addEventListener('mousedown', function(e) {
            if (isLocked && e.clientX > window.innerWidth - 20) {
                e.preventDefault();
                return false;
            }
        });
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
        
        // Check initial position
        checkScrollPosition();
        
        console.log('Parallax with scroll lock initialized');
    }
    
    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();