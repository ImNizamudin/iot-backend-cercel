const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { 
  initDatabase, 
  getLatestSensorData, 
  getSensorHistory, 
  getDevices,
  getAllDevicesLatestData,
  saveServoCommand 
} = require('./database');
const MqttHandler = require('./mqtt-handler');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize MQTT
const mqttHandler = new MqttHandler();

// ==================== API ROUTES ====================

// Health check
app.get('/', (req, res) => {
  res.json({
    message: '🚀 IoT Backend Server with Supabase is Running!',
    status: 'active',
    database: 'Supabase PostgreSQL',
    timestamp: new Date().toISOString(),
    endpoints: {
      devices: '/api/devices',
      data: '/api/data',
      history: '/api/history/:deviceId',
      control: {
        servo: '/api/control/servo',
        water: '/api/control/water'
      }
    }
  });
});

// Get all devices
app.get('/api/devices', async (req, res) => {
  try {
    const devices = await getDevices();
    res.json({
      devices: devices,
      count: devices.length,
      status: 'success'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get latest sensor data (all devices or specific device)
app.get('/api/data', async (req, res) => {
  try {
    const deviceId = req.query.device_id;
    let data;
    
    if (deviceId) {
      data = await getLatestSensorData(deviceId);
    } else {
      data = await getAllDevicesLatestData();
    }
    
    res.json({
      data: data,
      status: 'success'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get sensor history for specific device
app.get('/api/history/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    
    const history = await getSensorHistory(deviceId, limit);
    res.json({
      device_id: deviceId,
      history: history,
      count: history.length,
      status: 'success'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Control servo
app.post('/api/control/servo', async (req, res) => {
  try {
    const { device_id, angle, command_by } = req.body;
    
    if (!device_id || angle === undefined) {
      return res.status(400).json({ error: 'Device ID and angle are required' });
    }
    
    // Save command to database
    await saveServoCommand({
      device_id,
      target_angle: angle,
      final_angle: angle,
      command_by: command_by || 'web_api',
      status: 'sent'
    });
    
    // Publish to MQTT
    mqttHandler.publishServoCommand(device_id, angle, command_by || 'web_api');
    
    res.json({
      status: 'success',
      message: `Servo command sent to ${device_id}: ${angle}°`,
      device_id: device_id,
      angle: angle
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Control water
app.post('/api/control/water', (req, res) => {
  try {
    const { device_id, state, command_by } = req.body;
    
    if (!device_id || state === undefined) {
      return res.status(400).json({ error: 'Device ID and state are required' });
    }
    
    mqttHandler.publishWaterCommand(device_id, state, command_by || 'web_api');
    
    res.json({
      status: 'success',
      message: `Water command sent to ${device_id}: ${state}`,
      device_id: device_id,
      water_state: state
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== SERVER STARTUP ====================

async function startServer() {
  try {
    // Initialize database
    await initDatabase();
    
    // Start MQTT handler
    mqttHandler.connect();
    
    // Start HTTP server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 API: http://localhost:${PORT}`);
      console.log(`🔄 Database: Supabase`);
      console.log(`📡 MQTT: ${process.env.MQTT_BROKER}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();