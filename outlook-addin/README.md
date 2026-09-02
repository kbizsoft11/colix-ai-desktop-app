# ColixAI Outlook add-in

Upload this folder to:

`https://extensions.kbizsoft.com/colix-ai-desktop-app/`

Before uploading:

1. Upload `manifest.xml`, `taskpane.html`, `taskpane.js`, `styles.css`, `commands.html`, and `improve-email.php`.
2. Add the icon files referenced by the manifest: `icon-16.png`, `icon-32.png`, `icon-64.png`, `icon-80.png`, and `icon-128.png`.
3. Configure the Qwen key as the server environment variable `QWEN_API_KEY`, or replace the placeholder in `improve-email.php`.
4. Confirm PHP cURL is enabled on the hosting account.
5. Sideload `manifest.xml` in Outlook and open a compose window. The ColixAI button appears on the Outlook ribbon and opens the task pane.

The API key must not be placed in `taskpane.js` or `manifest.xml`.
