/* global Office */
const API_URL = 'https://extensions.kbizsoft.com/colix-ai-desktop-app/improve-email.php';

const statusElement = document.getElementById('status');
const button = document.getElementById('improve');

function setStatus(message, type = '') {
  statusElement.textContent = message;
  statusElement.className = `status ${type}`;
}

function getAsync(property) {
  return new Promise((resolve, reject) => {
    property.getAsync(result => {
      if (result.status === Office.AsyncResultStatus.Succeeded) resolve(result.value);
      else reject(new Error(result.error?.message || 'Unable to read the draft'));
    });
  });
}

function setAsync(property, value, coercionType) {
  return new Promise((resolve, reject) => {
    property.setAsync(value, coercionType ? { coercionType } : undefined, result => {
      if (result.status === Office.AsyncResultStatus.Succeeded) resolve();
      else reject(new Error(result.error?.message || 'Unable to update the draft'));
    });
  });
}

function getBodyHtml(item) {
  return new Promise((resolve, reject) => {
    item.body.getAsync(Office.CoercionType.Html, result => {
      if (result.status === Office.AsyncResultStatus.Succeeded) resolve(result.value);
      else reject(new Error(result.error?.message || 'Unable to read the email body'));
    });
  });
}

async function improveEmail() {
  button.disabled = true;
  setStatus('Reading your draft…');
  try {
    const item = Office.context.mailbox.item;
    if (!item || !item.subject || !item.body) throw new Error('Open an email draft first.');
    const subject = await getAsync(item.subject);
    const body = await getBodyHtml(item);
    const instruction = document.getElementById('instruction').value.trim();

    setStatus('ColixAI is improving it…');
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, body, instruction })
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || 'The AI request failed.');

    await setAsync(item.subject, data.subject);
    await setAsync(item.body, data.body, Office.CoercionType.Html);
    setStatus('Draft improved successfully.', 'success');
  } catch (error) {
    setStatus(error.message || 'Unable to improve this email.', 'error');
  } finally {
    button.disabled = false;
  }
}

Office.onReady(() => {
  button.addEventListener('click', improveEmail);
});
