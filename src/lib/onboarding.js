
export class OnboardingManager {
    constructor() {
        this.STORAGE_KEY = 'pictureEngraver_onboarding';
        this.currentStepIndex = 0;
        this.tourSteps = [];
        this.isActive = false;
        this.currentTourType = null;

        this.elements = {
            highlight: null,
            tooltip: null
        };
    }

    init() {
        // Always check completion status
        if (this.hasCompletedOnboarding()) return;

        // Hide Process button initially for new users
        this.toggleProcessButton(false);

        // Show welcome/consent modal
        setTimeout(() => this.showWelcomeModal(), 500);
    }

    toggleProcessButton(visible) {
        const btn = document.querySelector('#btnProcess');
        if (btn) {
            btn.style.visibility = visible ? 'visible' : 'hidden';
            if (visible) btn.style.display = '';
        }
    }

    hasCompletedOnboarding() {
        return localStorage.getItem(this.STORAGE_KEY) === 'completed';
    }

    markCompleted() {
        localStorage.setItem(this.STORAGE_KEY, 'completed');
    }

    hasCompletedTestGridTour() {
        return localStorage.getItem(this.STORAGE_KEY + '_testgrid') === 'completed';
    }

    markTestGridCompleted() {
        localStorage.setItem(this.STORAGE_KEY + '_testgrid', 'completed');
    }

    showWelcomeModal() {
        const existing = document.getElementById('welcomeModal');
        if (existing) existing.remove();

        const modalHtml = `
            <div class="modal active" id="welcomeModal" style="z-index: 10000;">
                <div class="modal-content welcome-content">
                    <div class="welcome-icon">👋</div>
                    <h2>Welcome to Picture Engraver!</h2>
                    
                    <div class="privacy-notice" style="background: rgba(0, 122, 255, 0.05); border: 1px solid var(--border-primary); padding: 20px; border-radius: 8px;">
                        <h4 style="margin-top: 0; color: var(--accent-primary);">🍪 Cookie & Privacy Consent</h4>
                        <p style="margin-bottom: 10px;">
                            This website uses <strong>Local Storage</strong> (similar to cookies) to save your settings and preferences. 
                            This is required for the application to function.
                        </p>
                        <p style="margin-bottom: 0;">
                            <strong>Privacy Promise:</strong> Everything runs 100% locally in your browser. 
                            Your images never leave your device. We track nothing externally.
                        </p>
                    </div>

                    <p>
                        Ready to learn how to create perfect engravings?
                    </p>

                    <div class="modal-actions" style="justify-content: center; gap: 15px;">
                        <button class="btn btn-secondary" onclick="document.getElementById('welcomeModal').remove(); window.onboarding.endTour();">Accept & Skip</button>
                        <button class="btn btn-primary" onclick="window.onboarding.startMainTour()">Accept & Start Tour</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    createTourElements() {
        if (!this.elements.highlight) {
            this.elements.highlight = document.createElement('div');
            this.elements.highlight.className = 'tour-highlight';
            document.body.appendChild(this.elements.highlight);
        }

        if (!this.elements.tooltip) {
            this.elements.tooltip = document.createElement('div');
            this.elements.tooltip.className = 'tour-tooltip';
            document.body.appendChild(this.elements.tooltip);
        }
    }

    startMainTour() {
        const modal = document.getElementById('welcomeModal');
        if (modal) modal.remove();

        this.isActive = true;
        this.currentTourType = 'main';
        this.currentStepIndex = 0;
        this.createTourElements();

        // Ensure Process Button is HIDDEN at start of tour
        this.toggleProcessButton(false);

        this.tourSteps = [
            {
                target: '#dropZone',
                title: '1. Upload Image',
                description: 'Start by dragging & dropping an image here.',
                waitForAction: 'upload'
            },
            {
                target: '#controlsSection',
                title: '2. Adjust Settings',
                description: 'Set your size and parameters. The <strong>Dithering</strong> slider controls how many colors are used.'
            },
            {
                target: '#btnProcess',
                title: '3. Process',
                description: 'Click "Process Image" to convert your picture into laser-ready vectors.',
                waitForAction: 'process',
                onShow: () => this.toggleProcessButton(true)
            },
            {
                target: '#previewPanel',
                title: '4. Preview Results',
                description: 'Review the output layers and vector paths here.'
            },
            {
                target: '#btnDownloadXCS',
                title: '5. Export',
                description: 'Download the .xcs file and you are ready to engrave!'
            }
        ];

        this.showStep(0);
    }

    startTestGridTour() {
        this.isActive = true;
        this.currentTourType = 'testgrid';
        this.currentStepIndex = 0;
        this.createTourElements();

        this.tourSteps = [
            {
                target: '.setting-group', // Use class selector for stability
                title: 'Test Grid Settings',
                description: 'Configure the Power, Speed, and Frequency ranges relevant to your material.'
            },
            {
                target: '#btnGenerateGrid',
                title: 'Generate Grid',
                description: 'Create an XCS, run it on your laser, and take a photo of the resulting grid.'
            },
            {
                target: '.modal-tab[data-modal-tab="analyze"]',
                title: 'Analyze',
                description: 'Switch to the "Analyze Grid" tab to upload your photo and auto-calibrate colors.'
            }
        ];

        this.showStep(0);
    }

    showStep(index) {
        if (index >= this.tourSteps.length) {
            this.endTour();
            return;
        }

        const step = this.tourSteps[index];
        const targetEl = document.querySelector(step.target);

        if (!targetEl || targetEl.offsetParent === null) {
            if (step.onShow) step.onShow();
            const targetElRetry = document.querySelector(step.target);
            if (!targetElRetry || targetElRetry.offsetParent === null) {
                this.showStep(index + 1);
                return;
            }
            this.positionElements(targetElRetry, step, index);
            targetElRetry.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        if (step.onShow) step.onShow();

        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

        requestAnimationFrame(() => {
            this.positionElements(targetEl, step, index);
        });
    }

    positionElements(targetEl, step, index) {
        const rect = targetEl.getBoundingClientRect();
        const highlightPadding = 10;
        const scrollY = window.scrollY;
        const scrollX = window.scrollX;

        // Position Highlight
        Object.assign(this.elements.highlight.style, {
            top: `${rect.top - highlightPadding + scrollY}px`,
            left: `${rect.left - highlightPadding + scrollX}px`,
            width: `${rect.width + (highlightPadding * 2)}px`,
            height: `${rect.height + (highlightPadding * 2)}px`
        });

        // Setup Tooltip Content
        let btnNextText = index === this.tourSteps.length - 1 ? 'Finish' : 'Next →';
        let isWaiting = false;

        if (step.waitForAction) {
            isWaiting = true;
            btnNextText = 'Waiting for action...';
        }

        this.elements.tooltip.innerHTML = `
            <h3>${step.title}</h3>
            <p>${step.description}</p>
            <div class="tour-tooltip-footer">
                <button class="btn-tour-skip" onclick="window.onboarding.endTour()">Stop Tutorial</button>
                <div style="flex:1"></div>
                <button class="btn-tour-next" id="tourNextBtn" onclick="window.onboarding.nextStep()" ${isWaiting ? 'disabled' : ''}>
                    ${btnNextText}
                </button>
            </div>
        `;

        // Smart Positioning
        const tooltipWidth = 320;
        const tooltipHeight = 250; // Use max-height from CSS as guidance

        // Initial: Bottom Center
        let top = rect.bottom + 20 + scrollY;
        let left = rect.left + (rect.width / 2) - (tooltipWidth / 2) + scrollX;

        // Vertical Flip
        // If bottom of tooltip would go off screen
        if (rect.bottom + tooltipHeight + 20 > window.innerHeight) {
            // Flip up
            top = rect.top - tooltipHeight + scrollY;
            // If going off top (element at top of screen)
            if (rect.top - tooltipHeight < 0) {
                // Stick to bottom, but use scrollable tooltip
                top = rect.bottom + 20 + scrollY;
                // CSS max-height will handle overflow
            }
        }

        // Horizontal Clamp
        const padding = 20;
        if (left < padding) left = padding;
        if (left + tooltipWidth > window.innerWidth - padding) {
            left = window.innerWidth - tooltipWidth - padding;
        }

        Object.assign(this.elements.tooltip.style, {
            top: `${top}px`,
            left: `${left}px`
        });

        this.elements.tooltip.classList.add('active');
    }

    handleAction(actionName) {
        if (!this.isActive) return;
        const currentStep = this.tourSteps[this.currentStepIndex];

        if (currentStep && currentStep.waitForAction === actionName) {
            const btn = document.getElementById('tourNextBtn');
            if (btn) {
                btn.innerText = 'Success! Next →';
                btn.disabled = false;
                setTimeout(() => this.nextStep(), 600);
            } else {
                this.nextStep();
            }
        }
    }

    nextStep() {
        this.currentStepIndex++;
        this.showStep(this.currentStepIndex);
    }

    endTour() {
        if (this.elements.highlight) this.elements.highlight.remove();
        if (this.elements.tooltip) this.elements.tooltip.remove();
        this.elements.highlight = null;
        this.elements.tooltip = null;
        this.isActive = false;

        // Restore Process Button Visibility
        this.toggleProcessButton(true);

        if (this.currentTourType === 'main') this.markCompleted();
        if (this.currentTourType === 'testgrid') this.markTestGridCompleted();
    }
}
