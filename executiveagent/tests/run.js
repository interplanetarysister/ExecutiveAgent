const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  try {
    const { data: insertData, error: insertError } = await supabase.from('agent_state').insert({ key: 'test_key', value: { hello: 'world' } });
    console.log('Insert result:', insertError ? insertError : insertData);
    const { data: selectData, error: selectError } = await supabase.from('agent_state').select('*').eq('key', 'test_key');
    console.log('Select result:', selectError ? selectError : selectData);
  } catch (e) {
    console.error('Unexpected error:', e);
  }
})();
