document.addEventListener('DOMContentLoaded', () => {
    const windowBar = document.getElementById('windowBar');
    const minimizeBtn = document.getElementById('minimizeBtn');
    const closeBtn = document.getElementById('closeBtn');

    let isMoving = false;
    let initialMouseX = 0;
    let initialMouseY = 0;
    let initialWindowX = 0;
    let initialWindowY = 0;

    // Enable mouse events when hovering over window bar (for dragging)
    if (windowBar && window.electron) {
        windowBar.addEventListener('mouseenter', () => {
            window.electron.mouseOverInteractive(true);
        });

        windowBar.addEventListener('mouseleave', () => {
            if (!isMoving) {
                window.electron.mouseOverInteractive(false);
            }
        });

        // Handle dragging the window bar
        windowBar.addEventListener('pointerdown', (e) => {
            // Don't drag if clicking on buttons
            if (e.target.closest('.window-btn')) {
                return;
            }
            isMoving = true;
            windowBar.classList.add('dragging');
            initialMouseX = e.screenX;
            initialMouseY = e.screenY;

            // Capture pointer to continue receiving events outside window
            windowBar.setPointerCapture(e.pointerId);

            // Get initial window position from main process
            if (window.electron && window.electron.getWindowPosition) {
                const pos = window.electron.getWindowPosition();
                initialWindowX = pos.x;
                initialWindowY = pos.y;
            }
            e.preventDefault();
        });

        document.addEventListener('pointermove', (e) => {
            if (isMoving && window.electron) {
                const totalDeltaX = e.screenX - initialMouseX;
                const totalDeltaY = e.screenY - initialMouseY;

                const newX = initialWindowX + totalDeltaX;
                const newY = initialWindowY + totalDeltaY;

                window.electron.moveWindowTo(newX, newY);
                e.preventDefault();
            }
        });

        document.addEventListener('pointerup', () => {
            if (isMoving) {
                isMoving = false;
                windowBar.classList.remove('dragging');
                window.electron.mouseOverInteractive(true);
            }
        });
    }

    if (minimizeBtn && window.electron) {
        minimizeBtn.addEventListener('click', () => {
            window.electron.minimizeWindow();
        });
    }

    if (closeBtn && window.electron) {
        closeBtn.addEventListener('click', () => {
            window.electron.closeWindow();
        });
    }
});
