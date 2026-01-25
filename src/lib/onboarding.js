
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

    showTestGridInfoModal() {
        const existing = document.getElementById('testGridInfoModal');
        if (existing) existing.remove();

        const modalHtml = `
            <div class="modal active" id="testGridInfoModal" style="z-index: 10002;">
                <div class="modal-content welcome-content" style="max-width: 600px;">
                    <div class="welcome-icon">📏</div>
                    <h2>Calibration Workflow</h2>
                    <p>Optimizing colors for stainless steel requires precise settings.</p>
                    
                    <div style="text-align: left; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border-primary); color: var(--text-primary); padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <ol style="margin: 0; padding-left: 20px; line-height: 1.8;">
                            <li><strong>Generate:</strong> Use the <strong>Standard Test Grid</strong> (covers most needs) or configure a custom range. Click <em>"Download XCS"</em>.</li>
                            <li><strong>Engrave:</strong> Run this file on your laser machine on the target material.</li>
                            <li><strong>Analyze:</strong> Take a clear photo of the result and upload it in the <strong>"Analyze Grid"</strong> tab.</li>
                        </ol>
                    </div>
                    
                    <p style="font-size: 0.9em; color: #666;">
                        The system will then auto-map your image colors to these proven settings!
                    </p>

                    <div class="modal-actions" style="justify-content: center;">
                        <button class="btn btn-primary" onclick="document.getElementById('testGridInfoModal').remove(); window.onboarding.markTestGridCompleted();">Got it</button>
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
                description: 'Review the output layers and vector paths here.',
                placement: 'left' // Changed to left side
            },
            {
                target: '#btnDownloadXCS',
                title: '5. Export',
                description: 'Click to download. <br><small><strong>Note:</strong> xTool Creative Space may take a while to render the vectors. The image might look weird until loading finishes.</small>',
                waitForAction: 'download'
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

        // Measure tooltip
        this.elements.tooltip.style.display = 'block';
        this.elements.tooltip.style.visibility = 'hidden';

        const tooltipWidth = this.elements.tooltip.offsetWidth || 320;
        const tooltipHeight = this.elements.tooltip.offsetHeight || 200;

        this.elements.tooltip.style.visibility = '';
        this.elements.tooltip.style.display = '';

        // Smart Positioning
        // Default: Bottom Center
        let top = rect.bottom + 20 + scrollY;
        let left = rect.left + (rect.width / 2) - (tooltipWidth / 2) + scrollX;
        let placement = step.placement || 'auto';

        // Check if bottom fits
        const bottomFits = (rect.bottom + 20 + tooltipHeight) < (window.scrollY + window.innerHeight);

        if (placement === 'top' || (placement === 'auto' && !bottomFits)) {
            // Try Top
            const topPos = rect.top - tooltipHeight - 20 + scrollY;
            if (topPos > window.scrollY) { // Only if it doesn't go off top
                top = topPos;
            }
        }

        if (placement === 'left') {
            top = rect.top + (rect.height / 2) - (tooltipHeight / 2) + scrollY;
            left = rect.left - tooltipWidth - 20 + scrollX;
        }

        // Horizontal Clamp
        const padding = 20;
        if (left < padding + scrollX) left = padding + scrollX;
        if (left + tooltipWidth > window.innerWidth - padding + scrollX) {
            left = window.innerWidth - tooltipWidth - padding + scrollX;
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
            // If this is the last step (Export), end the tour immediately with success
            if (this.currentStepIndex === this.tourSteps.length - 1) {
                this.endTour();
                // Optional: Show a "Tutorial Complete" toast via main app if possible, 
                // but sticking to silent close is fine as Download action usually shows its own feedback.
                return;
            }

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
        // TEST GRID markCompleted is handled by 'Got it' button in modal
    }
}
