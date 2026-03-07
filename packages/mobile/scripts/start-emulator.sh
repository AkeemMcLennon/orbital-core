#!/usr/bin/env bash
set -euo pipefail

export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export ANDROID_HOME=/root/Android/Sdk
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

AVD_NAME="Pixel_7"
BOOT_TIMEOUT=300

# Clean stale locks from previous runs
rm -f "$HOME/.android/avd/${AVD_NAME}.avd"/*.lock 2>/dev/null

# Kill any existing emulator
if adb devices 2>/dev/null | grep -q "emulator.*device"; then
  echo "Emulator already running."
  adb devices
  exit 0
fi

adb kill-server 2>/dev/null || true

echo "Starting Android emulator (software emulation, cold boot may take ~2 min)..."
emulator -avd "$AVD_NAME" \
  -no-window \
  -no-audio \
  -no-boot-anim \
  -gpu swiftshader_indirect \
  -no-accel \
  -no-snapshot \
  -memory 2048 \
  -no-metrics &

EMULATOR_PID=$!
echo "Emulator PID: $EMULATOR_PID"

echo "Waiting for emulator to boot (timeout: ${BOOT_TIMEOUT}s)..."
elapsed=0
while [ $elapsed -lt $BOOT_TIMEOUT ]; do
  sleep 5
  elapsed=$((elapsed + 5))

  if ! kill -0 "$EMULATOR_PID" 2>/dev/null; then
    echo "ERROR: Emulator process exited unexpectedly."
    exit 1
  fi

  if adb devices 2>/dev/null | grep -q "emulator.*device$"; then
    echo "Emulator booted after ${elapsed}s."
    adb devices
    echo ""
    echo "Ready. Run 'bun run android' from packages/mobile to launch the app."
    exit 0
  fi

  printf "\r  %3ds elapsed..." "$elapsed"
done

echo ""
echo "ERROR: Emulator did not boot within ${BOOT_TIMEOUT}s."
kill "$EMULATOR_PID" 2>/dev/null
exit 1
