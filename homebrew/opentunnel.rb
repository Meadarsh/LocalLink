# Homebrew formula for OpenTunnel
# To install: brew install --build-from-source opentunnel.rb
# Or add to your tap: brew tap yourusername/opentunnel

class Opentunnel < Formula
  desc "Self-hosted HTTPS tunneling system (similar to ngrok)"
  homepage "https://github.com/yourusername/opentunnel"
  url "https://github.com/yourusername/opentunnel/archive/refs/tags/v1.0.0.tar.gz"
  sha256 "PLACEHOLDER_SHA256" # Update after first release
  license "MIT"

  depends_on "node"

  def install
    # Install client dependencies
    system "npm", "install", "--prefix", "client", "--production"
    
    # Install globally
    libexec.install "client"
    
    # Create wrapper script
    (bin/"opentunnel").write <<~EOS
      #!/bin/bash
      exec "#{libexec}/client/bin/opentunnel.js" "$@"
    EOS
    
    chmod 0555, bin/"opentunnel"
  end

  test do
    # Test that opentunnel command exists
    assert_match "opentunnel", shell_output("#{bin}/opentunnel --help 2>&1", 1)
  end
end

