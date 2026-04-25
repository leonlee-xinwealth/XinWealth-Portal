import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load environment variables
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables. Check your .env.local file.');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function backfillAuthUsers() {
  console.log('Starting backfill for auth.users...');

  // 1. Fetch all clients
  const { data: clients, error: clientsError } = await supabaseAdmin
    .from('clients')
    .select('id, email, user_id');

  if (clientsError) {
    console.error('Error fetching clients:', clientsError);
    return;
  }

  console.log(`Found ${clients.length} clients to process.`);

  let successCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const client of clients) {
    if (!client.email) {
      console.log(`Skipping client ${client.id} - No email found.`);
      skippedCount++;
      continue;
    }

    if (client.user_id) {
      console.log(`Skipping client ${client.email} - Already linked to auth user ${client.user_id}.`);
      skippedCount++;
      continue;
    }

    try {
      console.log(`Processing ${client.email}...`);
      
      // 2. Create user in auth.users
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: client.email,
        email_confirm: true,
      });

      if (authError) {
        // If user already exists in auth.users but not linked, try to fetch them
        if (authError.message.includes('already been registered')) {
          const { data: existingAuth } = await supabaseAdmin.auth.admin.listUsers();
          const existingUser = existingAuth?.users.find(u => u.email === client.email);
          
          if (existingUser) {
            console.log(`User ${client.email} already exists in auth. Linking to client...`);
            const { error: updateError } = await supabaseAdmin
              .from('clients')
              .update({ user_id: existingUser.id })
              .eq('id', client.id);
              
            if (updateError) throw updateError;
            successCount++;
            continue;
          }
        }
        throw authError;
      }

      const userId = authData.user.id;

      // 3. Link user_id to client record
      const { error: updateError } = await supabaseAdmin
        .from('clients')
        .update({ user_id: userId })
        .eq('id', client.id);

      if (updateError) {
        throw updateError;
      }

      // 4. Generate recovery link for user to set password
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: client.email,
      });

      if (linkError) {
        console.error(`Warning: Failed to generate recovery link for ${client.email}:`, linkError);
      } else {
        console.log(`Success! Recovery link for ${client.email}: ${linkData.properties.action_link}`);
      }

      successCount++;
    } catch (err) {
      console.error(`Error processing ${client.email}:`, err.message);
      errorCount++;
    }
  }

  console.log('\nBackfill Complete!');
  console.log(`Successfully processed: ${successCount}`);
  console.log(`Skipped: ${skippedCount}`);
  console.log(`Errors: ${errorCount}`);
}

backfillAuthUsers();