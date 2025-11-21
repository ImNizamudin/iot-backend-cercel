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
      reconnectPeriod: 5000, // Auto reconnect every 5s
      connectTimeout: 10000
    });

    // MQTT connection callbacks
    this.mqttClient.on('error', (err) => {
      console.log('❌ MQTT error:', err.message);
      this.isConnected = false;
    });

    this.mqttClient.on('connect', () => {
      this.isConnected = true;
      console.log('✅ MQTT connected to broker:', this.host);
      
      // Subscribe to topics
      this.mqttClient.subscribe('sensor/+/data', (err) => {
        if (!err) console.log('📡 Subscribed to sensor/+/data');
      });
      
      this.mqttClient.subscribe('servo/+/status', (err) => {
        if (!err) console.log('📡 Subscribed to servo/+/status');
      });
      
      this.mqttClient.subscribe('water/+/status', (err) => {
        if (!err) console.log('📡 Subscribed to water/+/status');
      });
    });

    this.mqttClient.on('disconnect', () => {
      this.isConnected = false;
      console.log('🔄 MQTT disconnected');
    });

    this.mqttClient.on('offline', () => {
      this.isConnected = false;
      console.log('🔴 MQTT offline');
    });

    // Handle incoming messages
    this.mqttClient.on('message', async (topic, message) => {
      console.log('📨 MQTT received:', topic);
      
      try {
        const data = JSON.parse(message.toString());
        
        if (topic.startsWith('sensor/') && topic.endsWith('/data')) {
          await this.handleSensorData(data);
        }
        else if (topic.startsWith('servo/') && topic.endsWith('/status')) {
          await this.handleServoStatus(data);
        }
        else if (topic.startsWith('water/') && topic.endsWith('/status')) {
          await this.handleWaterStatus(data);
        }
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

  async handleServoStatus(data) {
    try {
      await saveServoCommand(data);
      console.log('💾 Servo command saved:', data.device_id, data.target_angle);
    } catch (error) {
      console.error('❌ Error saving servo command:', error);
    }
  }

  async handleWaterStatus(data) {
    try {
      console.log('💧 Water status:', data);
      // Handle water status updates jika needed
    } catch (error) {
      console.error('❌ Error handling water status:', error);
    }
  }

  // Publish servo control command
  publishServoCommand(deviceId, angle, commandBy = 'web_user') {
    if (!this.isConnected) {
      console.error('❌ MQTT not connected, cannot publish');
      return;
    }
    
    const topic = `control/${deviceId}/servo`;
    const command = {
      device_id: deviceId,
      target_angle: parseInt(angle),
      command_by: commandBy,
      timestamp: new Date().toISOString()
    };
    
    this.mqttClient.publish(topic, JSON.stringify(command));
    console.log(`🎯 Servo command published: ${deviceId} -> ${angle}°`);
  }

  // Publish water control command
  publishWaterCommand(deviceId, state, commandBy = 'web_user') {
    if (!this.isConnected) {
      console.error('❌ MQTT not connected, cannot publish');
      return;
    }
    
    const topic = `control/${deviceId}/water`;
    const command = {
      device_id: deviceId,
      water_state: Boolean(state),
      command_by: commandBy,
      timestamp: new Date().toISOString()
    };
    
    this.mqttClient.publish(topic, JSON.stringify(command));
    console.log(`💧 Water command published: ${deviceId} -> ${state}`);
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