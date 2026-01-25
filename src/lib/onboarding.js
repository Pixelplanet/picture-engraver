
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
        if (this.hasCompletedOnboarding()) return;

        // Hide Process button initially for new users
        // It helps prevent "processing before asked"
        this.toggleProcessButton(false);

        setTimeout(() => this.showWelcomeModal(), 500);
    }

    toggleProcessButton(visible) {
        const btn = document.querySelector('#btnProcess');
        if (btn) {
            // Use opacity/pointer-events or display?
            // Display:none removes it from layout, might shift things.
            // Visibility:hidden preserves space.
            btn.style.visibility = visible ? 'visible' : 'hidden';
            // Also ensure display is not none if we are showing
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
                    <p style="font-size: 1.1em; line-height: 1.6;">
                        Easily convert your images into high-quality laser engraving files.
                        Let's walk through the basic workflow.
                    </p>
                    
                    <div class="privacy-notice">
                        <strong>🔒 Privacy Promise:</strong><br>
                        Everything runs 100% locally in your browser. Your images and settings never leave your device.
                    </div>

                    <div class="modal-actions" style="justify-content: center; gap: 15px;">
                        <button class="btn btn-secondary" onclick="document.getElementById('welcomeModal').remove(); window.onboarding.endTour();">Skip Tutorial</button>
                        <button class="btn btn-primary" onclick="window.onboarding.startMainTour()">Start Interactive Tour</button>
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
                onShow: () => this.toggleProcessButton(true) // Show button when this step starts
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
                target: '#gridSettings',
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
            // Check if element is missing because it's hidden (like btnProcess)
            // But we handled that with onShow?
            // If onShow exists, run it!
            if (step.onShow) step.onShow();

            // Re-query after onShow might have revealed it
            const targetElRetry = document.querySelector(step.target);
            if (!targetElRetry || targetElRetry.offsetParent === null) {
                // Still hidden, skip
                this.showStep(index + 1);
                return;
            }
            // Proceed with retry element
            this.positionElements(targetElRetry, step, index);
            // Scroll logic...
            targetElRetry.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        // Execute onShow if exists/needed
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
        const tooltipHeight = 220;

        let top = rect.bottom + 20 + scrollY;
        let left = rect.left + (rect.width / 2) - (tooltipWidth / 2) + scrollX;

        // Vertical Flip
        const spaceBelow = window.innerHeight - rect.bottom;
        if (spaceBelow < tooltipHeight && rect.top > tooltipHeight) {
            top = rect.top - tooltipHeight + scrollY;
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
