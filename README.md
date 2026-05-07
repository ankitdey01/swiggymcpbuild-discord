# Swiggy MCP Discord Bot

A Discord bot that integrates Swiggy services (Food delivery, Instamart, Dineout) using the Swiggy Model Context Protocol (MCP). Built with Discord.js v14, TypeScript, and OAuth 2.1 PKCE authentication.

## Overview

**Swiggy MCP Discord Bot** brings Swiggy's capabilities directly into Discord. Users can:

- 🔐 Securely authenticate with their Swiggy account via OAuth 2.1
- 🍔 Browse and order food delivery
- 🛒 Shop for essentials on Instamart
- 🍽️ Make reservations at partner restaurants via Dineout
- 🤖 Get AI-powered assistance for all queries

The bot uses the Swiggy MCP to access real-time data and perform actions, making Swiggy services seamlessly available within Discord.

## Features

### Authentication & Security
- ✅ **OAuth 2.1 PKCE Flow** - Secure token-based authentication
- ✅ **State Token CSRF Protection** - Prevents authorization attacks
- ✅ **Automatic Token Management** - Expiry checking and auto-revocation
- ✅ **Secure Storage** - Tokens stored with expiration tracking

### Commands
- `/login` - Authenticate with your Swiggy account
- `/logout` - Disconnect your Swiggy account
- `/authstatus` - Check authentication status and token expiry
- `/ping` - Health check command

### Core Architecture
- ✅ **Discord.js v14** - Latest Discord API support
- ✅ **TypeScript** - Full type safety
- ✅ **Modular Design** - Easy to extend with new commands
- ✅ **OAuth Callback Server** - Built-in Express server for OAuth flow
- ✅ **Environment Configuration** - Secure credential management

## Requirements

- Node.js 18+
- Discord Bot Token (from [Discord Developer Portal](https://discord.com/developers/applications))
- Swiggy Client ID (from Swiggy Builders Club approval email)
- A machine to run the bot with internet connectivity

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and add your credentials:

```env
DISCORD_TOKEN=your_discord_bot_token_here
SWIGGY_CLIENT_ID=your_client_id_from_builders_club
DEVELOPER_IDS=your_discord_user_id
OAUTH_CALLBACK_URL=http://localhost:3000/auth/callback
```

### 3. Build and Run

```bash
npm start
```

This will:
- Compile TypeScript to JavaScript
- Start the Discord bot
- Start the OAuth callback server on `http://localhost:3000`
- Load all commands and event handlers

### 4. Test in Discord

1. Invite the bot to your server (with appropriate permissions)
2. Run `/login` in Discord
3. Click the "Login with Swiggy" button
4. Complete authentication on Swiggy's website
5. You'll be redirected back with a success confirmation
6. Your token is now stored and active

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                      Discord Bot                             │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Discord Events ──→ Event Handlers                            │
│                                                               │
│  User Commands ──→ Command Handler ──→ SwiggyAuth Module    │
│                                 │                             │
│                                 └──→ Swiggy MCP (Future)     │
│                                                               │
├──────────────────────────────────────────────────────────────┤
│  OAuth Callback Server (Express.js on port 3000)             │
│  - Handles /auth/callback                                    │
│  - Exchanges authorization code for token                    │
│  - Stores token securely                                     │
└──────────────────────────────────────────────────────────────┘
```

### Key Modules

1. **SwiggyAuth** (`src/utils/swiggyAuth.ts`)
   - PKCE code generation and challenge creation
   - Token exchange and retrieval
   - Token expiry validation and auto-cleanup
   - Token revocation on logout

2. **OAuthCallbackServer** (`src/structure/classes/OAuthCallbackServer.ts`)
   - Express.js HTTP server
   - Handles OAuth 2.1 redirects from Swiggy
   - Provides user-friendly HTML response pages
   - Logs all authentication events

3. **Custom Client** (`src/structure/classes/Client.ts`)
   - Extends Discord.js Client
   - Initializes Swiggy authentication on startup
   - Manages command and event loading

## Authentication System

### OAuth 2.1 PKCE Flow

The bot implements a secure OAuth 2.1 flow with PKCE (Proof Key for Code Exchange) to prevent token interception:

```
1. User runs /login
   ↓
2. Bot generates PKCE verifier & challenge
   ↓
3. Bot generates state token (CSRF protection)
   ↓
4. Bot sends user to Swiggy OAuth authorization page
   ↓
5. User authenticates with Swiggy credentials
   ↓
6. User grants permissions (mcp:tools, mcp:resources, mcp:prompts)
   ↓
7. Swiggy redirects to http://localhost:3000/auth/callback with code & state
   ↓
8. Bot exchanges code + verifier for access token
   ↓
9. Token stored in .auth.json with 5-day expiration
   ↓
10. ✓ User is authenticated in Discord
```

### Security Features

- **PKCE S256**: SHA256 code challenge method prevents authorization code interception
- **State Tokens**: Random tokens with 5-minute expiry for CSRF protection
- **Token Validation**: Automatic expiry checking before each API call
- **Secure Scopes**: Only requests necessary permissions (`mcp:tools`, `mcp:resources`, `mcp:prompts`)
- **Token Revocation**: Secure logout with token revocation at Swiggy

### Token Lifecycle

| Component | Duration | Notes |
|-----------|----------|-------|
| Authorization Code | 120 seconds | Single-use only |
| Access Token | 5 days | Stored in `.auth.json` |
| State Token | 5 minutes | CSRF protection, auto-cleanup |
| User Session | 30 days | Idle timeout with sliding window |

## Commands

### Authentication Commands

#### `/login`
Authenticate with your Swiggy account.

**Usage:**
```
/login
```

**Response:**
- If not authenticated: Shows button to authenticate with Swiggy
- If already authenticated: Shows current token status and expiry time

#### `/logout`
Disconnect your Swiggy account from the bot.

**Usage:**
```
/logout
```

**Response:**
- Revokes token with Swiggy
- Removes stored token locally
- Confirms successful logout

#### `/authstatus`
Check your current authentication status.

**Usage:**
```
/authstatus
```

**Response:**
- Authentication status (authenticated/not authenticated)
- Token expiry time (if authenticated)
- Available OAuth scopes
- Days and hours until token expiration

### Utility Commands

#### `/ping`
Health check command to verify the bot is responding.

**Usage:**
```
/ping
```

## Project Structure

```
src/
├── commands/
│   └── General/
│       ├── ping.ts                     # Health check
│       ├── login.ts                    # OAuth login
│       ├── logout.ts                   # OAuth logout
│       └── authstatus.ts               # Auth status check
├── events/
│   ├── client/
│   │   └── ready.ts                    # Bot ready event
│   └── handlers/
│       └── slash.ts                    # Slash command handler
├── structure/
│   ├── classes/
│   │   ├── Client.ts                   # Custom Discord client
│   │   ├── Handler.ts                  # Command/event loader
│   │   ├── Logger.ts                   # Chalk-based logging
│   │   └── OAuthCallbackServer.ts      # OAuth callback handler
│   ├── functions/
│   │   ├── get-files.ts                # File loader utility
│   │   ├── reply.ts                    # Interaction reply helper
│   │   └── editReply.ts                # Reply edit helper
│   └── interfaces/
│       ├── ClientOptions.ts
│       ├── Event.ts
│       └── command/
│           ├── Base.ts
│           └── Command.ts
├── utils/
│   └── swiggyAuth.ts                   # OAuth 2.1 implementation
├── config.ts                           # Environment-based config
└── index.ts                            # Entry point

dist/                                   # Compiled JavaScript
.env.example                            # Environment template
.gitignore
README.md                               # This file
package.json
tsconfig.json
LICENSE
```

## Configuration

### Environment Variables

Create a `.env` file with the following variables:

```env
# Discord Bot Token
# Get from: https://discord.com/developers/applications
DISCORD_TOKEN=your_discord_bot_token_here

# Swiggy OAuth 2.1 Client ID
# Get from: Swiggy Builders Club approval email
SWIGGY_CLIENT_ID=your_swiggy_client_id_here

# Discord Developer User IDs (comma-separated)
# These users will have bot owner permissions
DEVELOPER_IDS=your_discord_user_id_here

# OAuth 2.1 Callback URL
# Default: http://localhost:3000/auth/callback
# For production: https://your-domain.com/auth/callback
OAUTH_CALLBACK_URL=http://localhost:3000/auth/callback
```

### Token Storage

Tokens are stored in `.auth.json` with the following structure:

```json
[
  {
    "userId": "discord_user_id",
    "accessToken": "swiggy_access_token_here",
    "expiresAt": 1699999999999,
    "scope": "mcp:tools mcp:resources mcp:prompts"
  }
]
```

⚠️ **Important**: For production deployment, use a secure vault service:
- AWS Secrets Manager
- HashiCorp Vault
- Encrypted database
- Environment-based encrypted storage

## Dependencies

### Production
- **discord.js** (v14.25.1) - Discord API wrapper
- **chalk** (v4.1.2) - Colored console output
- **express** (v4.18.2) - OAuth callback server
- **dotenv** (v16.3.1) - Environment variable loading
- **axios** (v1.6.0) - HTTP client (for future API calls)

### Development
- **typescript** (v5.3.3) - TypeScript compiler
- **@types/express** - Express type definitions

## Setup for Production

### 1. Update OAuth Callback URL

Edit your `.env` to use your public domain:

```env
OAUTH_CALLBACK_URL=https://your-domain.com/auth/callback
```

### 2. Configure Reverse Proxy

If port 3000 isn't publicly accessible, use a reverse proxy (nginx, CloudFlare, etc.):

```nginx
location /auth/callback {
    proxy_pass http://localhost:3000/auth/callback;
}
```

### 3. Secure Token Storage

Update `SwiggyAuth` to use a vault:
- AWS Secrets Manager
- HashiCorp Vault
- Encrypted RDS/PostgreSQL

### 4. Enable HTTPS

Ensure all OAuth redirects use HTTPS for security.

### 5. Deploy Bot

Use a process manager like PM2 or Docker:

```bash
pm2 start npm --name "swiggy-bot" -- start
```

## Troubleshooting

### Issue: Port 3000 Already in Use

**Symptoms**: `Error: listen EADDRINUSE: address already in use :::3000`

**Solution**:
```powershell
# Find process using port 3000
netstat -ano | findstr :3000

# Kill the process (replace PID)
taskkill /PID 1234 /F
```

Or configure a different port in `src/structure/classes/Client.ts`:
```ts
this.oauthServer = new OAuthCallbackServer(3001, this.swiggyAuth, this);
```

### Issue: SWIGGY_CLIENT_ID Not Set

**Symptoms**: `Error: SWIGGY_CLIENT_ID environment variable not set`

**Solution**:
1. Verify `.env` file exists and has `SWIGGY_CLIENT_ID` set
2. Restart the bot after updating `.env`

### Issue: Token Exchange Fails (401)

**Symptoms**: `Token exchange failed: 401`

**Causes**:
- Invalid `SWIGGY_CLIENT_ID`
- `OAUTH_CALLBACK_URL` doesn't match Swiggy's configured callback URL
- Authorization code expired (only valid for 120 seconds)

**Solution**:
1. Verify `SWIGGY_CLIENT_ID` is correct
2. Check `OAUTH_CALLBACK_URL` matches Swiggy settings
3. Try `/login` again - authorization code may have expired

### Issue: Callback Server Not Starting

**Symptoms**: OAuth callback server fails to start

**Check**:
- Port 3000 isn't already in use
- Express.js is installed: `npm list express`
- `.env` file exists and is readable

### Issue: TypeScript Compilation Errors

**Solution**:
```bash
# Clear compiled files
rm -r dist

# Reinstall dependencies
npm install

# Recompile
npx tsc

# Run
node .
```

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `SWIGGY_CLIENT_ID not set` | Missing environment variable | Add to `.env` and restart bot |
| `Invalid or expired state token` | State token expired or tampered | Retry `/login` command |
| `Token exchange failed: 401` | Invalid authorization code | Restart OAuth flow |
| `Token exchange failed: 403` | Insufficient OAuth scopes | Request scope approval |
| `Port 3000 already in use` | Another process using the port | Kill process or use different port |

## Development Roadmap

### Phase 1: Authentication ✅ COMPLETE
- ✅ OAuth 2.1 PKCE flow
- ✅ Token management and storage
- ✅ Authentication commands (`/login`, `/logout`, `/authstatus`)
- ✅ Token expiry validation

### Phase 2: Swiggy MCP Integration (Next)
- ⏳ Food delivery commands
  - `/order` - Browse and order food
  - `/track` - Track active orders
  - `/delivery` - View delivery options
- ⏳ Instamart integration
  - `/shop` - Browse products
  - `/groceries` - Quick grocery ordering
- ⏳ Dineout integration
  - `/restaurants` - Search restaurants
  - `/reserve` - Make reservations
  - `/reviews` - Get restaurant reviews

### Phase 3: Advanced Features (Future)
- ⏳ Automatic token refresh using refresh tokens
- ⏳ User preferences and settings (`/settings`)
- ⏳ Order history and favorites
- ⏳ Notification system for order updates
- ⏳ Admin dashboard for bot analytics
- ⏳ Multi-language support

## Contributing

This is a personal project for Swiggy Builders Club integration. For bugs or suggestions, please open an issue.

## License

See [LICENSE](LICENSE).

## Support

For issues or questions:

1. Check the **Troubleshooting** section above
2. Review logs in the console output
3. Verify all environment variables are correctly set
4. Check that Discord bot has necessary permissions in your server

## References

- [Swiggy MCP Documentation](https://mcp.swiggy.com)
- [Discord.js Guide](https://discordjs.guide/)
- [OAuth 2.1 PKCE Flow (RFC 7636)](https://datatracker.ietf.org/doc/html/rfc7636)
- [Express.js Documentation](https://expressjs.com/)
- [Discord Developer Portal](https://discord.com/developers/applications)

---

**Status**: ✅ Authentication system complete and tested. Ready for Swiggy MCP integration!

Built with ❤️ for the Swiggy Builders Club
