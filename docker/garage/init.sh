#!/bin/sh
set -eu

CONFIG_FILE="/etc/garage.toml"
BUCKET_NAME="seniornett-media"
KEY_NAME="seniornett-media-app"
ACCESS_KEY_ID="GK5173a1b2c3d4e5f6a7b8c9da"
SECRET_ACCESS_KEY="8d5a5a0b3d8a4b0fbce97e62b4e9d7a6f1b3c2d4e5f60718293a4b5c6d7e8f90"

echo "Waiting for Garage..."
until garage -c "$CONFIG_FILE" status >/tmp/garage-status.txt 2>&1; do
  sleep 2
done

NODE_ID="$(garage -c "$CONFIG_FILE" status 2>/tmp/garage-status.txt | grep -oE '[a-f0-9]{16}' | head -1 || true)"
if [ -n "$NODE_ID" ]; then
  garage -c "$CONFIG_FILE" layout assign -z dc1 -c 1G "$NODE_ID" || true
  garage -c "$CONFIG_FILE" layout apply --version 1 || true
fi

garage -c "$CONFIG_FILE" bucket create "$BUCKET_NAME" || true
garage -c "$CONFIG_FILE" key import --yes "$ACCESS_KEY_ID" "$SECRET_ACCESS_KEY" -n "$KEY_NAME"
garage -c "$CONFIG_FILE" bucket allow --read --write --owner "$BUCKET_NAME" --key "$KEY_NAME"

echo "Garage bootstrap complete."
