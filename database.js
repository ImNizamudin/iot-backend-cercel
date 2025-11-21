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

// ... (functions lainnya tetap sama)

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