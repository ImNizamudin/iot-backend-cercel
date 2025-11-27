const mqtt = require('mqtt');
const { saveSensorData, saveServoCommand } = require('./database');

class MqttHandler {
  constructor() {
    this.mqttClient = null;
    this.host = process.env.MQTT_BROKER || 'mqtt://broker.hivemq.com';
    this.port = process.env.MQTT_PORT || 1883;
    this.isConnected = false;
  }

  connect() {
    if (this.isConnected) {
      console.log('ℹ️ MQTT already connected');
      return;
    }

    console.log(`🔗 Connecting to MQTT: ${this.host}:${this.port}`);
    
    this.mqttClient = mqtt.connect(this.host, { 
      port: this.port,
      reconnectPeriod: 5000,
      connectTimeout: 10000
    });

    this.mqttClient.on('error', (err) => {
      console.log('❌ MQTT error:', err.message);
      this.isConnected = false;
    });

    this.mqttClient.on('connect', () => {
      this.isConnected = true;
      console.log('✅ MQTT connected to broker:', this.host);
      
      // ⚠️ HANYA SUBSCRIBE UNTUK MENERIMA DATA SENSOR DARI RASPI
      this.mqttClient.subscribe('sensor/+/data', (err) => {
        if (!err) console.log('📡 Subscribed to sensor/+/data');
      });
      
      // TIDAK PERLU subscribe ke servo/status dan water/status
      // Karena Raspi yang akan subscribe untuk menerima commands
    });

    this.mqttClient.on('disconnect', () => {
      this.isConnected = false;
      console.log('🔄 MQTT disconnected');
    });

    this.mqttClient.on('offline', () => {
      this.isConnected = false;
      console.log('🔴 MQTT offline');
    });

    // Handle incoming messages HANYA dari Raspi
    this.mqttClient.on('message', async (topic, message) => {
      console.log('📨 MQTT received:', topic);
      
      try {
        const data = JSON.parse(message.toString());
        
        // ⚠️ HANYA handle sensor data dari Raspi
        if (topic.startsWith('sensor/') && topic.endsWith('/data')) {
          await this.handleSensorData(data);
        }
        // HAPUS handler untuk servo/status dan water/status
      } catch (error) {
        console.error('❌ Error processing MQTT message:', error);
      }
    });
  }

  async handleSensorData(data) {
    try {
      const sensorData = {
        device_id: data.device_id,
        temperature: data.temperature,
        humidity: data.humidity,
        pressure: data.pressure,
        servo_state: data.servo_state || 0,
        water_state: data.water_state || false
      };
      
      await saveSensorData(sensorData);
      console.log('💾 Sensor data processed:', sensorData.device_id);
    } catch (error) {
      console.error('❌ Error saving sensor data:', error);
    }
  }

  // ⚠️ TAMBAHKAN METHOD UNTUK PUBLISH COMMAND KE RASPI
  publishServoCommand(deviceId, angle, commandBy = 'web_user') {
    if (!this.isConnected) {
      console.error('❌ MQTT not connected, cannot publish');
      return;
    }
    
    const topic = `control/${deviceId}/servo`;
    const command = {
      device_id: deviceId,
      angle: parseInt(angle),
      command_by: commandBy,
      timestamp: new Date().toISOString()
    };
    
    this.mqttClient.publish(topic, JSON.stringify(command));
    console.log(`🎯 Servo command published to Raspi: ${deviceId} -> ${angle}°`);
  }

  publishWaterCommand(deviceId, state, commandBy = 'web_user') {
    if (!this.isConnected) {
      console.error('❌ MQTT not connected, cannot publish');
      return;
    }
    
    const topic = `control/${deviceId}/water`;
    const command = {
      device_id: deviceId,
      state: Boolean(state),
      command_by: commandBy,
      timestamp: new Date().toISOString()
    };
    
    this.mqttClient.publish(topic, JSON.stringify(command));
    console.log(`💧 Water command published to Raspi: ${deviceId} -> ${state}`);
  }

  // Check connection status
  getStatus() {
    return {
      isConnected: this.isConnected,
      broker: this.host,
      port: this.port
    };
  }
}

module.exports = MqttHandler;