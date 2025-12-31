# Domain MX Record Monitor

A Google Apps Script that monitors MX records for your domains and sends alerts via Google Chat webhook when changes are detected.

## Features

- 🔍 Monitors multiple domains for MX record changes
- 🔔 Real-time notifications via Google Chat webhook
- 📊 Tracks MX record history in Google Sheets
- ⏰ Automatic monitoring with configurable check intervals
- 🛡️ Uses Google's DNS API for reliable lookups

## Prerequisites

- Google account with access to Google Sheets
- Google Chat space with webhook capability (or Slack as alternative)
- Domains you want to monitor

## Installation

1. **Create a new Google Sheets spreadsheet**
   - Go to [Google Sheets](https://sheets.google.com)
   - Create a new blank spreadsheet
   - Name it something like "MX Record Monitor"

2. **Open the Apps Script editor**
   - In your spreadsheet, click **Extensions** → **Apps Script**
   - Delete any default code in the editor

3. **Add the script**
   - Copy the entire script from `Code.gs` in this repository
   - Paste it into the Apps Script editor
   - Click the save icon or press `Ctrl+S` (Windows) / `Cmd+S` (Mac)
   - Name the project "MX Record Monitor"

## Configuration

### 1. Configure Your Domains

Edit the `CONFIG` object in the script:
```javascript
domains: [
  'example.com',
  'yourdomain.com',
  'anotherdomain.com'
],
```

Add all domains you want to monitor.

### 2. Set Up Google Chat Webhook

**Create a webhook in Google Chat:**

1. Open Google Chat in your browser
2. Create a new Space or select an existing one
3. Click on the space name at the top
4. Select **Apps & integrations**
5. Click on **Webhooks**
6. Click **Add webhook**
7. Name it "MX Monitor" (or any name you prefer)
8. Click **Save**
9. Copy the webhook URL that appears

**Add the webhook URL to the script:**
```javascript
webhookUrl: 'https://chat.googleapis.com/v1/spaces/XXXXXX/messages?key=YYYYYY&token=ZZZZZZ',
```

### 3. Adjust Check Interval (Optional)

By default, the script checks every 6 hours. To change this:
```javascript
checkIntervalHours: 6, // Change to desired hours (1, 2, 4, 6, 8, 12, 24)
```

## Setup and Activation

### 1. Run the Setup Function

In the Apps Script editor:

1. Select the function dropdown at the top (shows "Select function")
2. Choose `setupTrigger`
3. Click the **Run** button (▶️ icon)

### 2. Authorize the Script

On first run, you'll need to authorize the script:

1. Click **Review permissions**
2. Select your Google account
3. Click **Advanced** → **Go to MX Record Monitor (unsafe)**
4. Click **Allow**

The script needs these permissions to:
- Access your spreadsheet to store MX record history
- Make external HTTP requests to check DNS records and send notifications
- Create time-based triggers for automatic monitoring

### 3. Verify Setup

After running `setupTrigger`:
- Check your Google Sheet - a new tab called "MX_Records" should appear
- You should receive a Google Chat notification with initial MX records
- The script will now run automatically based on your configured interval

## Monitoring Dashboard

The script creates a "MX_Records" sheet with the following columns:

| Domain | MX Records | Last Checked | Last Changed |
|--------|------------|--------------|--------------|
| example.com | 10 mx1.example.com \| 20 mx2.example.com | 2024-01-15 10:30:00 | 2024-01-15 10:30:00 |

## Notification Examples

### MX Records Changed
```
🔔 MX Record Monitor Alert

⚠️ example.com - MX RECORDS CHANGED
  Old: 10 mx1.example.com | 20 mx2.example.com
  New: 10 new-mx1.example.com | 20 new-mx2.example.com
```

### Error Detected
```
🔔 MX Record Monitor Alert

❌ example.com - ERROR
  Failed to fetch MX records: DNS query failed
```

### Initial Setup
```
🔔 MX Record Monitor Alert

✅ example.com - Initial monitoring setup
  Records: 10 mx1.example.com | 20 mx2.example.com
```

## Testing

To manually test the monitoring:

1. In the Apps Script editor, select the `testMXCheck` function
2. Click **Run** (▶️ icon)
3. Check the **Execution log** (View → Logs) for results
4. Verify you receive a notification if this is the first run

## Using Slack Instead of Google Chat

To use Slack webhooks instead:

1. Create a Slack incoming webhook in your workspace
2. Replace the `sendNotification` function with:
```javascript
function sendNotification(results) {
  if (!CONFIG.webhookUrl || CONFIG.webhookUrl === 'YOUR_WEBHOOK_URL_HERE') {
    Logger.log('WARNING: Webhook URL not configured');
    return;
  }
  
  let message = ':bell: *MX Record Monitor Alert*\n\n';
  
  results.forEach(result => {
    if (result.status === 'changed') {
      message += `:warning: *${result.domain}* - MX RECORDS CHANGED\n`;
      message += `  Old: ${result.oldRecords}\n`;
      message += `  New: ${result.newRecords}\n\n`;
    } else if (result.status === 'error') {
      message += `:x: *${result.domain}* - ERROR\n`;
      message += `  ${result.error}\n\n`;
    } else if (result.status === 'initial') {
      message += `:white_check_mark: *${result.domain}* - Initial monitoring setup\n`;
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
```

## Managing Triggers

### View Active Triggers
1. In Apps Script editor, click the **clock icon** (Triggers) in the left sidebar
2. You'll see all active triggers for this project

### Disable Monitoring
1. Go to Triggers
2. Click the three dots next to the `checkMXRecords` trigger
3. Select **Delete trigger**

### Re-enable Monitoring
Run the `setupTrigger` function again

## Troubleshooting

### No notifications received
- Verify webhook URL is correct in the `CONFIG` object
- Check the Execution log (View → Executions) for errors
- Ensure the Google Chat space allows webhooks
- Run `testMXCheck` manually to see error messages

### "Authorization required" errors
- Re-run the authorization process
- Make sure you clicked "Allow" for all permissions

### MX records not updating
- Check that domains are spelled correctly
- Verify domains have MX records (use `nslookup -type=mx yourdomain.com`)
- Check Execution log for DNS query errors

### Script not running automatically
- Go to Triggers and verify a trigger exists for `checkMXRecords`
- Check execution history for any failures
- Re-run `setupTrigger` to recreate the trigger

## How It Works

1. **DNS Lookup**: Uses Google's public DNS API (`dns.google`) to query MX records
2. **Storage**: Stores current MX records in a Google Sheet
3. **Comparison**: Compares new results with stored records
4. **Notification**: Sends webhook notification when changes detected
5. **Scheduling**: Time-based trigger runs the check automatically

## Privacy & Security

- All data is stored in your personal Google Sheet
- DNS queries use Google's public DNS API
- Webhook notifications are sent only to your configured endpoint
- No third-party services have access to your data

## License

MIT License - Feel free to use and modify as needed

## Contributing

Issues and pull requests are welcome! Please feel free to submit improvements or report bugs.

## Support

For issues or questions:
1. Check the Troubleshooting section above
2. Review the Execution log in Apps Script
3. Open an issue on GitHub with error details

---

**Note**: This script is provided as-is. Always test thoroughly before relying on it for critical monitoring.
