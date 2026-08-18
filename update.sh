
#!/bin/bash
cd /www/wwwroot/mitos/Mitos_backend
git fetch --all
git reset --hard origin/main  # Change "main" to your branch if needed
git pull origin main
