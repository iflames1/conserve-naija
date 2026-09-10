# Wokwi Conserve machine

Public sim (prebuilt firmware, no Wokwi cloud compile):

[Open in Wokwi viewer](https://wokwi.com/experimental/viewer?diagram=https%3A%2F%2Fraw.githubusercontent.com%2Fiflames1%2Fconserve-naija-wokwi%2Fmain%2Fdiagram.json&firmware=https%3A%2F%2Fraw.githubusercontent.com%2Fiflames1%2Fconserve-naija-wokwi%2Fmain%2Ffirmware.bin)

Give that link about 10–20 seconds on a first visit. Wokwi fetches `diagram.json` and `firmware.bin` from GitHub (a couple of seconds) then boots the ESP32 emulator. The board should show TURN IN PLASTIC shortly after WiFi comes up. This viewer already has a built firmware; it does not wait on Wokwi's cloud compilers.

If the LCD stays on Connecting WiFi for minutes, that is a bug. After a network failure the machine should say NO REPLY or NO WIFI and reset.

Sketch-only Wokwi project (uses their compilers, often queued for a minute or more): [wokwi.com/projects/474695400040446977](https://wokwi.com/projects/474695400040446977)

That firmware talks to `https://conserve-naija-production.up.railway.app`. Assets live in the public repo [iflames1/conserve-naija-wokwi](https://github.com/iflames1/conserve-naija-wokwi). After you change the sketch:

```bash
cd wokwi
pio run
cp .pio/build/esp32dev/firmware.bin /tmp/firmware.bin
# then replace firmware.bin on conserve-naija-wokwi and push
```

This is a real ESP32 project. It speaks the same backend protocol as `cn-simulator`:

```
Authorization: Device <api-key>
POST /iot/devices/me/heartbeat
POST /iot/devices/me/telemetry
POST /iot/devices/me/sessions/claim            { "code": "482731" }
POST /iot/devices/me/sessions/{id}/measurement { "material": "plastic", "weightKg": 2.5 }
```

Seeded demo identity:

| Field | Value |
| --- | --- |
| Machine ID | `CN-MACHINE-001` |
| Collection point | Yaba |
| Device key | `cn-dev-yaba-device-key` |

## API_HOST

Wokwi does not give you an API host. `API_HOST` in the sketch is **your** Conserve Naija backend — the origin of `cn-server`, with no trailing slash.

Check it by opening `/health` on that origin. You want a 200.

**Laptop** (this repo, `cargo run` on port 8080):

```cpp
const char* API_HOST = "http://host.wokwi.internal:8080";
```

That hostname is your computer. In VS Code it works out of the box. On wokwi.com it only works if you enable the Private IoT Gateway (F1 → Enable Private Wokwi IoT Gateway) and have `cn-server` running locally.

**Public project** (anyone on the internet hits Railway):

1. Railway → the **cn-server** service → Settings → Networking → generate a public domain.
2. You get something like `https://cn-server-production.up.railway.app`.
3. Open `https://cn-server-production.up.railway.app/health`.
4. Paste that origin into the sketch on Wokwi (and in `wokwi/sketch.ino` here):

```cpp
const char* API_HOST = "https://cn-server-production.up.railway.app";
```

No path, no `/health`, no trailing slash. The firmware adds `/iot/...` itself.

Until Railway is up, the public sim can still run, but claims and deposits will fail because there is nothing on the internet to talk to.

## VS Code / Cursor

Follow [Wokwi for VS Code](https://docs.wokwi.com/vscode/getting-started):

1. Install the **Wokwi** extension.
2. Get a Wokwi license key (free community license is enough).
3. Open this `wokwi/` folder (or the repo root).
4. Start the Conserve Naija API on port **8080**.
5. Build, then start the simulator.

Wokwi does not compile the sketch. If you hit **Start Simulator** first, you get `firmware.bin not found`:

```bash
cd wokwi
pio run
```

That writes `wokwi/.pio/build/esp32dev/firmware.bin` and `firmware.elf`. Rebuild after you change `sketch.ino`.

## Using the machine

1. In the app, start a recycling mission and copy the 6-digit code.
2. On the keypad, type the digits. **C** cancels. **⏎** submits.
3. After you're in, turn the **SCALE** knob (0–5 kg). The LCD kg reading is the amount you are depositing.
4. Press **WEIGH** (green button under the pad) when the number looks right. It does not auto-submit.
5. The machine posts that weight. The backend credits Green Points. The display shows `DEPOSIT COMPLETE` and resets to idle.

## Protocol-compatible test client

If you cannot run Wokwi in this environment, the host simulator uses the same API:

```bash
cd backend
CLAIM_CODE=482731 MEASURE_KG=2.5 DEVICE_API_KEY=cn-dev-yaba-device-key \
  cargo run -p cn-simulator -- --once
```
