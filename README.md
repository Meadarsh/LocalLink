# LocalLink

A self-hosted HTTPS tunneling system similar to ngrok, but intentionally simpler and compatible with Render free-tier hosting.

**LocalLink** allows you to expose local services to the internet through a central server, perfect for development, testing, and demos.

## Features

- ✅ **Self-hosted** - Deploy your own tunnel server
- ✅ **Simple** - One active tunnel at a time, no complexity
- ✅ **Render-compatible** - Works with Render's free-tier HTTPS
- ✅ **Auto-reconnect** - Automatic reconnection with exponential backoff
- ✅ **Streaming** - Handles large payloads without buffering
- ✅ **Colored logs** - Beautiful, color-coded terminal output
- ✅ **Status tracking** - Monitor connection status and uptime
- ✅ **Docker support** - Run client in Docker containers
- ✅ **Homebrew support** - Easy macOS installation

## Architecture

LocalLink consists of two components:

1. **Server** - Central tunnel server that receives HTTPS traffic and forwards it to clients
2. **Client** - CLI tool that connects to the server and forwards local traffic

```
Internet → HTTPS → Server → WebSocket → Client → Local Service
```

## Quick Start

### 1. Deploy the Server

Deploy the server to Render (or any Node.js hosting):

```bash
cd server
npm install
```

Set environment variable:
- `PORT` (optional, defaults to 3001)

Deploy to Render:
1. Create a new Web Service
2. Connect your repository
3. Set build command: `cd server && npm install`
4. Set start command: `cd server && npm start`
5. Render will provide HTTPS automatically

### 2. Install the Client

#### Via npm (After Publishing)

```bash
npm install -g @meadarsh/locallink
```

**Note:** Package uses scoped name `@meadarsh/locallink`. After installation, use `locallink` command.

#### From Source (Recommended for Now)

```bash
cd client
npm install
npm link  # Makes locallink command available globally
```

#### Via Homebrew (macOS)

```bash
brew install --build-from-source ./homebrew/opentunnel.rb
```

#### Via Docker

```bash
docker build -t locallink -f docker/Dockerfile .
```

### 3. Configure and Use

```bash
# Initialize with your server domain
locallink init https://your-server.onrender.com

# Start tunneling (default port 3000)
locallink

# Start tunneling on custom port
locallink 8080

# Check status
locallink status
```

## Installation

### Server Installation

1. Clone the repository:
```bash
git clone https://github.com/Meadarsh/LocalLink.git
cd LocalLink
```

2. Install dependencies:
```bash
cd server
npm install
```

3. Start the server:
```bash
npm start
```

The server will listen on port 3001 (or `PORT` environment variable).

### Client Installation

#### From Source (Recommended)

```bash
cd client
npm install
npm link  # Makes locallink command available globally
```

#### Global npm Install (After Publishing)

```bash
npm install -g @meadarsh/locallink
```

**Note:** Package uses scoped name `@meadarsh/locallink`. After installation, use `locallink` command.

```bash
cd client
npm install
npm link  # Makes locallink command available globally
```

#### Docker

```bash
# Build image
docker build -t locallink -f docker/Dockerfile .

# Run
docker run --rm locallink init https://your-domain.com
docker run --rm locallink 3000
```

#### Homebrew (macOS)

```bash
brew install --build-from-source ./homebrew/opentunnel.rb
```

## Usage

### Initial Setup

First, configure your server domain:

```bash
locallink init https://your-server.onrender.com
```

This saves the domain to `~/.locallink/config.json`.

### Starting a Tunnel

Start tunneling your local service:

```bash
# Default port 3000
locallink

# Custom port
locallink 8080

# Explicit port flag
locallink --port 5000
```

### Checking Status

```bash
locallink status
```

Output:
```
Status: Connected
Domain: https://your-server.onrender.com
Port: 3000
Uptime: 2h 15m 30s
```

### Docker Usage

```bash
# Initialize
docker run --rm locallink init https://your-domain.com

# Start tunnel (with persistent config)
docker run --rm -v ~/.locallink:/root/.locallink locallink 3000

# Or combine domain and port
docker run --rm locallink https://your-domain.com 3000
```

## Deployment

### Render Deployment

1. **Create a new Web Service** on Render
2. **Connect your repository**
3. **Configure:**
   - **Build Command:** `cd server && npm install`
   - **Start Command:** `cd server && npm start`
   - **Environment:** Node.js
   - **Port:** Render auto-assigns (use `PORT` env var if needed)

4. **HTTPS:** Render provides HTTPS automatically - no certificate setup needed!

5. **Get your domain:** Render provides a URL like `https://locallink-xyz.onrender.com`

### Other Platforms

LocalLink works on any Node.js hosting platform:

- **Heroku:** Set `PORT` environment variable
- **Railway:** Automatic port detection
- **Fly.io:** Set `PORT` in fly.toml
- **VPS:** Use PM2 or systemd to run `server/server.js`

## Configuration

### Server Configuration

Environment variables:
- `PORT` - Server port (default: 3001)

### Client Configuration

Configuration is stored in `~/.locallink/config.json`:

```json
{
  "domain": "https://your-server.onrender.com",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

## Features in Detail

### Auto-Reconnect

The client automatically reconnects on disconnect with exponential backoff:
- Starts at 1 second delay
- Doubles each attempt (1s, 2s, 4s, 8s, ...)
- Caps at 60 seconds
- Includes jitter to prevent thundering herd

### Streaming

LocalLink streams request and response bodies in chunks:
- No memory buffering for large payloads
- Supports files, uploads, and streaming responses
- Efficient for large data transfers

### Colored Logs

- 🟢 **Green** - Success messages (connected, registered)
- 🟡 **Yellow** - Warnings/reconnecting
- 🔴 **Red** - Errors
- 🔵 **Cyan** - Info messages

### Status Tracking

Real-time status tracking:
- Connection state
- Domain and port
- Uptime calculation
- Stored in `~/.locallink/status.json`

## Development

### Project Structure

```
locallink/
├── server/           # Tunnel server
│   ├── server.js     # Express server + WebSocket
│   ├── tunnel.js     # Tunnel management
│   └── package.json
├── client/           # CLI client
│   ├── bin/          # CLI entry point
│   ├── lib/          # Client libraries
│   └── package.json
├── docker/           # Docker client
│   └── Dockerfile
├── homebrew/         # Homebrew formula
│   └── opentunnel.rb
└── README.md
```

### Running Locally

**Server:**
```bash
cd server
npm install
npm start
```

**Client:**
```bash
cd client
npm install
node bin/opentunnel.js init http://localhost:3001
node bin/opentunnel.js 3000
```

## Troubleshooting

### Client can't connect to server

- Verify server is running: `curl https://your-server.onrender.com/health`
- Check domain in config: `cat ~/.locallink/config.json`
- Ensure WebSocket endpoint is accessible: `wss://your-server.onrender.com/connect`

### Tunnel disconnects frequently

- Check server logs for errors
- Verify network stability
- Auto-reconnect should handle temporary disconnects

### Port already in use

- Use a different port: `locallink 8080`
- Stop the service using the port
- Check with: `lsof -i :3000`

## Security Considerations

- **No authentication by default** - This is a self-hosted tool for private use
- **HTTPS required** - All traffic is encrypted via Render's HTTPS
- **Local services** - Only localhost services are exposed
- **Optional shared secret** - Can be added for additional security

## Limitations

- **One tunnel at a time** - Simple design, one active tunnel per server
- **No persistence** - Server state is in-memory (no database)
- **Free-tier constraints** - Designed for Render free-tier (sleeps after inactivity)

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details

## Acknowledgments

Inspired by ngrok, but designed to be simpler and self-hosted.

## Support

- **Issues:** [GitHub Issues](https://github.com/Meadarsh/LocalLink/issues)
- **Discussions:** [GitHub Discussions](https://github.com/Meadarsh/LocalLink/discussions)

## Changelog

### v1.0.0 (Initial Release)

- Server with WebSocket tunnel support
- Client CLI with auto-reconnect
- Streaming request/response bodies
- Status tracking and colored logs
- Docker and Homebrew support

---

**Made with ❤️ for developers who want simple, self-hosted tunneling**

