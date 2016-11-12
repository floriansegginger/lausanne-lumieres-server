#!/bin/sh
while true; do 
cd /home/ubuntu/lausanne-lumieres-server
node /home/ubuntu/lausanne-lumieres-server/app.js 2>&1 >> /var/log/pmw.log  
sleep 1
done
