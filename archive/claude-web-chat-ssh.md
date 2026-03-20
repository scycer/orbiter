## 🔐 Cloudflare Short-Lived SSH Certs Setup

**📍 Cloudflare Zero Trust Dashboard**

1️⃣ Access → Service Auth → SSH tab

🔹 Generate SSH CA certificate

🔹 Copy the public key output

**📍 On Droplet (via current SSH)**

2️⃣ Save CA public key to server

🔹 `echo '<CA_KEY>' > /etc/ssh/ca.pub`

3️⃣ Edit sshd_config

🔹 Add: `TrustedUserCAKeys /etc/ssh/ca.pub`

🔹 `systemctl restart sshd`

4️⃣ Create principal mapping

🔹 Map CF email → unix user

🔹 `echo '<your@email.com>' > /etc/ssh/authorized_principals`

🔹 Add to sshd_config: `AuthorizedPrincipalsFile /etc/ssh/authorized_principals`

🔹 Restart sshd again

**📍 Cloudflare Dashboard Again**

5️⃣ Access → Applications → your SSH app

🔹 Settings → Policy → ensure email identity rule

6️⃣ Access → Service Auth → SSH

🔹 Set session duration (e.g. 8hrs)

**📍 Client Side (any device)**

7️⃣ Install `cloudflared`

🔹 `cloudflared access ssh` handles cert auto

🔹 Browser popup → authenticate → temp cert issued

🔹 No SSH keys needed anywhere

**⚠️ Before You Do This**

🔹 Keep existing SSH keys as fallback

🔹 Test from 2nd device before removing keys

🔹 Confirm DO Console access works

🔹 Don't disable pubkey auth until verified

Want me to walk through each step live?