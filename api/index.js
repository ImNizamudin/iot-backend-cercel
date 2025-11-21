const express = require('express');
const cors = require('cors');
const { 
  initDatabase, 
  getLatestSensorData, 
  getSensorHistory, 
  getDevices,
  getAllDevicesLatestData,
  saveServoCommand 
} = require('../database');
const MqttHandler = require('../mqtt-handler');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Global instances
let mqttHandler = null;

// Initialize application
async function initializeApp() {
  try {
    console.log('🚀 Initializing IoT Backend...');
    
    // Initialize database
    await initDatabase();
    
    // Initialize MQTT
    mqttHandler = new MqttHandler();
    mqttHandler.connect();
    
    console.log('✅ IoT Backend initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize app:', error);
  }
}

// Initialize app when module loads
initializeApp();

// ==================== API ROUTES ====================

// Health check
app.get('/', (req, res) => {
  const mqttStatus = mqttHandler ? mqttHandler.getStatus() : { isConnected: false };
  
  res.json({
    message: '🚀 IoT Backend on Vercel is Running!',
    status: 'active',
    timestamp: new Date().toISOString(),
    mqtt: mqttStatus,
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

// Get latest sensor data
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

// Get sensor history
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
    
    // Validate angle
    const validatedAngle = Math.max(0, Math.min(180, parseInt(angle)));
    
    // Save command to database
    await saveServoCommand({
      device_id,
      target_angle: validatedAngle,
      final_angle: validatedAngle,
      command_by: command_by || 'web_api',
      status: 'sent'
    });
    
    // Publish to MQTT
    if (mqttHandler) {
      mqttHandler.publishServoCommand(device_id, validatedAngle, command_by || 'web_api');
    }
    
    res.json({
      status: 'success',
      message: `Servo command sent to ${device_id}: ${validatedAngle}°`,
      device_id: device_id,
      angle: validatedAngle
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
    
    // Publish to MQTT
    if (mqttHandler) {
      mqttHandler.publishWaterCommand(device_id, state, command_by || 'web_api');
    }
    
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

// Get MQTT status
app.get('/api/mqtt-status', (req, res) => {
  const status = mqttHandler ? mqttHandler.getStatus() : { isConnected: false };
  res.json({ mqtt: status });
});

// Handle 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('❌ Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Export untuk Vercel
module.exports = app;