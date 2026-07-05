import crypto from "crypto";
import fs from "fs";
import path from "path";
import { logger } from "../structure/classes/Logger.js";

interface TokenResponse {
    access_token: string;
    expires_in: number;
    scope: string;
}

interface StoredAuth {
    userId: string;
    accessToken: string;
    expiresAt: number;
    scope: string;
}

interface AuthState {
    userId: string;
    codeVerifier: string;
    createdAt: number;
}

const SWIGGY_BASE = "https://mcp.swiggy.com";
const AUTH_FILE = path.join(process.cwd(), ".auth.json");
const STATE_STORE: Map<string, AuthState> = new Map();
const STATE_EXPIRY = 5 * 60 * 1000; // 5 minutes

export class SwiggyAuth {
    private clientId: string;
    private callbackUrl: string;

    constructor(clientId: string, callbackUrl: string) {
        this.clientId = clientId;
        this.callbackUrl = callbackUrl;
        this.loadStoredAuth();
    }

    /**
     * Generate PKCE code verifier and challenge
     */
    generatePKCE() {
        const codeVerifier = crypto.randomBytes(32).toString("base64url");
        const codeChallenge = crypto
            .createHash("sha256")
            .update(codeVerifier)
            .digest("base64url");

        return { codeVerifier, codeChallenge };
    }

    /**
     * Generate a state token for CSRF protection
     */
    generateState(): string {
        return crypto.randomBytes(16).toString("hex");
    }

    /**
     * Build the Swiggy OAuth authorization URL
     */
    getAuthorizationUrl(userId: string): string {
        const { codeVerifier, codeChallenge } = this.generatePKCE();
        const state = this.generateState();

        // Store state and verifier for later exchange
        STATE_STORE.set(state, {
            userId,
            codeVerifier,
            createdAt: Date.now()
        });

        // Clean up old state entries
        this.cleanupExpiredState();

        const params = new URLSearchParams({
            response_type: "code",
            client_id: this.clientId,
            redirect_uri: this.callbackUrl,
            code_challenge: codeChallenge,
            code_challenge_method: "S256",
            state: state,
            scope: "mcp:tools mcp:resources mcp:prompts"
        });

        return `${SWIGGY_BASE}/auth/authorize?${params.toString()}`;
    }

    /**
     * Exchange authorization code for access token
     */
    async exchangeCodeForToken(
        code: string,
        state: string
    ): Promise<{ accessToken: string; expiresIn: number; userId: string }> {
        const authState = STATE_STORE.get(state);

        if (!authState) {
            throw new Error("Invalid or expired state token");
        }

        if (Date.now() - authState.createdAt > STATE_EXPIRY) {
            STATE_STORE.delete(state);
            throw new Error("State token expired");
        }

        try {
            const response = await fetch(`${SWIGGY_BASE}/auth/token`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    grant_type: "authorization_code",
                    code: code,
                    code_verifier: authState.codeVerifier,
                    client_id: this.clientId,
                    redirect_uri: this.callbackUrl
                })
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Token exchange failed: ${response.status} - ${error}`);
            }

            const data = (await response.json()) as TokenResponse;

            const expiresAt = Date.now() + (data.expires_in * 1000);
            const storedAuth: StoredAuth = {
                userId: authState.userId,
                accessToken: data.access_token,
                expiresAt: expiresAt,
                scope: data.scope
            };

            // Save to persistent storage
            this.saveAuth(storedAuth);

            // Clean up state
            STATE_STORE.delete(state);

            return {
                accessToken: data.access_token,
                expiresIn: data.expires_in,
                userId: authState.userId
            };
        } catch (error) {
            STATE_STORE.delete(state);
            throw error;
        }
    }

    /**
     * Get stored access token for a user
     */
    getAccessToken(userId: string): string | null {
        try {
            const data = this.readAuthFile();
            const auth = data.find((a: StoredAuth) => a.userId === userId);

            if (!auth) return null;

            // Check if token is still valid
            if (Date.now() >= auth.expiresAt) {
                this.removeAuth(userId);
                return null;
            }

            return auth.accessToken;
        } catch {
            return null;
        }
    }

    /**
     * Check if user is authenticated and token is valid
     */
    isAuthenticated(userId: string): boolean {
        return this.getAccessToken(userId) !== null;
    }

    /**
     * Get time until token expires (in seconds)
     */
    getTokenExpiry(userId: string): number | null {
        try {
            const data = this.readAuthFile();
            const auth = data.find((a: StoredAuth) => a.userId === userId);
            if (!auth) return null;

            const secondsRemaining = Math.floor((auth.expiresAt - Date.now()) / 1000);
            return secondsRemaining > 0 ? secondsRemaining : null;
        } catch {
            return null;
        }
    }

    /**
     * Logout user (revoke token)
     */
    async logout(userId: string): Promise<void> {
        const token = this.getAccessToken(userId);
        if (!token) return;

        try {
            await fetch(`${SWIGGY_BASE}/auth/logout`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            });
        } catch (error) {
            logger.error("Auth", `Logout request failed: ${error instanceof Error ? error.message : String(error)}`);
        }

        this.removeAuth(userId);
    }

    /**
     * Save authentication to persistent storage
     */
    private saveAuth(auth: StoredAuth): void {
        try {
            const data = this.readAuthFile();
            const index = data.findIndex((a: StoredAuth) => a.userId === auth.userId);

            if (index >= 0) {
                data[index] = auth;
            } else {
                data.push(auth);
            }

            fs.writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2), "utf-8");
        } catch (error) {
            logger.error("Auth", `Failed to save auth: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Remove authentication for user
     */
    private removeAuth(userId: string): void {
        try {
            const data = this.readAuthFile();
            const filtered = data.filter((a: StoredAuth) => a.userId !== userId);
            fs.writeFileSync(AUTH_FILE, JSON.stringify(filtered, null, 2), "utf-8");
        } catch (error) {
            logger.error("Auth", `Failed to remove auth: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Load stored authentications from file
     */
    private loadStoredAuth(): void {
        if (!fs.existsSync(AUTH_FILE)) {
            fs.writeFileSync(AUTH_FILE, "[]", "utf-8");
        }
    }

    /**
     * Read authentication file
     */
    private readAuthFile(): StoredAuth[] {
        try {
            const content = fs.readFileSync(AUTH_FILE, "utf-8");
            return JSON.parse(content);
        } catch {
            return [];
        }
    }

    /**
     * Clean up expired state tokens
     */
    private cleanupExpiredState(): void {
        const now = Date.now();
        for (const [state, authState] of STATE_STORE.entries()) {
            if (now - authState.createdAt > STATE_EXPIRY) {
                STATE_STORE.delete(state);
            }
        }
    }
}
