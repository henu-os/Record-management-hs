const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1700,
    height: 1200,
    show: false,
    webPreferences: {
      webSecurity: false
    }
  });

  await win.loadURL('http://localhost:5174/share_cert_preview.html');
  await new Promise(r => setTimeout(r, 2500));

  const image = await win.webContents.capturePage();
  fs.writeFileSync('g:/Astro/scratch/browser_preview_template1.png', image.toPNG());
  console.log('Saved browser_preview_template1.png via Electron script');
  app.quit();
});
