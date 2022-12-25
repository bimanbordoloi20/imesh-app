const { app, BrowserWindow } = require('electron');
const pie = require("puppeteer-in-electron")
const puppeteer = require("puppeteer-core");
const express = require("express");
const axios = require('axios')
var cors = require('cors');
const express_app = express();
express_app.use(cors())

const path = require('path');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

let url = "https://nielsr-dpt-depth-estimation.hf.space/"
let mainWindow = undefined;
let browser = undefined;

const add_event_listener = async (brow, wind) => {
  let page = await pie.getPage(brow, wind);
  await page.evaluate(async () => {
    Array.from(document.getElementsByClassName("hidden-upload hidden"))[0].addEventListener('input', async () => {
      await fetch("http://localhost:7577/get_image")
    })
  })
}

const createWindow = async () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });


  mainWindow.setAlwaysOnTop(true);
  mainWindow.hide()
  // and load the index.html of the app.
  await mainWindow.loadURL(url)
  await axios.get("http://localhost:7577/ready")
  await add_event_listener(browser, mainWindow)

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

const startPie = async () => {
  await pie.initialize(app);
  browser = await pie.connect(app, puppeteer);
}

const start = async () => {
  await startPie()

  // Start express server
  express_app.get('/select_image', async (req, res) => {
    let page = await pie.getPage(browser, mainWindow);
    await page.evaluate(async () => {
      Array.from(document.getElementsByClassName("panel-button")).map(btn => {
        if (btn.innerText == "Clear") {
          btn.click()
        }
      })
    })
    await add_event_listener(browser, mainWindow)
    page = await pie.getPage(browser, mainWindow);
    await page.evaluate(async () => {
      await Array.from(document.getElementsByClassName("upload"))[0].click()
    })
    mainWindow.focus()
    res.sendStatus(200)
  })

  express_app.get('/get_image', async (req, res) => {
    console.log("getting image...");
    let p = await pie.getPage(browser, mainWindow);
    let img_data = await p.evaluate(async () => {
      img = document.getElementsByClassName("input-image").item(0).getElementsByClassName("w-full h-full object-contain").item(0)
      return img.src;
    })

    res.send({ img_data: img_data })
  })

  express_app.get('/submit', async (req, res) => {
    let p = await pie.getPage(browser, mainWindow);
    await p.evaluate(async () => {
      document.getElementsByClassName("panel-button submit").item(0).click()
    })
    res.sendStatus(200);
  })

  express_app.get('/progress', async (req, res) => {
    let p = await pie.getPage(browser, mainWindow);
    let data = await p.evaluate(async () => {
      progress_data = {}
      let timer = document.getElementsByClassName("timer").item(0)
      if (timer == null) {
        timer = document.getElementsByClassName("duration").item(0)
        progress_data['duration'] = timer.innerText
        return progress_data
      }
      progress_data['timer'] = timer.innerText
      console.log(progress_data);
      return progress_data
    });
    res.send(data)
  })

  express_app.get('/get_depth_image', async (req, res) => {
    console.log("getting image...");
    let p = await pie.getPage(browser, mainWindow);
    let img_data = await p.evaluate(async () => {
      img = document.getElementsByClassName("output-image").item(0).getElementsByClassName("w-full h-full object-contain").item(0)
      return img.src;
    })
    res.send({ img_data: img_data })
  })
  express_app.get('/reload', async (req, res) => {
    await mainWindow.loadURL(url)
    await axios.get("http://localhost:7577/ready")
    await add_event_listener(browser, mainWindow)
    res.sendStatus(200)
  })
  express_app.get('/close', async (req, res) => {
    console.log("Closing imesh app...");
    mainWindow.close()
    res.sendStatus(200)
  })

  express_app.get('/dpt', async (req, res) => {
    console.log("Getting DPT Depth...");
    await mainWindow.loadURL(url)
    await axios.get("http://localhost:7577/ready")
    await add_event_listener(browser, mainWindow)
    res.sendStatus(200)
  })

  express_app.get('/midas', async (req, res) => {
    console.log("Getting MiDas...");
    await mainWindow.loadURL("https://pytorch-midas.hf.space/")
    await axios.get("http://localhost:7577/ready")
    await add_event_listener(browser, mainWindow)
    res.sendStatus(200)
  })

  express_app.listen(7576)
  await createWindow()
}

start()






// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
  app.on('second-instance', async (event, commandLine, workingDirectory, additionalData) => {
    console.log("Second instance requested");
    await mainWindow.reload()
    await axios.get("http://localhost:7577/ready")
    await add_event_listener(browser, mainWindow)
  })
}
// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
