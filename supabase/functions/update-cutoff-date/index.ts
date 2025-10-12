import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting automatic cutoff date update...');

    // Call the database function to update cutoff date
    const { error: updateError } = await supabase.rpc('auto_update_cutoff_date');

    if (updateError) {
      console.error('Error updating cutoff date:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: updateError.message }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Fetch the new cutoff date to confirm
    const { data: settingData, error: fetchError } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'entry_cutoff_date')
      .single();

    if (fetchError) {
      console.error('Error fetching updated cutoff:', fetchError);
    }

    const newCutoffDate = settingData?.setting_value;
    console.log('Cutoff date successfully updated to:', newCutoffDate);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Cutoff date updated successfully',
        new_cutoff_date: newCutoffDate
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Unexpected error in update-cutoff-date function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
