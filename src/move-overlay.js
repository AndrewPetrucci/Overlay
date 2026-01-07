document.addEventListener('DOMContentLoaded', () => {
    const moveIcon = document.getElementById('moveIcon');
    let isMoving = false;
    let startX = 0;
    let startY = 0;

    if (moveIcon && window.electron) {
        moveIcon.addEventListener('mousedown', (e) => {
            isMoving = true;
            startX = e.screenX;
            startY = e.screenY;
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (isMoving && window.electron) {
                const deltaX = e.screenX - startX;
                const deltaY = e.screenY - startY;

                // Send position delta to main process
                window.electron.moveWindowBy(deltaX, deltaY);

                // Update start position for next calculation
                startX = e.screenX;
                startY = e.screenY;

                e.preventDefault();
            }
        });

        document.addEventListener('mouseup', () => {
            if (isMoving) {
                isMoving = false;
            }
        });

        // Prevent drag operations on the move icon
        moveIcon.addEventListener('dragstart', (e) => e.preventDefault());
    }
});

