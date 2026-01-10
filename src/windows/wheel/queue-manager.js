const SharedQueueManager = require('../shared/queue-manager');

/**
 * Wheel-specific queue manager
 * Initializes queues based on wheel options from the window configuration
 */
class WheelQueueManager extends SharedQueueManager {
    constructor(windowConfig = {}) {
        super(windowConfig);
        // Extract wheel options from window config
        this.wheelOptions = windowConfig.wheelOptions || [];
        console.log(`[WheelQueueManager] Constructor called with wheelOptions:`, this.wheelOptions.length);
        // Now initialize queues after wheelOptions is set
        this.initializeQueues();
    }

    /**
     * Initialize queues based on wheel configuration
     * Create a queue for each unique application-controller combination
     */
    initializeQueues() {
        console.log(`[WheelQueueManager] initializeQueues called, wheelOptions:`, this.wheelOptions);
        const queueMap = new Set();

        this.wheelOptions.forEach(option => {
            if (option.application && option.controller) {
                const queueName = `${option.application}-${option.controller}`;
                queueMap.add(queueName);
            }
        });

        queueMap.forEach(queueName => {
            this.createQueue(queueName);
        });

        console.log(`[WheelQueueManager] Initialized ${queueMap.size} queue(s) from wheel config`);
    }
}

module.exports = WheelQueueManager;
