import express, { Express, Request, Response } from "express";
import { SwiggyAuth } from "../../utils/swiggyAuth.js";
import { CustomClient } from "./Client.js";

export class OAuthCallbackServer {
    private app: Express;
    private port: number;
    private auth: SwiggyAuth;
    private client: CustomClient;

    constructor(port: number, auth: SwiggyAuth, client: CustomClient) {
        this.port = port;
        this.auth = auth;
        this.client = client;
        this.app = express();
        this.setupRoutes();
    }

    private setupRoutes() {
        // OAuth callback endpoint
        this.app.get("/auth/callback", async (req: Request, res: Response) => {
            const { code, state, error, error_description } = req.query;

            if (error) {
                const errorMsg = `OAuth Error: ${error} - ${error_description || "Unknown error"}`;
                this.client.logger.error("Auth", errorMsg);
                return res.status(400).send(
                    `<h1>Authentication Failed</h1><p>${error_description || error}</p>`
                );
            }

            if (!code || !state) {
                return res.status(400).send(
                    "<h1>Invalid Request</h1><p>Missing code or state parameter</p>"
                );
            }

            try {
                const { accessToken, userId, expiresIn } = await this.auth.exchangeCodeForToken(
                    code as string,
                    state as string
                );

                this.client.logger.info(
                    "Auth",
                    `User ${userId} authenticated successfully with token ${accessToken} (expires in ${expiresIn}s)`
                );

                // Send success page

                return res.status(200).send(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Authentication Successful</title>
                        <style>
                            body { font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 2rem; background: #f5f5f5; }
                            .container { background: white; border-radius: 8px; padding: 2rem; max-width: 600px; margin: 0 auto; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
                            h1 { color: #2ecc71; }
                            p { color: #666; font-size: 1.1rem; }
                            .code { background: #f0f0f0; padding: 1rem; border-radius: 4px; font-family: monospace; word-break: break-all; margin: 1rem 0; }
                            .close { margin-top: 1rem; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h1>✓ Authentication Successful</h1>
                            <p>Your Swiggy account is now connected to the Discord bot.</p>
                            <p>You can close this window and return to Discord.</p>
                            <div class="code">Token: ${accessToken.substring(0, 20)}...</div>
                            <p style="font-size: 0.9rem; color: #999;">This token will expire in ${Math.floor(expiresIn / 86400)} days</p>
                        </div>
                        <script>
                            setTimeout(() => window.close(), 3000);
                        </script>
                    </body>
                    </html>
                `);
            } catch (error: any) {
                this.client.logger.error("Auth", `Token exchange failed: ${error.message}`);
                return res.status(500).send(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Authentication Failed</title>
                        <style>
                            body { font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 2rem; background: #f5f5f5; }
                            .container { background: white; border-radius: 8px; padding: 2rem; max-width: 600px; margin: 0 auto; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
                            h1 { color: #e74c3c; }
                            p { color: #666; font-size: 1.1rem; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h1>✗ Authentication Failed</h1>
                            <p>Failed to exchange authorization code for token.</p>
                            <p style="font-family: monospace; color: #999; font-size: 0.9rem;">${error.message}</p>
                            <p>Please try again or contact support.</p>
                        </div>
                    </body>
                    </html>
                `);
            }
        });

        // Health check
        this.app.get("/health", (_req: Request, res: Response) => {
            res.status(200).json({ status: "ok" });
        });
    }

    start() {
        this.app.listen(this.port, () => {
            this.client.logger.info(
                "OAuth",
                `Callback server running on http://localhost:${this.port}`
            );
        });
    }
}
