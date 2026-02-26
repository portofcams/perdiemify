#!/bin/bash
# setup-vultr.sh — Run as root on first login
# ssh -i ~/.ssh/perdiemify root@45.77.120.186

set -e

echo "=== Perdiemify Server Setup ==="

# 1. Update system
apt update && apt upgrade -y

# 2. Install Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

# 3. Install Docker Compose (v2 plugin)
apt install -y docker-compose-plugin
docker compose version

# 4. Create deploy user (use this instead of root going forward)
adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys

# 5. Configure UFW firewall (backup to Vultr firewall)
apt install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# 6. Install fail2ban
apt install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban

# 7. Configure swap (4GB safety net)
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# 8. Set up project directory
mkdir -p /opt/perdiemify
chown deploy:deploy /opt/perdiemify

# 9. Install certbot for SSL
apt install -y certbot

# 10. Install useful tools
apt install -y htop curl wget git jq unzip nano

# 11. Configure log rotation for Docker
cat > /etc/docker/daemon.json << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF
systemctl restart docker

# 12. Auto security updates
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades

# 13. Harden SSH (disable password auth after key works)
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/PermitRootLogin yes/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
systemctl restart sshd

echo "=== Setup Complete ==="
echo "Next steps:"
echo "1. Test SSH as deploy user: ssh -i ~/.ssh/perdiemify deploy@45.77.120.186"
echo "2. Clone repo: cd /opt/perdiemify && git clone <repo-url> ."
echo "3. Copy .env file to /opt/perdiemify/.env"
echo "4. Run: docker compose -f infra/docker-compose.prod.yml up -d"
