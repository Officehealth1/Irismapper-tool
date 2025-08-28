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
    
    // Cache DOM elements
    function cacheElements() {
        heroSection = document.getElementById('hero');
        nextSection = document.querySelector('.how-it-works');
        progressBar = document.getElementById('scrollProgressBar');
        
        // Layer elements
        this.eyeLayer = document.querySelector('.parallax-eye');
        this.map1 = document.getElementById('map1');
        this.map2 = document.getElementById('map2');
        this.map3 = document.getElementById('map3');
        this.map4 = document.getElementById('map4');
        this.map5 = document.getElementById('map5');
        this.heroText = document.getElementById('hero-text');
        this.heroSubtext = document.getElementById('hero-subtext');
        this.heroCta = document.getElementById('hero-cta');
        this.scrollIndicator = document.querySelector('.scroll-indicator');
    }
    
    // Animation stages
    const stages = {
        0: {
            text: 'Professional iris mapping software',
            subtext: '',
            eyeScale: 1.0,
            maps: [0, 0, 0, 0, 0]
        },
        20: {
            text: 'Professional iris mapping software',
            subtext: '8 professional mapping systems',
            eyeScale: 1.03,
            maps: [0.8, 0, 0, 0, 0]
        },
        40: {
            text: 'Choose your mapping system',
            subtext: 'Jensen • IrisLAB • Bourdiol • More',
            eyeScale: 1.06,
            maps: [0, 0.8, 0, 0, 0]
        },
        60: {
            text: 'Multiple mapping approaches',
            subtext: 'European & American traditions',
            eyeScale: 1.09,
            maps: [0, 0, 0.8, 0, 0]
        },
        80: {
            text: 'Advanced diagnostic tools',
            subtext: 'Jaussas • Angerer systems',
            eyeScale: 1.12,
            maps: [0, 0, 0, 0.8, 0]
        },
        100: {
            text: 'Start your journey today',
            subtext: '14-day free trial • No credit card required',
            eyeScale: 1.15,
            maps: [0, 0, 0, 0, 1]
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
        if (this.eyeLayer) {
            const scale = getStageValue(progress, 'eyeScale');
            this.eyeLayer.style.transform = `scale(${scale})`;
        }
        
        // Update map opacities
        const mapOpacities = getStageValue(progress, 'maps');
        if (this.map1) this.map1.style.opacity = mapOpacities[0];
        if (this.map2) this.map2.style.opacity = mapOpacities[1];
        if (this.map3) this.map3.style.opacity = mapOpacities[2];
        if (this.map4) this.map4.style.opacity = mapOpacities[3];
        if (this.map5) this.map5.style.opacity = mapOpacities[4];
        
        // Update text
        if (this.heroText) {
            this.heroText.textContent = getStageValue(progress, 'text');
        }
        if (this.heroSubtext) {
            const subtext = getStageValue(progress, 'subtext');
            this.heroSubtext.textContent = subtext;
            this.heroSubtext.style.opacity = subtext ? '1' : '0';
        }
        
        // Update CTA button
        if (this.heroCta) {
            this.heroCta.style.opacity = progress > 70 ? '1' : '0.3';
            this.heroCta.style.transform = progress > 70 ? 'scale(1.1)' : 'scale(1)';
        }
        
        // Hide scroll indicator
        if (this.scrollIndicator) {
            this.scrollIndicator.style.opacity = progress > 10 ? '0' : '1';
        }
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
        
        console.log('Scroll locked at position:', scrollY);
    }
    
    // Unlock the scroll
    function unlockScroll() {
        if (!isLocked) return;
        
        isLocked = false;
        
        // Restore scroll position
        const scrollY = Math.abs(parseInt(document.body.style.top || '0'));
        
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        
        // Scroll to next section
        if (nextSection && animationProgress >= 100) {
            window.scrollTo(0, scrollY);
            setTimeout(() => {
                nextSection.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        } else {
            window.scrollTo(0, scrollY);
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
        cacheElements.call(this);
        
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