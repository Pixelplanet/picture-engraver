
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
        // Check for mobile device first
        if (this.isMobile()) {
            this.showMobileWarning();
            // Ensure process button is visible for mobile users since they skip tour
            this.toggleProcessButton(true);
            return;
        }

        // Skip onboarding for virtual devices (SVG mode) - will have separate onboarding later
        if (this.isVirtualDevice()) {
            this.toggleProcessButton(true);
            return;
        }

        // Always check completion status
        if (this.hasCompletedOnboarding()) return;

        // Hide Process button initially for new users
        this.toggleProcessButton(false);

        // Show welcome/consent modal
        setTimeout(() => this.showWelcomeModal(), 500);
    }

    /**
     * Check if current device is virtual (SVG export mode)
     * @returns {boolean}
     */
    isVirtualDevice() {
        try {
            const settings = JSON.parse(localStorage.getItem('pictureEngraverSettings') || '{}');
            return settings.activeDevice === 'svg_export';
        } catch {
            return false;
        }
    }

    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    showMobileWarning() {
        const modalHtml = `
            <div class="modal active" id="mobileWarningModal" style="z-index: 10000; background: rgba(0,0,0,0.9);">
                <div class="modal-content welcome-content" style="max-width: 400px; border: 1px solid #ff4444;">
                    <div class="welcome-header">
                        <div class="welcome-icon">📱</div>
                        <h2 style="margin: 0; color: #ff4444;">Desktop Required</h2>
                    </div>
                    
                    <div class="welcome-body" style="text-align: center;">
                        <p style="margin-bottom: 15px; line-height: 1.6;">
                            Picture Engraver is a powerful image processing tool designed for <strong>desktop computers</strong>.
                        </p>
                         <p style="margin-bottom: 15px; line-height: 1.6; font-size: 0.9em; color: #aaa;">
                            The interface and canvas controls are not optimized for touch screens or small displays.
                        </p>
                    </div>

                    <div class="welcome-footer">
                        <div class="modal-actions" style="justify-content: center;">
                            <button class="btn btn-secondary" onclick="document.getElementById('mobileWarningModal').remove();">I Understand, Continue Anyway</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
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
                    <div class="welcome-content" style="max-width: 550px;">
                        <div class="welcome-header">
                            <h2 style="margin: 0;">Welcome to Picture Engraver!</h2>
                        </div>
                    
                        <div class="welcome-body" style="text-align: left;">
                            <div class="app-info-notice" style="background: rgba(88, 166, 255, 0.05); border: 1px solid var(--border-primary); padding: 20px; border-radius: 8px; margin-bottom: 15px;">
                                <h4 style="margin-top: 0; color: var(--accent-primary); margin-bottom: 8px;">🚀 About this App</h4>
                                <p style="margin-bottom: 15px; font-size: 0.95rem; line-height: 1.5;">
                                This tool automates the creation of multi-colored laser engravings by converting images into calibrated vector layers. 
                                By using your own test-grid results, it perfectly tunes Frequency and LPC settings for every color in your photo.
                            </p>
                            
                            <h4 style="margin-top: 20px; color: var(--accent-danger); margin-bottom: 8px;">⚠️ Hardware Compatibility</h4>
                            <p style="margin-bottom: 0; font-size: 0.95rem; line-height: 1.5; border-left: 3px solid var(--accent-danger); padding-left: 12px;">
                                This application is currently optimized <strong>exclusively for the XTool F2 Ultra UV</strong>. 
                                It will not function correctly with other laser models at this time.
                            </p>
                        </div>

                        <div class="privacy-notice" style="text-align: left; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-primary); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                            <h4 style="margin-top: 0; font-size: 0.9rem; color: var(--text-secondary);">🍪 Privacy & Storage</h4>
                            <p style="margin-bottom: 0; font-size: 0.85rem; color: var(--text-secondary);">
                                We use Local Storage to save your settings. All processing happens 100% locally in your browser.
                                Your images never leave your device.
                            </p>
                        </div>

                        <p style="margin-bottom: 5px; font-weight: 500; text-align: center;">
                            Ready to learn how to create perfect engravings?
                        </p>
                    </div>

                    <div class="welcome-footer">
                        <div class="modal-actions" style="justify-content: center; gap: 15px;">
                            <button class="btn btn-secondary" onclick="window.onboarding.skipOnboarding()">Accept & Skip</button>
                            <button class="btn btn-primary" onclick="window.onboarding.startMainTour()">Accept & Start Tour</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    skipOnboarding() {
        const modal = document.getElementById('welcomeModal');
        if (modal) modal.remove();
        this.markCompleted();
        this.toggleProcessButton(true);
    }

    showTestGridInfoModal() {
        const existing = document.getElementById('testGridInfoModal');
        if (existing) existing.remove();

        const modalHtml = `
            <div class="modal active" id="testGridInfoModal" style="z-index: 10002;">
                <div class="modal-content welcome-content" style="max-width: 600px;">
                    <div class="welcome-header">
                        <div class="welcome-icon" style="margin-bottom: 10px;">📏</div>
                        <h2 style="margin: 0;">Calibration Workflow</h2>
                    </div>
                    
                    <div class="welcome-body" style="padding-top: 10px;">
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
                    </div>

                    <div class="welcome-footer">
                        <div class="modal-actions" style="justify-content: center;">
                            <button class="btn btn-primary" onclick="document.getElementById('testGridInfoModal').remove(); window.onboarding.markTestGridCompleted();">Got it</button>
                        </div>
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

        // Add window listeners for responsiveness
        if (!this._listenersInitialized) {
            window.addEventListener('resize', () => {
                if (this.isActive) this.updateCurrentStepPosition();
            });
            window.addEventListener('scroll', () => {
                if (this.isActive) this.updateCurrentStepPosition();
            }, true); // Use capture to catch scroll events in nested containers
            this._listenersInitialized = true;
        }
    }

    updateCurrentStepPosition() {
        if (!this.isActive || this.currentStepIndex < 0) return;
        const step = this.tourSteps[this.currentStepIndex];
        const targetEl = document.querySelector(step.target);
        if (targetEl && targetEl.offsetParent !== null) {
            this.positionElements(targetEl, step, this.currentStepIndex);
        }
    }

    startMainTour() {
        if (this.isMobile()) {
            this.showMobileWarning();
            return;
        }

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
                description: 'Set your size and parameters. The <strong>Dithering</strong> slider controls how many colors are used.',
                placement: 'top'
            },
            {
                target: '#btnProcess',
                title: '3. Process',
                description: 'Click "Process Image" to convert your picture into laser-ready vectors.',
                waitForAction: 'process',
                onShow: () => this.toggleProcessButton(true)
            },
            {
                target: '.layers-list',
                title: '4. Layer Overview',
                description: 'The image has been processed into separate layers. However, they don\'t have laser settings assigned yet! Note the ⚠️ warning icons.',
                placement: 'right'
            },
            {
                target: '#btnAutoAssign',
                title: '5. Auto-Assign Calibration',
                description: 'Click this button to automatically match the detected colors with your closest laser calibration data. <strong>Try it now!</strong>',
                waitForAction: 'auto-assign',
                placement: 'top'
            },
            {
                target: '#tour-target-layer-color',
                title: '6. Manual Fine-Tuning',
                description: 'If a match isn\'t perfect, click the color square (🎯) to manually pick a different setting from your grid.',
                waitForAction: 'edit-modal-open',
                placement: 'top'
            },
            {
                target: '#miniPickerCanvas',
                title: '7. Pick a Calibrated Color',
                description: 'Select a color from the grid. These colors are pulled directly from your laser calibration data!',
                waitForAction: 'color-picked',
                placement: 'top'
            },
            {
                target: '#previewPanel',
                title: '8. Preview Results',
                description: 'Review the output layers and vector paths here.',
                placement: 'left'
            },
            {
                target: '#btnDownloadXCS',
                title: '9. Export',
                description: 'Once all layers are assigned, click to download your XCS file!',
                waitForAction: 'download'
            }
        ];

        this.showStep(0);
    }

    injectMergeStep() {
        if (!this.isActive) return;

        // Find current step index (should be the one waiting for auto-assign)
        // Or just insert after current index
        const insertIndex = this.currentStepIndex + 1;

        const mergeStep = {
            target: '#mergeModal .modal-content',
            title: 'Refinement: Merge Layers',
            description: 'We detected layers with identical settings! Merging them reduces processing time. Select the groups you want to combine and click <strong>Merge Selected</strong>.',
            waitForAction: 'merge-complete',
            placement: 'right',
            padding: 20
        };

        this.tourSteps.splice(insertIndex, 0, mergeStep);
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

            // Try again after a delay
            setTimeout(() => {
                const targetElRetry = document.querySelector(step.target);
                if (targetElRetry && targetElRetry.offsetParent !== null) {
                    this.showStepHandle(targetElRetry, step, index);
                } else {
                    // One last attempt after a longer delay
                    setTimeout(() => {
                        const finalRetry = document.querySelector(step.target);
                        if (finalRetry && finalRetry.offsetParent !== null) {
                            this.showStepHandle(finalRetry, step, index);
                        } else if (index < this.tourSteps.length - 1) {
                            console.warn(`[Onboarding] Skipping step ${index} (${step.title}) - target ${step.target} not visible after retries.`);
                            this.showStep(index + 1);
                        }
                    }, 500);
                }
            }, 200);
            return;
        }

        this.showStepHandle(targetEl, step, index);
    }

    showStepHandle(targetEl, step, index) {
        if (step.onShow) step.onShow();

        // Instant scroll to avoid timing issues
        targetEl.scrollIntoView({ behavior: 'auto', block: 'center' });

        // Update position multiple times to catch any layout shifts
        const update = () => this.positionElements(targetEl, step, index);

        update(); // Immediate
        requestAnimationFrame(update); // Next frame
        setTimeout(update, 100);
        setTimeout(update, 300);
        setTimeout(update, 500);
    }

    positionElements(targetEl, step, index) {
        const rect = targetEl.getBoundingClientRect();

        // If element is hidden or not layouted yet, retry
        if (rect.width === 0 && rect.height === 0) {
            requestAnimationFrame(() => this.positionElements(targetEl, step, index));
            return;
        }

        const highlightPadding = step.padding !== undefined ? step.padding : 10;

        // Position Highlight (Absolute to document)
        const top = rect.top + window.scrollY;
        const left = rect.left + window.scrollX;

        Object.assign(this.elements.highlight.style, {
            top: `${top - highlightPadding}px`,
            left: `${left - highlightPadding}px`,
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
                <button class="btn-tour-skip" onclick="window.onboarding.endTour()">Stop</button>
                <div style="flex:1"></div>
                <button class="btn-tour-restart" onclick="window.onboarding.restartTour()" ${index === 0 ? 'disabled' : ''}>
                    🔄 Restart
                </button>
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
        let tooltipTop = rect.bottom + 20 + scrollY;
        let tooltipLeft = rect.left + (rect.width / 2) - (tooltipWidth / 2) + scrollX;
        let placement = step.placement || 'auto';

        // Check if bottom fits
        const bottomFits = (rect.bottom + 20 + tooltipHeight) < (window.scrollY + window.innerHeight);

        if (placement === 'top' || (placement === 'auto' && !bottomFits)) {
            // Try Top
            const topPos = rect.top - tooltipHeight - 20 + scrollY;
            if (topPos > window.scrollY) { // Only if it doesn't go off top
                tooltipTop = topPos;
            }
        }

        if (placement === 'left') {
            tooltipTop = rect.top + (rect.height / 2) - (tooltipHeight / 2) + scrollY;
            tooltipLeft = rect.left - tooltipWidth - 20 + scrollX;
        }

        if (placement === 'right') {
            tooltipTop = rect.top + (rect.height / 2) - (tooltipHeight / 2) + scrollY;
            tooltipLeft = rect.right + 20 + scrollX;
        }

        // Horizontal Clamp
        const padding = 20;
        if (tooltipLeft < padding + scrollX) tooltipLeft = padding + scrollX;
        if (tooltipLeft + tooltipWidth > window.innerWidth - padding + scrollX) {
            tooltipLeft = window.innerWidth - tooltipWidth - padding + scrollX;
        }

        Object.assign(this.elements.tooltip.style, {
            top: `${tooltipTop}px`,
            left: `${tooltipLeft}px`
        });

        this.elements.tooltip.classList.add('active');
    }

    handleAction(actionName) {
        if (!this.isActive) return;
        const currentStep = this.tourSteps[this.currentStepIndex];

        if (currentStep && currentStep.waitForAction === actionName) {
            // Special case: if we are at the Save step, add a small delay to let modal close
            const isSaveStep = actionName === 'save-edit';
            const delay = isSaveStep ? 400 : 0;

            const btn = document.getElementById('tourNextBtn');
            if (btn) {
                btn.innerText = 'Success! →';
                btn.disabled = false;

                // If it's the last step, end it
                if (this.currentStepIndex === this.tourSteps.length - 1) {
                    setTimeout(() => this.endTour(), 600);
                    return;
                }

                setTimeout(() => this.nextStep(), delay);
            } else {
                // If we don't have a button, just advance
                if (this.currentStepIndex === this.tourSteps.length - 1) {
                    this.endTour();
                } else {
                    setTimeout(() => this.nextStep(), delay);
                }
            }
        }
    }

    nextStep() {
        this.currentStepIndex++;
        this.showStep(this.currentStepIndex);
    }

    restartTour() {
        if (confirm('Restart the tutorial from the beginning? This will refresh the page.')) {
            location.reload();
        }
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
