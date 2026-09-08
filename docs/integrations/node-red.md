# Node-RED

Import the ready-made MQTT → HTTPS bridge flow:

- Product guide: [thermaltrace.dev/integrations/node-red](https://thermaltrace.dev/integrations/node-red)
- Flow JSON: [thermaltrace.dev/nodered/mqtt-to-thermaltrace.json](https://thermaltrace.dev/nodered/mqtt-to-thermaltrace.json)

## Steps

1. Create a push device and copy the ingest key  
2. Node-RED → Import → paste/upload the JSON  
3. Set `THERMALTRACE_INGEST_KEY`  
4. Point MQTT nodes at Mosquitto; deploy  

Rate limit: ~1 POST/min. Optional garage-door tab included.

ThermalTrace is **not** an MQTT broker. Full MQTT recipe: [MQTT bridge](/integrations/mqtt-bridge).
