const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const crypto = require('crypto');

/**
 * Secure token storage for OAuth tokens
 * Uses encryption to store tokens securely on disk
 */
class TokenStorage {
    constructor() {
        // Use Electron's userData directory for secure storage
        this.storageDir = app.getPath('userData');
        this.tokenFile = path.join(this.storageDir, 'twitch-token.enc');
        
        // Generate or load encryption key (stored in userData)
        this.keyFile = path.join(this.storageDir, '.token-key');
        this.encryptionKey = this.getOrCreateKey();
    }

    /**
     * Get or create encryption key for token storage
     * Uses a machine-specific key derived from userData path
     */
    getOrCreateKey() {
        try {
            if (fs.existsSync(this.keyFile)) {
                const keyData = fs.readFileSync(this.keyFile, 'utf8');
                return Buffer.from(keyData, 'hex');
            } else {
                // Generate a new key based on userData path (machine-specific)
                const userDataPath = this.storageDir;
                const key = crypto.createHash('sha256')
                    .update(userDataPath + process.platform)
                    .digest();
                
                // Store the key for future use
                fs.writeFileSync(this.keyFile, key.toString('hex'), { mode: 0o600 });
                return key;
            }
        } catch (error) {
            console.error('[TokenStorage] Error managing encryption key:', error);
            // Fallback: use a simple hash if key management fails
            return crypto.createHash('sha256')
                .update(this.storageDir + 'fallback')
                .digest();
        }
    }

    /**
     * Encrypt token before storage
     */
    encryptToken(token) {
        try {
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
            
            let encrypted = cipher.update(token, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            // Store IV with encrypted data
            return iv.toString('hex') + ':' + encrypted;
        } catch (error) {
            console.error('[TokenStorage] Encryption error:', error);
            throw error;
        }
    }

    /**
     * Decrypt token after retrieval
     */
    decryptToken(encryptedData) {
        try {
            const parts = encryptedData.split(':');
            if (parts.length !== 2) {
                throw new Error('Invalid encrypted data format');
            }
            
            const iv = Buffer.from(parts[0], 'hex');
            const encrypted = parts[1];
            
            const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
        } catch (error) {
            console.error('[TokenStorage] Decryption error:', error);
            throw error;
        }
    }

    /**
     * Save OAuth token securely
     */
    saveToken(token) {
        try {
            if (!token) {
                console.warn('[TokenStorage] Attempted to save empty token');
                return false;
            }

            // Ensure storage directory exists
            if (!fs.existsSync(this.storageDir)) {
                fs.mkdirSync(this.storageDir, { recursive: true, mode: 0o700 });
            }

            // Encrypt and save token
            const encrypted = this.encryptToken(token);
            fs.writeFileSync(this.tokenFile, encrypted, { mode: 0o600 });
            
            console.log('[TokenStorage] Token saved securely');
            return true;
        } catch (error) {
            console.error('[TokenStorage] Failed to save token:', error);
            return false;
        }
    }

    /**
     * Load OAuth token from secure storage
     */
    loadToken() {
        try {
            if (!fs.existsSync(this.tokenFile)) {
                console.log('[TokenStorage] No saved token found');
                return null;
            }

            const encrypted = fs.readFileSync(this.tokenFile, 'utf8');
            const token = this.decryptToken(encrypted);
            
            console.log('[TokenStorage] Token loaded from secure storage');
            return token;
        } catch (error) {
            console.error('[TokenStorage] Failed to load token:', error);
            // If decryption fails, the token file might be corrupted - remove it
            try {
                fs.unlinkSync(this.tokenFile);
                console.log('[TokenStorage] Removed corrupted token file');
            } catch (unlinkError) {
                // Ignore unlink errors
            }
            return null;
        }
    }

    /**
     * Delete stored token
     */
    deleteToken() {
        try {
            if (fs.existsSync(this.tokenFile)) {
                fs.unlinkSync(this.tokenFile);
                console.log('[TokenStorage] Token deleted');
                return true;
            }
            return false;
        } catch (error) {
            console.error('[TokenStorage] Failed to delete token:', error);
            return false;
        }
    }
}

module.exports = TokenStorage;
