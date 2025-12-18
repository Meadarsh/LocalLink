# Homebrew Installation for OpenTunnel

## Installation Methods

### Method 1: Install from Local Formula

```bash
brew install --build-from-source ./homebrew/opentunnel.rb
```

### Method 2: Create Your Own Tap

1. Create a GitHub repository named `homebrew-opentunnel`
2. Add the formula file to the repository
3. Install via tap:

```bash
brew tap yourusername/opentunnel
brew install opentunnel
```

### Method 3: Direct Installation (After Publishing)

Once published to npm, you can create a formula that installs from npm:

```ruby
class Opentunnel < Formula
  desc "Self-hosted HTTPS tunneling system"
  homepage "https://github.com/yourusername/opentunnel"
  url "https://registry.npmjs.org/opentunnel/-/opentunnel-1.0.0.tgz"
  sha256 "..." # npm package SHA256
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", "-g", "opentunnel"
  end
end
```

## Updating the Formula

1. Update the `url` field with the new release URL
2. Update the `sha256` field with the new package SHA256
3. Update the version number in the formula

## Testing the Formula

```bash
brew install --build-from-source --verbose --debug ./homebrew/opentunnel.rb
```

## Formula Requirements

- **url**: Download URL for the source code or npm package
- **sha256**: SHA256 checksum of the download
- **version**: Version number (extracted from URL or specified)
- **depends_on**: Dependencies (Node.js required)

## Notes

- The formula installs the client package globally
- Configuration is stored in `~/.opentunnel/`
- The `opentunnel` command will be available in PATH after installation

