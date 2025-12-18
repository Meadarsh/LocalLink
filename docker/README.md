# OpenTunnel Docker Client

Run OpenTunnel client in a Docker container without installing Node.js or npm globally.

## Building the Image

```bash
docker build -t opentunnel -f docker/Dockerfile .
```

## Usage

### Initialize Configuration

```bash
docker run --rm opentunnel init https://your-domain.com
```

### Start Tunnel (default port 3000)

```bash
docker run --rm opentunnel
```

### Start Tunnel (custom port)

```bash
docker run --rm opentunnel 8080
```

### Start Tunnel (with domain and port)

```bash
docker run --rm opentunnel https://your-domain.com 8080
```

### Check Status

```bash
docker run --rm opentunnel status
```

## Persistent Configuration

To persist configuration across container runs, mount the config directory:

```bash
docker run --rm -v ~/.opentunnel:/root/.opentunnel opentunnel
```

## Example: Tunneling a Local Web Server

```bash
# Terminal 1: Start your local server
python -m http.server 3000

# Terminal 2: Start tunnel
docker run --rm -v ~/.opentunnel:/root/.opentunnel opentunnel 3000
```

