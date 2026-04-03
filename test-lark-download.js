import dotenv from 'dotenv';
dotenv.config();

async function test() {
  const appId = process.env.LARK_APP_ID;
  const appSecret = process.env.LARK_APP_SECRET;

  console.log("Fetching token...");
  const tokenRes = await fetch("https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret })
  });
  const tokenData = await tokenRes.json();
  const accessToken = tokenData.tenant_access_token;
  console.log("Token:", accessToken.substring(0, 10) + "...");

  const baseToken = process.env.LARK_BASE_TOKEN;
  const tableClient = process.env.LARK_TABLE_INSURANCE;
  
  const recordsRes = await fetch(`https://open.larksuite.com/open-apis/bitable/v1/apps/${baseToken}/tables/${tableClient}/records?page_size=1`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const recordsData = await recordsRes.json();
  
  let fileToken = null;
  if (recordsData.data && recordsData.data.items) {
    for (const item of recordsData.data.items) {
      if (item.fields['E-policy'] && item.fields['E-policy'][0] && item.fields['E-policy'][0].file_token) {
        fileToken = item.fields['E-policy'][0].file_token;
        break;
      }
    }
  }
  
  if (!fileToken) {
    console.log("No file token found to test.");
    return;
  }
  console.log("Testing with file_token:", fileToken);

  const downloadUrl = `https://open.larksuite.com/open-apis/drive/v1/medias/download?file_token=${encodeURIComponent(fileToken)}`;
  const fileRes = await fetch(downloadUrl, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!fileRes.ok) {
    console.log("Failed. Status:", fileRes.status);
    console.log("Error:", await fileRes.text());
  } else {
    console.log("Success! Headers:", fileRes.headers);
  }
}

test();
