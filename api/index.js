const { isDatabaseEnabled } = require('../database');

app.get('/', (req, res) => {
  const mqttStatus = mqttHandler ? mqttHandler.getStatus() : { isConnected: false };
  
  res.json({
    message: '🚀 IoT Backend on Vercel is Running!',
    status: 'active',
    database: isDatabaseEnabled ? 'Supabase ✅' : 'Demo Mode ⚠️',
    timestamp: new Date().toISOString(),
    mqtt: mqttStatus,
    endpoints: {
      devices: '/api/devices',
      data: '/api/data',
      history: '/api/history/:deviceId',
      control: '/api/control/servo'
    }
  });
});