const { createClient } = require('@supabase/supabase-js');

// Handle missing environment variables gracefully
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabase;
let isDatabaseEnabled = false;

if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    isDatabaseEnabled = true;
    console.log('✅ Supabase client initialized');
  } catch (error) {
    console.error('❌ Supabase initialization failed:', error.message);
    isDatabaseEnabled = false;
  }
} else {
  console.warn('⚠️ Supabase credentials missing - running in demo mode');
  isDatabaseEnabled = false;
}

// Mock functions untuk demo mode
const mockSupabase = {
  from: () => ({
    select: () => Promise.resolve({ data: [], error: null }),
    insert: () => Promise.resolve({ data: [{ id: 1 }], error: null }),
    upsert: () => Promise.resolve({ data: [], error: null }),
    update: () => Promise.resolve({ data: [], error: null }),
    delete: () => Promise.resolve({ data: [], error: null })
  }),
  rpc: () => Promise.resolve({ data: [], error: null })
};

// Use mock jika database tidak available
if (!isDatabaseEnabled) {
  supabase = mockSupabase;
}

async function initDatabase() {
  if (!isDatabaseEnabled) {
    console.log('🔄 Running in demo mode - no database connection');
    return;
  }
  
  try {
    console.log('🔄 Checking database connection...');
    
    // Test connection
    const { error } = await supabase
      .from('devices')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('📦 Please create tables in Supabase SQL Editor');
    } else {
      console.log('✅ Database connection successful');
    }
  } catch (error) {
    console.error('❌ Database check failed:', error.message);
  }
}

async function saveSensorData(data) {
  if (!isDatabaseEnabled) {
    console.log('💾 [DEMO] Sensor data would be saved:', data.device_id);
    return { id: Date.now(), ...data };
  }
  
  try {
    const { device_id, temperature, humidity, pressure, servo_state, water_state } = data;
    
    const { data: sensorData, error } = await supabase
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

    if (error) throw error;
    
    // Update device status
    await supabase
      .from('devices')
      .upsert([
        {
          device_id,
          device_name: `Device ${device_id}`,
          last_seen: new Date().toISOString(),
          is_online: true
        }
      ]);

    console.log('💾 Sensor data saved to Supabase:', device_id);
    return sensorData[0];
  } catch (error) {
    console.error('❌ Error saving sensor data:', error.message);
    throw error;
  }
}

// Save servo command
async function saveServoCommand(data) {
  if (!isDatabaseEnabled) {
    console.log('💾 [DEMO] Servo command would be saved:', data.device_id, data.target_angle);
    return { id: Date.now(), ...data };
  }
  
  try {
    const { device_id, target_angle, final_angle, command_by, status } = data;
    
    const { data: commandData, error } = await supabase
      .from('servo_commands')
      .insert([
        {
          device_id,
          target_angle,
          final_angle: final_angle || target_angle,
          command_by: command_by || 'web_api',
          status: status || 'sent'
        }
      ])
      .select();

    if (error) {
      throw new Error(`Servo command error: ${error.message}`);
    }

    console.log('💾 Servo command saved to Supabase:', device_id);
    return commandData[0];
  } catch (error) {
    console.error('❌ Error saving servo command:', error);
    throw error;
  }
}

// Get latest sensor data
async function getLatestSensorData(deviceId = null) {
  if (!isDatabaseEnabled) {
    console.log('📊 [DEMO] Getting latest data');
    return deviceId ? mockSensorData : [mockSensorData];
  }
  
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
  if (!isDatabaseEnabled) {
    console.log('📊 [DEMO] Getting history for:', deviceId);
    return [mockSensorData];
  }
  
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
  if (!isDatabaseEnabled) {
    console.log('📱 [DEMO] Getting devices list');
    return [{ device_id: 'demo_device', device_name: 'Demo Device', is_online: true }];
  }
  
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
  if (!isDatabaseEnabled) {
    console.log('📊 [DEMO] Getting all devices data');
    return [mockSensorData];
  }
  
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

// Mock data untuk demo mode
const mockSensorData = {
  id: 1,
  device_id: 'demo_device',
  temperature: 25.5,
  humidity: 60.0,
  pressure: 1013.25,
  servo_state: 90,
  water_state: true,
  timestamp: new Date().toISOString()
};

module.exports = {
  supabase,
  initDatabase,
  saveSensorData,
  saveServoCommand,
  getLatestSensorData,
  getSensorHistory,
  getDevices,
  getAllDevicesLatestData,
  isDatabaseEnabled
};