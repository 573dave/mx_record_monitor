/**
 * Domain MX Record Monitor
 * Monitors MX records for specified domains and sends alerts via Google Chat webhook
 */

// Configuration
const CONFIG = {
  // Add your domains to monitor
  domains: [
    'example.com',
    'yourdomain.com'
  ],
  
  // Google Chat webhook URL - get this from Google Chat > Spaces > Apps & integrations > Webhooks
  webhookUrl: 'YOUR_GOOGLE_CHAT_WEBHOOK_URL_HERE',
  
  // How often to check (in hours) - script will run via time-based trigger
  checkIntervalHours: 6,
  
  // Sheet name to store MX record history
  sheetName: 'MX_Records'
};

/**
 * Main function to check MX records
 */
function checkMXRecords() {
  const sheet = getOrCreateSheet();
  const results = [];
  
  CONFIG.domains.forEach(domain => {
    try {
      const currentMX = getMXRecords(domain);
      const storedMX = getStoredMXRecords(sheet, domain);
      
      if (storedMX === null) {
        // First time checking this domain
        storeMXRecords(sheet, domain, currentMX);
        results.push({
          domain: domain,
          status: 'initial',
          records: currentMX
        });
      } else if (currentMX !== storedMX) {
        // MX records have changed
        results.push({
          domain: domain,
          status: 'changed',
          oldRecords: storedMX,
          newRecords: currentMX
        });
        storeMXRecords(sheet, domain, currentMX);
      } else {
        // No change
        results.push({
          domain: domain,
          status: 'unchanged',
          records: currentMX
        });
      }
    } catch (error) {
      results.push({
        domain: domain,
        status: 'error',
        error: error.toString()
      });
    }
  });
  
  // Send notifications for changes and errors
  const changesOrErrors = results.filter(r => r.status === 'changed' || r.status === 'error' || r.status === 'initial');
  if (changesOrErrors.length > 0) {
    sendNotification(changesOrErrors);
  }
  
  Logger.log('Check completed: ' + JSON.stringify(results));
}

/**
 * Get MX records for a domain using Google's DNS API
 */
function getMXRecords(domain) {
  const url = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`;
  
  try {
    const response = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
    const data = JSON.parse(response.getContentText());
    
    if (data.Status !== 0) {
      throw new Error(`DNS query failed with status ${data.Status}`);
    }
    
    if (!data.Answer || data.Answer.length === 0) {
      return 'NO_MX_RECORDS';
    }
    
    // Sort by priority and create normalized string
    const mxRecords = data.Answer
      .filter(record => record.type === 15) // MX records are type 15
      .map(record => {
        // MX data format is "priority hostname"
        const parts = record.data.split(' ');
        return {
          priority: parseInt(parts[0]),
          hostname: parts[1].replace(/\.$/, '') // Remove trailing dot
        };
      })
      .sort((a, b) => {
        // Sort by priority first
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        // If same priority, sort alphabetically by hostname for consistency
        return a.hostname.localeCompare(b.hostname);
      })
      .map(mx => `${mx.priority} ${mx.hostname}`)
      .join(' | ');
    
    return mxRecords;
  } catch (error) {
    throw new Error(`Failed to fetch MX records: ${error.message}`);
  }
}

/**
 * Get or create the monitoring sheet
 */
function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.sheetName);
    sheet.appendRow(['Domain', 'MX Records', 'Last Checked', 'Last Changed']);
    sheet.getRange('A1:D1').setFontWeight('bold').setBackground('#4285f4').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
  
  return sheet;
}

/**
 * Get stored MX records for a domain
 */
function getStoredMXRecords(sheet, domain) {
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === domain) {
      return data[i][1];
    }
  }
  
  return null;
}

/**
 * Store MX records for a domain
 */
function storeMXRecords(sheet, domain, mxRecords) {
  const data = sheet.getDataRange().getValues();
  const now = new Date();
  let found = false;
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === domain) {
      sheet.getRange(i + 1, 2).setValue(mxRecords);
      sheet.getRange(i + 1, 3).setValue(now);
      
      // Update last changed date if records actually changed
      if (data[i][1] !== mxRecords) {
        sheet.getRange(i + 1, 4).setValue(now);
      }
      
      found = true;
      break;
    }
  }
  
  if (!found) {
    sheet.appendRow([domain, mxRecords, now, now]);
  }
}

/**
 * Send notification via Google Chat webhook
 */
function sendNotification(results) {
  if (!CONFIG.webhookUrl || CONFIG.webhookUrl === 'YOUR_GOOGLE_CHAT_WEBHOOK_URL_HERE') {
    Logger.log('WARNING: Webhook URL not configured');
    return;
  }
  
  let message = '🔔 *MX Record Monitor Alert*\n\n';
  
  results.forEach(result => {
    if (result.status === 'changed') {
      message += `⚠️ *${result.domain}* - MX RECORDS CHANGED\n`;
      message += `  Old: ${result.oldRecords}\n`;
      message += `  New: ${result.newRecords}\n\n`;
    } else if (result.status === 'error') {
      message += `❌ *${result.domain}* - ERROR\n`;
      message += `  ${result.error}\n\n`;
    } else if (result.status === 'initial') {
      message += `✅ *${result.domain}* - Initial monitoring setup\n`;
      message += `  Records: ${result.records}\n\n`;
    }
  });
  
  const payload = {
    text: message
  };
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(CONFIG.webhookUrl, options);
    Logger.log('Notification sent: ' + response.getContentText());
  } catch (error) {
    Logger.log('Failed to send notification: ' + error.toString());
  }
}

/**
 * Setup time-based trigger to run automatically
 */
function setupTrigger() {
  // Delete existing triggers for this function
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'checkMXRecords') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Create new trigger
  ScriptApp.newTrigger('checkMXRecords')
    .timeBased()
    .everyHours(CONFIG.checkIntervalHours)
    .create();
  
  Logger.log('Trigger created to run every ' + CONFIG.checkIntervalHours + ' hours');
  
  // Run once immediately
  checkMXRecords();
}

/**
 * Manual test function
 */
function testMXCheck() {
  checkMXRecords();
}
