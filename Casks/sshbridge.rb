cask "sshbridge" do
  version "2.1.0"
  sha256 "a897532f4002ed23b8b8f57312d0e0636e4b44729d0c42dad0030d80f43419cd"

  url "https://github.com/nghoang1288/SSHBridge-Web/releases/download/release-#{version}-tag/sshbridge_macos_universal_dmg.dmg"
  name "SSHBridge"
  desc "Web-based server management platform with SSH terminal, tunneling, and file editing"
  homepage "https://github.com/nghoang1288/SSHBridge-Web"

  livecheck do
    url :url
    strategy :github_latest
  end

  app "SSHBridge.app"

  zap trash: [
    "~/Library/Application Support/sshbridge",
    "~/Library/Caches/com.nghoang.sshbridge",
    "~/Library/Caches/com.nghoang.sshbridge.ShipIt",
    "~/Library/Preferences/com.nghoang.sshbridge.plist",
    "~/Library/Saved Application State/com.nghoang.sshbridge.savedState",
  ]
end
