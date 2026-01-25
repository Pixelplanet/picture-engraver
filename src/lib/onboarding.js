
export class OnboardingManager {
    constructor() {
        this.STORAGE_KEY = 'pictureEngraver_onboarding';
        this.currentStepIndex = 0;
        this.tourSteps = [];
        this.isActive = false;

        this.elements = {
            overlay: null, // Removed in favor of box-shadow on highlight, but kept for cleanup safety
            tooltip: null,
            highlight: null
        };
    }

    init() {
        if (this.hasCompletedOnboarding()) return;
        setTimeout(() => this.showWelcomeModal(), 500);
    }

    hasCompletedOnboarding() {
        return localStorage.getItem(this.STORAGE_KEY) === 'completed';
    }

    markCompleted() {
        localStorage.setItem(this.STORAGE_KEY, 'completed');
    }

    showWelcomeModal() {
        // Remove exists
        const existing = document.getElementById('welcomeModal');
        if (existing) existing.remove();

        const modalHtml = `
            <div class="modal active" id="welcomeModal" style="z-index: 10000;">
                <div class="modal-content welcome-content">
                    <div class="welcome-icon">👋</div>
                    <h2>Welcome to Picture Engraver!</h2>
                    <p style="font-size: 1.1em; line-height: 1.6;">
                        Easily convert your images into high-quality laser engraving files for stainless steel.
                        We'll guide you through the process step-by-step.
                    </p>
                    
                    <div class="privacy-notice">
                        <strong>🔒 Privacy Promise:</strong><br>
                        Everything runs 100% locally in your browser. Your images and settings never leave your device.
                    </div>

                    <div class="modal-actions" style="justify-content: center; gap: 15px;">
                        <button class="btn btn-secondary" onclick="document.getElementById('welcomeModal').remove(); window.onboarding.markCompleted();">Skip Tutorial</button>
                        <button class="btn btn-primary" onclick="window.onboarding.startTour()">Start Interactive Tour</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    startTour() {
        const modal = document.getElementById('welcomeModal');
        if (modal) modal.remove();

        this.isActive = true;
        this.currentStepIndex = 0;
        this.createTourElements();

        this.tourSteps = [
            {
                target: '#dropZone',
                title: '1. Upload Image',
                description: 'Drag & drop an image here or click to browse. We support PNG, JPG.',
                waitForAction: 'upload'
            },
            {
                target: '#controlsSection',
                title: '2. Adjust Settings',
                description: 'Set your output size, engraving power, and speed. Choosing the right "Number of Colors" is key.'
            },
            {
                target: '#btnTestGrid',
                title: '3. Calibrate Colors',
                description: 'Generate a Test Grid on your material to know exactly what params produce what colors. Then use "Analyze Grid".'
            },
            {
                target: '#btnProcess',
                title: '4. Process',
                description: 'Click "Process Image" to vectorize your image into layers.',
                waitForAction: 'process'
            },
            {
                target: '#layersPanel',
                title: '5. Auto-Assign',
                description: 'Use our new "Auto-Assign" button to instantly match layers to your saved Test Grid calibration!'
            },
            {
                target: '#previewPanel',
                title: '6. Preview Results',
                description: 'Check the "Vectors" tab to see exactly what the laser will follow.'
            },
            {
                target: '#btnDownloadXCS',
                title: '7. Export',
                description: 'Download the final .xcs file ready for xTool Creative Space.'
            }
        ];

        this.showStep(0);
    }

    createTourElements() {
        // Highlight Box (Spotlight)
        this.elements.highlight = document.createElement('div');
        this.elements.highlight.className = 'tour-highlight';
        document.body.appendChild(this.elements.highlight);

        // Tooltip
        this.elements.tooltip = document.createElement('div');
        this.elements.tooltip.className = 'tour-tooltip';
        document.body.appendChild(this.elements.tooltip);
    }

    showStep(index) {
        if (index >= this.tourSteps.length) {
            this.endTour();
            return;
        }

        const step = this.tourSteps[index];
        const targetEl = document.querySelector(step.target);

        if (!targetEl) {
            // Skip step if element missing
            this.showStep(index + 1);
            return;
        }

        // 1. Position Highlight
        const rect = targetEl.getBoundingClientRect();
        const highlightPadding = 10;
        const scrollY = window.scrollY;

        Object.assign(this.elements.highlight.style, {
            top: `${rect.top - highlightPadding + scrollY}px`,
            left: `${rect.left - highlightPadding}px`,
            width: `${rect.width + (highlightPadding * 2)}px`,
            height: `${rect.height + (highlightPadding * 2)}px`
        });

        // 2. Setup Tooltip Content
        let btnNextText = index === this.tourSteps.length - 1 ? 'Finish' : 'Next →';
        let isWaiting = false;

        if (step.waitForAction) {
            isWaiting = true;
            btnNextText = 'Waiting for you...';
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

        // 3. Position Tooltip
        let tooltipTop = rect.bottom + 20 + scrollY;
        let tooltipLeft = rect.left + (rect.width / 2) - 150; // Center

        // Boundary checks
        if (tooltipLeft < 20) tooltipLeft = 20;
        if (tooltipLeft + 300 > window.innerWidth) tooltipLeft = window.innerWidth - 320;

        // If too low, flip to top
        const tooltipHeight = 200; // Approx
        if (rect.bottom + tooltipHeight > window.innerHeight) {
            tooltipTop = rect.top - tooltipHeight + scrollY - 20;
        }

        Object.assign(this.elements.tooltip.style, {
            top: `${tooltipTop}px`,
            left: `${tooltipLeft}px`
        });

        this.elements.tooltip.classList.add('active');

        // Scroll into view
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    handleAction(actionName) {
        if (!this.isActive) return;
        const currentStep = this.tourSteps[this.currentStepIndex];

        if (currentStep && currentStep.waitForAction === actionName) {
            // Flash success? 
            const btn = document.getElementById('tourNextBtn');
            if (btn) {
                btn.innerText = 'Great! Next →';
                btn.disabled = false;
                // Auto advance after short delay
                setTimeout(() => this.nextStep(), 800);
            } else {
                this.nextStep();
            }
        }
    }

    nextStep() {
        // Prevent manual next if waiting? 
        // No, user might want to force next if detection fails, 
        // but we disabled the button for waitForAction steps.
        this.currentStepIndex++;
        this.showStep(this.currentStepIndex);
    }

    endTour() {
        if (this.elements.highlight) this.elements.highlight.remove();
        if (this.elements.tooltip) this.elements.tooltip.remove();

        this.isActive = false;
        this.markCompleted();
    }
}
