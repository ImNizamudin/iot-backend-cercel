const { createClient } = require('@supabase/supabase-js');

// Supabase configuration - akan diisi dari environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL or SUPABASE_KEY is missing');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize database tables
async function initDatabase() {
  try {
    console.log('🔄 Checking Supabase database tables...');
    
    // Check if tables exist, if not create them
    const { error: devicesError } = await supabase
      .from('devices')
      .select('*')
      .limit(1);
    
    if (devicesError) {
      console.log('📦 Creating database tables...');
      await createTables();
    }
    
    console.log('✅ Supabase database ready');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
  }
}

async function createTables() {
  // Tables akan dibuat via SQL di Supabase dashboard
  console.log('ℹ️ Please create tables manually in Supabase SQL Editor');
}

// Save sensor data
async function saveSensorData(data) {
  try {
    const { device_id, temperature, humidity, pressure, servo_state, water_state } = data;
    
    // Insert sensor data
    const { data: sensorData, error: sensorError } = await supabase
      .from('sensor_data')
      .insert([
        {
          device_id,
          temperature,
          humidity, 
          pressure,
          servo_state: servo_state || 0,
          water_state: water_state || false
        }
      ])
      .select();

    if (sensorError) {
      throw new Error(`Sensor data error: ${sensorError.message}`);
    }

    // Update or insert device status
    const { error: deviceError } = await supabase
      .from('devices')
      .upsert([
        {
          device_id,
          device_name: `Device ${device_id}`,
          last_seen: new Date().toISOString(),
          is_online: true
        }
      ]);

    if (deviceError) {
      console.error('Device update error:', deviceError);
    }

    console.log('💾 Sensor data saved:', device_id);
    return sensorData[0];
  } catch (error) {
    console.error('❌ Error saving sensor data:', error);
    throw error;
  }
}

// Save servo command
async function saveServoCommand(data) {
  try {
    const { device_id, target_angle, final_angle, command_by, status } = data;
    
    const { data: commandData, error } = await supabase
      .from('servo_commands')
      .insert([
        {
          device_id,
          target_angle,
          final_angle,
          command_by,
          status
        }
      ])
      .select();

    if (error) {
      throw new Error(`Servo command error: ${error.message}`);
    }

    console.log('💾 Servo command saved:', device_id);
    return commandData[0];
  } catch (error) {
    console.error('❌ Error saving servo command:', error);
    throw error;
  }
}

// Get latest sensor data
async function getLatestSensorData(deviceId = null) {
  try {
    let query = supabase
      .from('sensor_data')
      .select('*');

    if (deviceId) {
      query = query.eq('device_id', deviceId);
    }

    const { data, error } = await query
      .order('timestamp', { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(`Get sensor data error: ${error.message}`);
    }

    return deviceId ? data[0] : data;
  } catch (error) {
    console.error('❌ Error getting sensor data:', error);
    throw error;
  }
}

// Get sensor history
async function getSensorHistory(deviceId, limit = 50) {
  try {
    const { data, error } = await supabase
      .from('sensor_data')
      .select('*')
      .eq('device_id', deviceId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Get history error: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('❌ Error getting sensor history:', error);
    throw error;
  }
}

// Get all devices
async function getDevices() {
  try {
    const { data, error } = await supabase
      .from('devices')
      .select('*')
      .order('last_seen', { ascending: false });

    if (error) {
      throw new Error(`Get devices error: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('❌ Error getting devices:', error);
    throw error;
  }
}

// Get latest data from all devices
async function getAllDevicesLatestData() {
  try {
    // Get all latest records for each device
    const { data, error } = await supabase
      .from('sensor_data')
      .select('*')
      .order('timestamp', { ascending: false });

    if (error) {
      throw new Error(`Get all devices data error: ${error.message}`);
    }

    // Group by device_id and get latest for each
    const latestData = {};
    data.forEach(item => {
      if (!latestData[item.device_id] || new Date(item.timestamp) > new Date(latestData[item.device_id].timestamp)) {
        latestData[item.device_id] = item;
      }
    });

    return Object.values(latestData);
  } catch (error) {
    console.error('❌ Error getting all devices data:', error);
    throw error;
  }
}

module.exports = {
  supabase,
  initDatabase,
  saveSensorData,
  saveServoCommand,
  getLatestSensorData,
  getSensorHistory,
  getDevices,
  getAllDevicesLatestData
};