/**
 * Strudel Window App
 * 
 * This is the main application logic for the Strudel window.
 */

function registerStrudelGrammar() {
    if (typeof Prism === 'undefined') return;
    Prism.languages.strudel = {
        comment: { pattern: /\/\/.*/, greedy: true },
        string: [
            { pattern: /"(?:[^"\\]|\\.)*"/, greedy: true },
            { pattern: /'(?:[^'\\]|\\.)*'/, greedy: true },
            { pattern: /`(?:[^`\\]|\\.)*`/, greedy: true },
        ],
        number: /%-?\d+|\b\d+\.?\d*\b/,
        'repl-prefix': /\$:/,
        keyword: /\b(?:cps|sound|samples|note|stack|struct|every|slow|fast|gain|speed|rev|chord|scale|m|n|s|rand|segment|cat|append|off|layer|superimpose|jux|juxBy|iter|palindrome|rotate|chunk|substruct|ply|trigger|when|fix|linger|early|late|stretch|compress|trunc|iterate|squeeze|slice|fit|scrub|drop|take)\b/,
        operator: /[.\[\](){},:~@#-]/,
    };
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Failed to load: ' + src));
        document.head.appendChild(s);
    });
}

function ensurePrism() {
    if (typeof Prism !== 'undefined' && Prism.languages.strudel) return Promise.resolve();
    if (typeof Prism !== 'undefined') {
        registerStrudelGrammar();
        return Promise.resolve();
    }
    console.warn('[StrudelApp] Prism not loaded from static script, loading from CDN…');
    return loadScript('https://unpkg.com/prismjs@1.29.0/prism.min.js')
        .then(() => {
            registerStrudelGrammar();
            console.log('[StrudelApp] Prism loaded from CDN');
        })
        .catch((e) => {
            console.error('[StrudelApp] Prism CDN fallback failed:', e);
        });
}

/**
 * Open documents data structure.
 * Each document: { id, filePath?, name, content, lastSavedContent, unsaved }
 */
function createDocument(id, filePath, name, content = '') {
    return {
        id,
        filePath: filePath ?? null,
        name: name || 'Untitled',
        content: content,
        lastSavedContent: content,
        unsaved: false,
    };
}

class StrudelApp {
    constructor() {
        this.strudelInstance = null;
        this.currentStackedPattern = null;
        this.currentPatterns = [];
        this._highlightDebounce = null;
        this._patternVisualizations = new Map(); // pattern index -> { canvas, container, lineNumber }
        /** @type {Array<{ id: string, filePath: string|null, name: string, content: string, lastSavedContent: string, unsaved: boolean }>} */
        this.openDocuments = [];
        /** @type {string|null} */
        this.activeDocumentId = null;
        this._untitledCounter = 0;
        this.initStrudel();
        this.initSaveLoadButtons();
    }

    /**
     * Initialize Strudel using the minimal-repl approach with transpiler
     */
    async initStrudel() {
        try {
            // Try to use the more advanced approach with transpiler (like minimal-repl example)
            // This properly handles string-to-pattern conversion
            const strudelCore = await import('@strudel/core');
            const strudelTranspiler = await import('@strudel/transpiler');
            const strudelWebaudio = await import('@strudel/webaudio');
            
            const { repl, evalScope } = strudelCore;
            const { transpiler } = strudelTranspiler;
            const { getAudioContext, webaudioOutput, initAudioOnFirstClick } = strudelWebaudio;
            
            // Initialize audio context
            const ctx = getAudioContext();
            initAudioOnFirstClick();
            
            // Set up eval scope with all Strudel modules
            await evalScope(
                import('@strudel/core'),
                import('@strudel/mini'),
                import('@strudel/webaudio'),
                import('@strudel/tonal'),
                import('@strudel/draw')
            );
            
            // Create repl with transpiler
            const { evaluate } = repl({
                defaultOutput: webaudioOutput,
                getTime: () => ctx.currentTime,
                transpiler,
            });
            
            // Store evaluate function for later use
            this.strudelEvaluate = evaluate;
            this.audioContext = ctx;
            
            // Configure visualization container
            this.setupVisualizer();
            
            await this.initializeStrudelEditor();
            console.log('[StrudelApp] Strudel initialized with transpiler');
        } catch (error) {
            console.warn('[StrudelApp] Failed to load Strudel with transpiler, falling back to @strudel/web:', error);
            this.initStrudelFromWeb();
        }
    }

    /**
     * Fallback: Initialize Strudel using @strudel/web (simpler but may not handle all cases)
     */
    initStrudelFromWeb() {
        if (typeof initStrudel === 'function') {
            this.initializeStrudelEditor().catch((e) => console.error('[StrudelApp] initStrudelEditor failed:', e));
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@strudel/web@latest';
        script.onload = () => {
            if (typeof initStrudel === 'function') {
                this.initializeStrudelEditor().catch((e) => console.error('[StrudelApp] initStrudelEditor failed:', e));
            } else {
                console.error('[StrudelApp] initStrudel function not available after loading script');
            }
        };
        script.onerror = () => console.error('[StrudelApp] Failed to load Strudel from CDN');
        document.head.appendChild(script);
    }

    /**
     * Set up the visualizer container for pattern visualizations.
     * @strudel/draw looks for #test-canvas; if missing it creates one on document.body
     * (which can end up behind our layout). We create the canvas here so rendering
     * goes into our container.
     */
    setupVisualizer() {
        const visualizerContainer = document.getElementById('strudel-visualizer');
        if (!visualizerContainer) return;

        // If draw package already created a canvas on body, move it into our container
        let canvas = document.getElementById('test-canvas');
        if (canvas && canvas.parentElement !== visualizerContainer) {
            canvas.remove();
            canvas = null;
        }
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'test-canvas';
            canvas.setAttribute('aria-hidden', 'true');
            visualizerContainer.appendChild(canvas);
        }

        const resizeCanvas = () => {
            const rect = visualizerContainer.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            canvas.width = Math.floor(rect.width * dpr);
            canvas.height = Math.floor(rect.height * dpr);
            canvas.style.width = rect.width + 'px';
            canvas.style.height = rect.height + 'px';
        };

        resizeCanvas();
        const ro = new ResizeObserver(resizeCanvas);
        ro.observe(visualizerContainer);
        this._visualizerResizeObserver = ro;
        console.log('[StrudelApp] Visualizer container ready (#test-canvas in #strudel-visualizer)');
    }

    /**
     * Initialize the Strudel editor after Strudel is available.
     * Textarea + highlight overlay; syntax coloring via HTML + CSS (Prism tokens).
     */
    async initializeStrudelEditor() {
        try {
            await ensurePrism();
            await this.restoreOpenFiles();
            if (!this.strudelEvaluate && typeof initStrudel === 'function') {
                this.strudelInstance = initStrudel({});
            }

            const textarea = document.getElementById('strudel-editor');
            const mirror = document.getElementById('strudel-mirror');
            const code = mirror ? mirror.querySelector('code') : null;
            if (!textarea || !mirror || !code) {
                console.warn('[StrudelApp] strudel-editor or strudel-mirror not found');
                return;
            }

            const self = this;
            const scheduleHighlight = () => {
                if (self._highlightDebounce) clearTimeout(self._highlightDebounce);
                self._highlightDebounce = setTimeout(() => {
                    self._highlightDebounce = null;
                    self.updateMirror();
                }, 80);
            };

            textarea.addEventListener('input', () => {
                self.onStrudelUpdate();
                scheduleHighlight();
                self.syncEditorToActiveDocument();
            });
            textarea.addEventListener('change', () => {
                self.onStrudelUpdate();
                self.syncEditorToActiveDocument();
            });
            textarea.addEventListener('scroll', () => self.syncMirrorScroll());

            // Add Ctrl+/ (Cmd+/ on Mac) to toggle comments on selected lines
            // Add Ctrl+S (Cmd+S on Mac) to save current document
            textarea.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === '/') {
                    e.preventDefault();
                    self.toggleComments();
                } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    e.preventDefault();
                    self.saveStrudelContent();
                }
            });

            this.updateMirror();
            if (this.activeDocumentId) {
                const doc = this.openDocuments.find((d) => d.id === this.activeDocumentId);
                if (doc) this.setEditorContent(doc.content);
            }
            console.log('[StrudelApp] Strudel editor initialized (textarea + overlay)');
        } catch (error) {
            console.error('[StrudelApp] Error initializing Strudel editor:', error);
        }
    }

    /**
     * Called when the editor content changes.
     * Checks for samples() calls and loads missing samples.
     */
    onStrudelUpdate() {
        try {
            const code = this.getEditorContent();
            if (code === null) return;
            if (!code.trim()) return;

            // Parse code to find all samples() calls
            const samplesRegex = /samples\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
            const foundSamples = [];
            let match;
            
            while ((match = samplesRegex.exec(code)) !== null) {
                foundSamples.push(match[1]);
            }

            // Check and load each sample
            for (const samplePath of foundSamples) {
                this.checkAndLoadSample(samplePath);
            }
        } catch (error) {
            console.warn('[StrudelApp] Error in onStrudelUpdate:', error);
        }
    }

    /**
     * Check if a sample is loaded and load it if not
     */
    async checkAndLoadSample(samplePath) {
        try {
            // Check if samples function is available
            if (typeof samples === 'undefined') {
                console.warn('[StrudelApp] samples function not available yet');
                return;
            }

            // Try to access the samples map if available
            // Strudel may expose the samples map globally or through the strudel instance
            let sampleMap = null;
            
            // Try different ways to access the samples map
            if (typeof getSamples === 'function') {
                sampleMap = getSamples();
            } else if (window.samplesMap) {
                sampleMap = window.samplesMap;
            } else if (this.strudelInstance && this.strudelInstance.samples) {
                sampleMap = this.strudelInstance.samples;
            }

            // Check if sample is already in the map
            const sampleKey = samplePath.toLowerCase().replace(/[^a-z0-9]/g, '_');
            const isLoaded = sampleMap && (sampleMap.has(samplePath) || sampleMap.has(sampleKey) || sampleMap[samplePath] || sampleMap[sampleKey]);

            if (!isLoaded) {
                // Sample not loaded, load it
                console.log(`[StrudelApp] Loading sample: ${samplePath}`);
                try {
                    // Call samples() to load the sample
                    // This should trigger loading if not already loaded
                    const result = samples(samplePath);
                    // If samples() returns a promise, await it
                    if (result && typeof result.then === 'function') {
                        await result;
                    }
                    console.log(`[StrudelApp] Sample loaded: ${samplePath}`);
                } catch (error) {
                    console.warn(`[StrudelApp] Could not load sample ${samplePath}:`, error);
                }
            } else {
                console.log(`[StrudelApp] Sample already loaded: ${samplePath}`);
            }
        } catch (error) {
            console.warn(`[StrudelApp] Error checking/loading sample ${samplePath}:`, error);
            // Fallback: try to load it anyway
            try {
                if (typeof samples === 'function') {
                    samples(samplePath);
                }
            } catch (e) {
                // Ignore errors in fallback
            }
        }
    }

    /**
     * Initialize save, load, play, stop, and update button handlers
     */
    initSaveLoadButtons() {
        const playBtn = document.getElementById('playBtn');
        const stopBtn = document.getElementById('stopBtn');
        const updateBtn = document.getElementById('updateBtn');
        const saveBtn = document.getElementById('saveBtn');
        const openBtn = document.getElementById('openBtn');

        if (playBtn) {
            playBtn.addEventListener('click', () => this.playStrudelContent());
        }

        if (stopBtn) {
            stopBtn.addEventListener('click', () => this.stopStrudelContent());
        }

        if (updateBtn) {
            updateBtn.addEventListener('click', () => this.updateStrudelContent());
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveStrudelContent());
        }

        if (openBtn) {
            openBtn.addEventListener('click', () => this.openDocument());
        }

        // Start with one untitled document if none (restoreOpenFiles may have already loaded persisted files)
        if (this.openDocuments.length === 0) {
            this._untitledCounter += 1;
            const doc = createDocument('untitled-' + this._untitledCounter, null, 'Untitled', '');
            this.openDocuments.push(doc);
            this.activeDocumentId = doc.id;
        }
        this.renderOpenDocs();

        window.addEventListener('beforeunload', () => this.persistOpenFiles());
    }

    /**
     * Restore open files from persisted state (called early in initializeStrudelEditor).
     */
    async restoreOpenFiles() {
        if (!window.electron || typeof window.electron.getStrudelOpenFiles !== 'function') return;
        try {
            const state = await window.electron.getStrudelOpenFiles();
            if (!state.openFilePaths || state.openFilePaths.length === 0) return;
            this.openDocuments = [];
            for (const filePath of state.openFilePaths) {
                const readResult = await window.electron.readFile(filePath);
                if (!readResult.success) continue;
                const name = filePath.split(/[/\\]/).pop() || 'Untitled';
                const doc = createDocument(filePath, filePath, name, readResult.content);
                this.openDocuments.push(doc);
            }
            if (this.openDocuments.length === 0) return;
            const activeDoc = state.activeFilePath
                ? this.openDocuments.find((d) => d.filePath === state.activeFilePath)
                : null;
            this.activeDocumentId = (activeDoc || this.openDocuments[0]).id;
            this.renderOpenDocs();
        } catch (e) {
            console.warn('[StrudelApp] Restore open files failed:', e);
        }
    }

    /**
     * Persist open file paths and active tab for next run.
     */
    persistOpenFiles() {
        if (!window.electron || typeof window.electron.setStrudelOpenFiles !== 'function') return;
        try {
            const openFilePaths = this.openDocuments.filter((d) => d.filePath).map((d) => d.filePath);
            const activeDoc = this.activeDocumentId
                ? this.openDocuments.find((d) => d.id === this.activeDocumentId)
                : null;
            const activeFilePath = activeDoc?.filePath ?? null;
            window.electron.setStrudelOpenFiles({ openFilePaths, activeFilePath });
        } catch (e) {
            console.warn('[StrudelApp] Persist open files failed:', e);
        }
    }

    /**
     * Sync editor content to the active document and update unsaved state
     */
    syncEditorToActiveDocument() {
        const content = this.getEditorContent();
        if (content === null || !this.activeDocumentId) return;
        const doc = this.openDocuments.find((d) => d.id === this.activeDocumentId);
        if (!doc) return;
        doc.content = content;
        doc.unsaved = content !== doc.lastSavedContent;
        this.renderOpenDocs();
    }

    /**
     * Switch to a document by id (save current editor to current doc, load doc into editor)
     */
    switchDocument(docId) {
        if (docId === this.activeDocumentId) return;
        this.stopStrudelContent();
        this.syncEditorToActiveDocument();
        const doc = this.openDocuments.find((d) => d.id === docId);
        if (!doc) return;
        this.activeDocumentId = docId;
        this.setEditorContent(doc.content);
        this.updateMirror();
        this.renderOpenDocs();
        this.persistOpenFiles();
    }

    /**
     * Render open documents as tabs in the header
     */
    renderOpenDocs() {
        const container = document.getElementById('strudel-open-docs');
        if (!container) return;
        container.textContent = '';
        this.openDocuments.forEach((doc) => {
            const tab = document.createElement('button');
            tab.type = 'button';
            tab.className = 'strudel-doc-tab' + (doc.id === this.activeDocumentId ? ' active' : '') + (doc.unsaved ? ' unsaved' : '');
            tab.title = doc.filePath || doc.name;
            tab.textContent = doc.name;
            tab.setAttribute('data-doc-id', doc.id);
            tab.addEventListener('click', () => this.switchDocument(doc.id));
            container.appendChild(tab);
        });
    }

    /**
     * Sync mirror scroll position to match textarea.
     */
    syncMirrorScroll() {
        const ta = document.getElementById('strudel-editor');
        const mirror = document.getElementById('strudel-mirror');
        if (ta && mirror) {
            mirror.scrollTop = ta.scrollTop;
            mirror.scrollLeft = ta.scrollLeft;
        }
    }

    /**
     * Toggle comments on selected lines (Ctrl+/ or Cmd+/)
     */
    toggleComments() {
        const textarea = document.getElementById('strudel-editor');
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const lines = text.split('\n');

        // Find which lines are selected
        let startLine = 0;
        let endLine = lines.length - 1;
        let charCount = 0;

        for (let i = 0; i < lines.length; i++) {
            const lineLength = lines[i].length + 1; // +1 for newline
            if (charCount + lines[i].length >= start && startLine === 0) {
                startLine = i;
            }
            if (charCount + lines[i].length >= end) {
                endLine = i;
                break;
            }
            charCount += lineLength;
        }

        // Determine if we should comment or uncomment
        // Check if all selected lines are commented
        let allCommented = true;
        let hasAnyContent = false;
        for (let i = startLine; i <= endLine; i++) {
            const trimmed = lines[i].trim();
            if (trimmed && !trimmed.startsWith('//')) {
                allCommented = false;
            }
            if (trimmed) {
                hasAnyContent = true;
            }
        }

        // If no content selected, do nothing
        if (!hasAnyContent) return;

        // Toggle comments
        const newLines = [...lines];
        let newStart = start;
        let newEnd = end;
        let offset = 0;

        for (let i = startLine; i <= endLine; i++) {
            const line = newLines[i];
            const trimmed = line.trim();

            if (allCommented) {
                // Uncomment: remove // from start of line
                if (trimmed.startsWith('//')) {
                    const uncommented = line.replace(/^(\s*)\/\//, '$1');
                    const lineOffset = line.length - uncommented.length;
                    newLines[i] = uncommented;
                    if (i === startLine) {
                        offset -= lineOffset;
                    }
                }
            } else {
                // Comment: add // at start of line (after leading whitespace)
                if (trimmed && !trimmed.startsWith('//')) {
                    const indent = line.match(/^(\s*)/)[0];
                    const commented = indent + '//' + line.slice(indent.length);
                    const lineOffset = commented.length - line.length;
                    newLines[i] = commented;
                    if (i === startLine) {
                        offset += lineOffset;
                    }
                }
            }
        }

        // Update textarea content
        const newText = newLines.join('\n');
        textarea.value = newText;

        // Restore selection (adjust for added/removed characters)
        newStart = Math.max(0, start + offset);
        newEnd = Math.max(newStart, end + offset);
        textarea.setSelectionRange(newStart, newEnd);

        // Trigger update
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        this.updateMirror();
    }

    /**
     * Update highlight overlay from textarea content (Prism → mirror).
     * Also re-inserts visualizations at the correct positions.
     */
    updateMirror() {
        const ta = document.getElementById('strudel-editor');
        const mirror = document.getElementById('strudel-mirror');
        const code = mirror ? mirror.querySelector('code') : null;
        if (!ta || !code) return;
        const raw = ta.value || '';
        
        // Store existing visualizations temporarily
        const existingViz = Array.from(this._patternVisualizations.entries());
        
        try {
            if (typeof Prism !== 'undefined' && Prism.languages.strudel) {
                code.innerHTML = Prism.highlight(raw, Prism.languages.strudel, 'strudel');
            } else {
                if (typeof Prism === 'undefined') {
                    console.warn('[StrudelApp] Prism not loaded; no syntax highlighting.');
                } else if (!Prism.languages.strudel) {
                    console.warn('[StrudelApp] Prism strudel grammar not loaded; no syntax highlighting.');
                }
                code.textContent = raw;
            }
        } catch (e) {
            console.warn('[StrudelApp] Prism highlight error:', e);
            code.textContent = raw;
        }
        
        // Re-insert visualizations after the code element
        existingViz.forEach(([index, viz]) => {
            if (viz.container && !viz.container.parentElement) {
                // Visualization was removed during innerHTML update, re-insert it
                if (code.nextSibling) {
                    mirror.insertBefore(viz.container, code.nextSibling);
                } else {
                    mirror.appendChild(viz.container);
                }
                // Trigger resize
                setTimeout(() => {
                    const dpr = window.devicePixelRatio || 1;
                    const rect = viz.container.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0) {
                        viz.canvas.width = Math.floor(rect.width * dpr);
                        viz.canvas.height = Math.floor(rect.height * dpr);
                        viz.canvas.style.width = rect.width + 'px';
                        viz.canvas.style.height = rect.height + 'px';
                        if (viz.ctx) {
                            viz.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                        }
                    }
                }, 0);
            }
        });
        
        this.syncMirrorScroll();
    }

    getEditorContent() {
        const ta = document.getElementById('strudel-editor');
        if (ta && ta.tagName === 'TEXTAREA') return ta.value || '';
        return null;
    }

    setEditorContent(content) {
        const ta = document.getElementById('strudel-editor');
        if (!ta || ta.tagName !== 'TEXTAREA') return false;
        const text = content != null ? String(content) : '';
        ta.value = text;
        this.updateMirror();
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    }

    /**
     * Get the current content from the editor (TinyMCE or textarea).
     */
    async getStrudelContent() {
        const content = this.getEditorContent();
        if (content === null) {
            console.warn('[StrudelApp] No editor found');
            return null;
        }
        return content;
    }

    /**
     * Set content in the editor (TinyMCE or textarea).
     */
    async setStrudelContent(content) {
        const ok = this.setEditorContent(content);
        if (!ok) console.warn('[StrudelApp] Could not set editor content');
        return ok;
    }

    /**
     * Play/evaluate the Strudel code from the textarea
     * Supports Strudel REPL syntax with $: prefix for auto-play
     * All $: lines are executed concurrently (at the same time)
     */
    async playStrudelContent() {
        try {
            let code = this.getEditorContent();
            if (code === null) {
                console.warn('[StrudelApp] No editor found');
                return;
            }
            if (!code.trim()) {
                console.warn('[StrudelApp] No code to play');
                return;
            }

            // Check if Strudel is initialized (initStrudel makes functions available globally)
            if (typeof note === 'undefined' && typeof initStrudel === 'undefined') {
                console.warn('[StrudelApp] Strudel not initialized yet');
                alert('Strudel is not initialized. Please wait for it to load.');
                return;
            }

            // Process code line by line to handle $: syntax (Strudel REPL auto-play)
            // Multi-line $: blocks are supported: continuation lines (e.g. ".s(...)" or ".pianoroll()") are merged
            const lines = code.split('\n');
            const dollarLines = []; // { code, lineNumber, hasVisualization }
            const otherLines = [];
            let i = 0;
            while (i < lines.length) {
                const line = lines[i];
                const trimmedLine = line.trim();
                if (trimmedLine.startsWith('//')) {
                    const uncommented = trimmedLine.slice(2).trim();
                    if (uncommented.startsWith('$:')) {
                        i++;
                        continue;
                    }
                    otherLines.push(line);
                    i++;
                    continue;
                }
                if (trimmedLine.startsWith('$:')) {
                    const startLine = i;
                    let patternCode = trimmedLine.slice(2).trim().replace(/\.play\(\);?$/, '');
                    i++;
                    // Collect continuation lines (e.g. ".s('sawtooth')" or ".pianoroll()")
                    // Skip blank lines but continue collecting
                    while (i < lines.length) {
                        const next = lines[i].trim();
                        const nextLine = lines[i];
                        
                        // Skip blank lines but continue
                        if (!next) {
                            i++;
                            continue;
                        }
                        
                        // Stop at comments or next pattern
                        if (next.startsWith('//')) break;
                        if (next.startsWith('$:')) break;
                        
                        // Check if this is a continuation line
                        if (/^\s*\./.test(nextLine) || (patternCode && !/^\s*[a-zA-Z_$]/.test(next))) {
                            patternCode += ' ' + next;
                            i++;
                        } else {
                            break;
                        }
                    }
                    if (patternCode) {
                        // Detect if this pattern has a visualization (check both _pianoroll and pianoroll)
                        const vizRegex = /\._?(pianoroll|punchcard|spiral|scope|spectrum|pitchwheel)\s*\(/;
                        const hasVisualization = vizRegex.test(patternCode);
                        const match = patternCode.match(vizRegex);
                        console.log(`[StrudelApp] Pattern at line ${startLine + 1}: hasVisualization=${hasVisualization}`, 
                            match ? `(found: ${match[0]})` : '(no match)', 
                            `code: ${patternCode.substring(0, 150)}`);
                        dollarLines.push({ code: patternCode, lineNumber: startLine, hasVisualization });
                    }
                    continue;
                }
                otherLines.push(line);
                i++;
            }

            // First, execute all non-$: lines (setup code, samples, etc.)
            // Run line-by-line so one bad line (e.g. samples(...).s()) doesn't block the rest
            if (otherLines.length > 0) {
                for (const line of otherLines) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith('//')) continue;
                    try {
                        const result = eval(line);
                        if (result && typeof result.then === 'function') {
                            await result;
                        }
                    } catch (error) {
                        console.warn('[StrudelApp] Setup line failed (continuing):', trimmed.slice(0, 60), error.message);
                    }
                }
                await new Promise(resolve => setTimeout(resolve, 300));
            }

            // Clear previous visualizations
            this.clearPatternVisualizations();

            // Then, execute all $: lines concurrently (at the same time)
            // Following the Strudel REPL example: use stack() to combine patterns and play them together
            if (dollarLines.length > 0) {
                const vizCount = dollarLines.filter(item => item.hasVisualization).length;
                console.log(`[StrudelApp] Found ${dollarLines.length} $: line(s) to execute (${vizCount} with visualizations):`, dollarLines.map(item => ({ line: item.lineNumber, hasViz: item.hasVisualization, code: item.code.substring(0, 60) })));
                
                // If we have evaluate() from repl, use it (handles transpilation automatically)
                if (this.strudelEvaluate) {
                    try {
                        // NOTE:
                        // - In Strudel docs, the "_" prefixed visuals (e.g. ._pianoroll()) are "inline"
                        //   and rely on a rich code editor integration. Our textarea editor can't render
                        //   inline visuals, so we normalize them to the global variants (e.g. .pianoroll()).
                        // - Also: evaluate() alone doesn't start audio; we need to call .play().

                        // Create visualizations first so we can inject ctx
                        const normalized = dollarLines.map((item, index) => {
                            let s = item.code
                                .replace(/\._pianoroll\b/g, '.pianoroll')
                                .replace(/\._punchcard\b/g, '.punchcard')
                                .replace(/\._spiral\b/g, '.spiral')
                                .replace(/\._scope\b/g, '.scope')
                                .replace(/\._spectrum\b/g, '.spectrum')
                                .replace(/\._pitchwheel\b/g, '.pitchwheel');
                            
                            // If this pattern has a visualization, create canvas and inject ctx + unique id
                            if (item.hasVisualization) {
                                console.log(`[StrudelApp] Creating visualization for pattern ${index + 1} at line ${item.lineNumber + 1}`);
                                const viz = this.createPatternVisualization(index, item.lineNumber, s);
                                if (viz && viz.ctx) {
                                    const ctxRef = `window.__strudelVizCtx${index}`;
                                    const vizId = index + 1; // Unique id so each pattern keeps its own animation
                                    window[ctxRef] = viz.ctx;
                                    console.log(`[StrudelApp] Injected ctx for pattern ${index + 1}: ${ctxRef}, id: ${vizId}`);
                                    // Inject .tag(id) before viz so haps are not filtered out; inject ctx and id
                                    s = s.replace(
                                        /\.(pianoroll|punchcard|spiral|scope|spectrum|pitchwheel)\s*\(([^)]*)\)/g,
                                        (match, vizType, args) => {
                                            let opts = '';
                                            if (!args || args.trim() === '') {
                                                opts = `{ ctx: ${ctxRef}, id: ${vizId} }`;
                                            } else {
                                                const trimmed = args.trim();
                                                if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                                                    const inner = trimmed.slice(1, -1).trim();
                                                    opts = `{ ${inner ? inner + ', ' : ''}ctx: ${ctxRef}, id: ${vizId} }`;
                                                } else {
                                                    opts = `Object.assign(${trimmed}, { ctx: ${ctxRef}, id: ${vizId} })`;
                                                }
                                            }
                                            return `.tag(${vizId}).${vizType}(${opts})`;
                                        }
                                    );
                                    console.log(`[StrudelApp] Modified code for pattern ${index + 1}:`, s.substring(0, 100));
                                } else {
                                    console.warn(`[StrudelApp] Failed to create visualization or ctx for pattern ${index + 1}`);
                                }
                            }
                            return s;
                        });

                        // Play all $: patterns together.
                        // Each entry in `normalized` is an expression that returns a Pattern.
                        const playCode = `stack(${normalized.join(',\n')}).play()`;

                        this.strudelEvaluate(playCode);
                        console.log('[StrudelApp] Patterns evaluated + playing via evaluate()');
                    } catch (error) {
                        console.error(`[StrudelApp] Error evaluating patterns via evaluate():`, error);
                    }
                } else {
                    // Fallback: evaluate patterns individually with eval()
                    // Normalize _pianoroll -> pianoroll etc so visuals work (same as evaluate path)
                    const normalizeVisuals = (s) =>
                        s
                            .replace(/\._pianoroll\b/g, '.pianoroll')
                            .replace(/\._punchcard\b/g, '.punchcard')
                            .replace(/\._spiral\b/g, '.spiral')
                            .replace(/\._scope\b/g, '.scope')
                            .replace(/\._spectrum\b/g, '.spectrum')
                            .replace(/\._pitchwheel\b/g, '.pitchwheel');

                    const patternObjects = [];
                    dollarLines.forEach((item, index) => {
                        let code = normalizeVisuals(item.code);
                        
                        // If this pattern has a visualization, create the canvas first
                        let viz = null;
                        if (item.hasVisualization) {
                            viz = this.createPatternVisualization(index, item.lineNumber, code);
                            if (viz && viz.ctx) {
                                // Inject ctx and unique id into visualization calls
                                // Each pattern needs a unique id so they don't stop each other's animation (draw uses stopAnimationFrame(id))
                                // __pianoroll filters haps by hasTag(id), so we must tag the pattern with the same id before the viz call
                                const ctxRef = `window.__strudelVizCtx${index}`;
                                const vizId = index + 1; // 1, 2, 3...
                                code = code.replace(
                                    /\.(pianoroll|punchcard|spiral|scope|spectrum|pitchwheel)\s*\(([^)]*)\)/g,
                                    (match, vizType, args) => {
                                        let opts = '';
                                        if (!args || args.trim() === '') {
                                            opts = `{ ctx: ${ctxRef}, id: ${vizId} }`;
                                        } else {
                                            const trimmed = args.trim();
                                            if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                                                const inner = trimmed.slice(1, -1).trim();
                                                opts = `{ ${inner ? inner + ', ' : ''}ctx: ${ctxRef}, id: ${vizId} }`;
                                            } else {
                                                opts = `Object.assign(${trimmed}, { ctx: ${ctxRef}, id: ${vizId} })`;
                                            }
                                        }
                                        return `.tag(${vizId}).${vizType}(${opts})`;
                                    }
                                );
                                window[`__strudelVizCtx${index}`] = viz.ctx;
                            }
                        }
                        
                        try {
                            console.log(`[StrudelApp] Evaluating pattern ${index + 1}: ${code}`);
                            
                            const pattern = eval(code);
                            console.log(`[StrudelApp] Pattern ${index + 1} evaluation result:`, pattern);
                            
                            if (pattern && pattern._Pattern) {
                                patternObjects.push(pattern);
                                console.log(`[StrudelApp] Pattern ${index + 1} prepared: ${code.substring(0, 80)}...`);
                                
                                // Update visualization with the actual pattern
                                if (viz) {
                                    viz.pattern = pattern;
                                }
                            } else {
                                console.warn(`[StrudelApp] Pattern ${index + 1} did not return a Pattern object. Code: ${code}, Result:`, pattern);
                            }
                        } catch (error) {
                            console.error(`[StrudelApp] Error evaluating pattern ${index + 1}:`, error);
                            console.error(`[StrudelApp] Pattern code: ${code}`);
                            
                            if (error.message && error.message.includes('every is not a function')) {
                                console.log(`[StrudelApp] Attempting to fix: string needs to be converted to pattern for .every()`);
                                if (typeof m === 'function') {
                                    try {
                                        const fixedCode = normalizeVisuals(item.code).replace(/"([^"]+)"/g, 'm("$1")');
                                        console.log(`[StrudelApp] Trying fixed code: ${fixedCode}`);
                                        const fixedPattern = eval(fixedCode);
                                        if (fixedPattern && fixedPattern._Pattern) {
                                            patternObjects.push(fixedPattern);
                                            console.log(`[StrudelApp] Pattern ${index + 1} fixed and prepared`);
                                        }
                                    } catch (fixError) {
                                        console.error(`[StrudelApp] Fix attempt also failed:`, fixError);
                                    }
                                }
                            }
                        }
                    });
                    
                    console.log(`[StrudelApp] Prepared ${patternObjects.length} pattern(s) out of ${dollarLines.length} total`);
                    
                    // Use stack() to combine all patterns and play them together (like the Strudel REPL example)
                    if (patternObjects.length > 0) {
                        try {
                            // Check if stack() function is available
                            if (typeof stack === 'function') {
                                console.log(`[StrudelApp] Using stack() to combine ${patternObjects.length} pattern(s)...`);
                                const stackedPattern = stack(...patternObjects);
                                console.log(`[StrudelApp] Stacked pattern created, calling .play()...`);
                                
                                // Store the stacked pattern and individual patterns for stopping
                                this.currentStackedPattern = stackedPattern;
                                this.currentPatterns = [...patternObjects]; // Store individual patterns too
                                
                                stackedPattern.play();
                                console.log(`[StrudelApp] All patterns started playing via stack()`);
                            } else {
                                // Fallback: play each pattern individually if stack() is not available
                                console.warn('[StrudelApp] stack() function not available, playing patterns individually');
                                this.currentStackedPattern = null; // Clear since we're not using stack
                                this.currentPatterns = [...patternObjects]; // Store individual patterns
                                patternObjects.forEach((pattern, index) => {
                                    try {
                                        if (typeof pattern.play === 'function') {
                                            pattern.play();
                                            console.log(`[StrudelApp] Pattern ${index + 1} started playing individually`);
                                        }
                                    } catch (error) {
                                        console.error(`[StrudelApp] Error playing pattern ${index + 1}:`, error);
                                    }
                                });
                            }
                        } catch (error) {
                            console.error(`[StrudelApp] Error stacking/playing patterns:`, error);
                            console.error(`[StrudelApp] Error stack:`, error.stack);
                        }
                    } else {
                        console.warn('[StrudelApp] No playable patterns found!');
                    }
                }
            } else {
                console.log('[StrudelApp] No $: lines found to play');
            }
        } catch (error) {
            console.error('[StrudelApp] Error playing Strudel content:', error);
            alert('Error playing code: ' + error.message);
        }
    }

    /**
     * Update currently playing patterns to their new values from the textarea
     * Stops current patterns and starts new ones seamlessly
     */
    async updateStrudelContent() {
        try {
            console.log('[StrudelApp] Updating patterns...');
            
            // Stop current patterns first
            this.stopStrudelContent();
            
            // Wait a brief moment to ensure stop completes
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Then play the updated content
            await this.playStrudelContent();
            
            console.log('[StrudelApp] Patterns updated');
        } catch (error) {
            console.error('[StrudelApp] Error updating patterns:', error);
            alert('Error updating patterns: ' + error.message);
        }
    }

    /**
     * Clear all pattern visualizations
     */
    clearPatternVisualizations() {
        const textarea = document.getElementById('strudel-editor');
        this._patternVisualizations.forEach((viz, index) => {
            // Remove event handlers
            if (textarea && viz.container && viz.container._updateHandler) {
                textarea.removeEventListener('scroll', viz.container._updateHandler);
                window.removeEventListener('resize', viz.container._updateHandler);
            }
            // Remove container
            if (viz.container && viz.container.parentElement) {
                viz.container.remove();
            }
            // Clean up global ctx reference
            delete window[`__strudelVizCtx${index}`];
        });
        this._patternVisualizations.clear();
    }

    /**
     * Create a visualization canvas for a pattern, inserted into the pre tag after its source line
     * Returns the visualization object with ctx for injection into pattern code
     */
    createPatternVisualization(patternIndex, lineNumber, code, pattern = null) {
        const mirror = document.getElementById('strudel-mirror');
        const codeElement = mirror ? mirror.querySelector('code') : null;
        const textarea = document.getElementById('strudel-editor');
        if (!mirror || !codeElement || !textarea) return null;

        // Remove existing visualization for this pattern if any
        const existing = this._patternVisualizations.get(patternIndex);
        if (existing && existing.container && existing.container.parentElement) {
            existing.container.remove();
        }

        // Calculate how many lines the pattern spans
        // The pattern code might be on a single line (after concatenation) or we need to count from the original
        const codeText = textarea.value;
        const allLines = codeText.split('\n');
        
        // Find the end line of the pattern by looking for where the pattern block ends
        // Start from lineNumber and count continuation lines (including blank lines within the pattern)
        let endLineNumber = lineNumber;
        let i = lineNumber;
        let foundNonBlank = false; // Track if we've found any non-blank continuation
        
        while (i < allLines.length) {
            const line = allLines[i];
            const trimmed = line.trim();
            
            // Skip blank lines but continue (they're part of the pattern block)
            if (trimmed === '') {
                i++;
                continue;
            }
            
            // Stop at comments (unless we haven't found any continuation yet)
            if (trimmed.startsWith('//')) {
                if (foundNonBlank) break;
                i++;
                continue;
            }
            
            // Stop at next pattern
            if (i > lineNumber && trimmed.startsWith('$:')) {
                break;
            }
            
            // Check if this is a continuation line (starts with . or is part of the pattern)
            if (i === lineNumber || /^\s*\./.test(line) || (foundNonBlank && !trimmed.match(/^\s*[a-zA-Z_$]/))) {
                endLineNumber = i;
                foundNonBlank = true;
                i++;
            } else {
                // If we've found continuation lines before, this might be the end
                if (foundNonBlank) break;
                // Otherwise, this might be the first continuation
                if (i > lineNumber) {
                    endLineNumber = i;
                    foundNonBlank = true;
                    i++;
                } else {
                    break;
                }
            }
        }
        
        // Create container
        const container = document.createElement('div');
        container.className = 'strudel-pattern-visualization';
        container.setAttribute('data-pattern-index', patternIndex);
        container.setAttribute('data-line-number', lineNumber);
        container.setAttribute('data-end-line-number', endLineNumber);

        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.setAttribute('aria-hidden', 'true');
        container.appendChild(canvas);

        // Get canvas context
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        // Insert the visualization into the pre tag
        mirror.appendChild(container);

        // Size canvas immediately so first draw has correct dimensions (avoid race with animation start)
        const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 21;
        const padding = parseFloat(getComputedStyle(textarea).paddingTop) || 10;
        const top = (endLineNumber + 1) * lineHeight + padding;
        container.style.top = `${top}px`;
        container.style.height = '180px';
        container.style.width = '100%';
        const dpr = window.devicePixelRatio || 1;
        const width = mirror.getBoundingClientRect().width || 400;
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(180 * dpr);
        canvas.style.width = width + 'px';
        canvas.style.height = '180px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Calculate position based on the END of the pattern (last line)
        const updatePosition = () => {
            const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 21;
            const padding = parseFloat(getComputedStyle(textarea).paddingTop) || 10;
            
            // Calculate top position based on the END line of the pattern
            // endLineNumber is 0-based, so we add 1 to get the line after it
            // Position it right below the last line of the pattern
            const top = (endLineNumber + 1) * lineHeight + padding;
            
            container.style.top = `${top}px`;
            
            console.log(`[StrudelApp] Visualization ${patternIndex + 1} position: startLine=${lineNumber}, endLine=${endLineNumber}, lineHeight=${lineHeight}, padding=${padding}, top=${top}px`);
            
            // Resize canvas
            const dpr = window.devicePixelRatio || 1;
            const rect = container.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                canvas.width = Math.floor(rect.width * dpr);
                canvas.height = Math.floor(rect.height * dpr);
                canvas.style.width = rect.width + 'px';
                canvas.style.height = rect.height + 'px';
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            }
        };

        // Update position on scroll/resize
        const updateHandler = () => {
            updatePosition();
        };
        
        // Initial position
        setTimeout(() => {
            updatePosition();
        }, 0);
        
        textarea.addEventListener('scroll', updateHandler);
        window.addEventListener('resize', updateHandler);
        
        // Store handler for cleanup
        container._updateHandler = updateHandler;

        // Store visualization info
        const viz = {
            container,
            canvas,
            ctx,
            lineNumber,
            code,
            pattern,
            patternIndex,
            updatePosition,
        };
        
        this._patternVisualizations.set(patternIndex, viz);
        
        console.log(`[StrudelApp] Created visualization ${patternIndex + 1} at line ${lineNumber + 1} (inserted into pre tag, total: ${this._patternVisualizations.size})`);
        return viz;
    }

    /**
     * Stop all Strudel audio playback
     * Uses hush() to stop all patterns simultaneously
     */
    stopStrudelContent() {
        try {
            // Stop all patterns simultaneously
            // First, try to stop the stacked pattern if it exists and has a stop method
            if (this.currentStackedPattern) {
                try {
                    if (typeof this.currentStackedPattern.stop === 'function') {
                        this.currentStackedPattern.stop();
                        console.log('[StrudelApp] Stacked pattern stopped');
                    }
                } catch (e) {
                    // Ignore errors, fall through to hush()
                }
            }
            
            // Also try to stop individual patterns if they have stop methods
            if (this.currentPatterns.length > 0) {
                // Stop all patterns in the same synchronous execution
                for (let i = 0; i < this.currentPatterns.length; i++) {
                    try {
                        const pattern = this.currentPatterns[i];
                        if (pattern && typeof pattern.stop === 'function') {
                            pattern.stop();
                        }
                    } catch (e) {
                        // Ignore individual errors
                    }
                }
            }
            
            // Use hush() to stop all audio playback (this should stop everything at once)
            if (typeof hush === 'function') {
                hush();
                console.log('[StrudelApp] Audio stopped via hush()');
            } else {
                console.warn('[StrudelApp] hush function not available. Strudel may not be initialized.');
                alert('Stop function not available. Strudel may not be initialized.');
            }
            
            // Clear tracked patterns
            this.currentStackedPattern = null;
            this.currentPatterns = [];
            
            // Clear visualizations
            this.clearPatternVisualizations();
        } catch (error) {
            console.error('[StrudelApp] Error stopping audio:', error);
            alert('Error stopping audio: ' + error.message);
        }
    }

    /**
     * Save strudel content (active document to its file, or show Save As if untitled)
     */
    async saveStrudelContent() {
        this.syncEditorToActiveDocument();
        const doc = this.activeDocumentId ? this.openDocuments.find((d) => d.id === this.activeDocumentId) : null;
        if (!doc) return;

        const content = doc.content;
        let filePath = doc.filePath;

        if (!filePath) {
            if (!window.electron || !window.electron.showSaveDialog) {
                console.error('[StrudelApp] Electron file dialog API not available');
                return;
            }
            const result = await window.electron.showSaveDialog({
                defaultPath: doc.name || 'strudel-code.txt',
                filters: [
                    { name: 'Text Files', extensions: ['txt'] },
                    { name: 'All Files', extensions: ['*'] }
                ]
            });
            if (result.canceled || !result.filePath) return;
            filePath = result.filePath;
            doc.filePath = filePath;
            doc.name = filePath.split(/[/\\]/).pop() || doc.name;
        }

        try {
            const writeResult = await window.electron.writeFile(filePath, content);
            if (writeResult.success) {
                doc.lastSavedContent = content;
                doc.unsaved = false;
                this.renderOpenDocs();
                console.log('[StrudelApp] File saved successfully:', filePath);
            } else {
                alert('Error saving file: ' + writeResult.error);
            }
        } catch (error) {
            console.error('[StrudelApp] Error saving file:', error);
            alert('Error saving file: ' + error.message);
        }
    }

    /**
     * Open a file (add to open documents or switch to existing)
     */
    async openDocument() {
        if (!window.electron || !window.electron.showOpenDialog) {
            console.error('[StrudelApp] Electron file dialog API not available');
            return;
        }

        try {
            const result = await window.electron.showOpenDialog({
                filters: [
                    { name: 'Text Files', extensions: ['txt'] },
                    { name: 'All Files', extensions: ['*'] }
                ],
                properties: ['openFile']
            });

            if (result.canceled || !result.filePaths || result.filePaths.length === 0) return;

            const filePath = result.filePaths[0];
            const name = filePath.split(/[/\\]/).pop() || 'Untitled';

            const existing = this.openDocuments.find((d) => d.filePath === filePath);
            if (existing) {
                this.switchDocument(existing.id);
                return;
            }

            const readResult = await window.electron.readFile(filePath);
            if (!readResult.success) {
                alert('Error reading file: ' + readResult.error);
                return;
            }

            this.syncEditorToActiveDocument();
            const doc = createDocument(filePath, filePath, name, readResult.content);
            this.openDocuments.push(doc);
            this.activeDocumentId = doc.id;
            this.setEditorContent(doc.content);
            this.updateMirror();
            this.renderOpenDocs();
            this.persistOpenFiles();
            console.log('[StrudelApp] File opened:', filePath);
        } catch (error) {
            console.error('[StrudelApp] Error opening file:', error);
            alert('Error opening file: ' + error.message);
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new StrudelApp();
});
