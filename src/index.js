const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
const { exec } = require('child_process');
const os = require('os');
const { error } = require('node:console');

const isMac = os.platform() === "darwin";
const isWindows = os.platform() === "win32";
const isLinux = os.platform() === "linux";

let mainWindow;
let directorySelected;

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 600,
    height: 780,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  //mainWindow.loadURL('http://localhost:3000');
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});


// Handle the directory selection request
ipcMain.handle('dialog:selectDirectory', async () => {
  if (mainWindow) {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const directoryPath = result.filePaths[0];
      directorySelected = result.filePaths[0];
      // Get git branches
      try {
        const fetchResult = await fetchGitBranch(directoryPath);
        console.log('Git fetch result:', fetchResult);
        mainWindow.webContents.send('git-fetch', fetchResult);

        const branches = await getGitBranches(directoryPath);
        console.log('Git branches:', branches);
        mainWindow.webContents.send('git-branches', branches);
      } catch (error) {
        console.error('Failed to get git branches:', error);
        mainWindow.webContents.send('git-branches', []);
      }
      return directoryPath;
    } else {
      directorySelected = null;
      return null;
    }
  }
  return null;
});

ipcMain.handle('git-checkout-and-pull', async (event, branch) => {
  if (mainWindow) {
    try {
      const result = await checkoutAndPull(branch);
      console.log('Git checkout and pull result:', result);
      mainWindow.webContents.send('git-fetch', result);
    } catch (error) {
      console.error('Failed to checkout and pull:', error);
      mainWindow.webContents.send('git-fetch', error.message);
    }
  }
});

ipcMain.handle('build-and-flash', async () => {
  if (mainWindow) {
    try {
      const result = await buildProject(directorySelected);
      console.log('Build and flash result:', result);
      mainWindow.webContents.send('build-result', result);
    } catch (error) {
      console.error('Failed to build and flash:', error);
      mainWindow.webContents.send('build-result', error.message);
    }
  }
});

// Function to get git branches from the selected directory
const getGitBranches = (directoryPath) => {
  return new Promise((resolve, reject) => {
    exec(`cd ${directoryPath} && git branch -r`, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      const branches = stdout.split('\n')
        .map(branch => branch.trim())
        .filter(branch => branch.length > 0);
      resolve(branches);
    });
  });
};

// Function to fetch the git branches and do a git pull
const fetchGitBranch = (directoryPath) => {
  return new Promise((resolve, reject) => {
    exec(`cd ${directoryPath} && git fetch origin && git pull`, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
};

const checkoutAndPull = (branch) => {
  // remove the origin/ prefix
  branch = branch.replace('origin/', '');
  return new Promise((resolve, reject) => {
    exec(`cd ${directorySelected} && git checkout ${branch} && git pull`, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
};


const buildProject = (directoryPath) => {
  // create a function that runs the command get_idf, and launch the command idf.py build inside the project directory
  return new Promise((resolve, reject) => {
    let get_idf;
    let idf_path;
    if (isMac) {
      get_idf = '. $HOME/esp/esp-idf/export.sh';
    } 
    if (isWindows) {
      get_idf = "C:/esp32/idf_cmd_init.bat";
      idf_path = "C:/esp32/frameworks/esp-idf-v5.2.1/tools/idf.py";
      exec(`cd ${directoryPath} && "C:\\esp32\\idf_cmd_init.bat" esp-idf-203e0b45697f0ca2b63cb991f3278863 && idf.py build && idf.py flash`, (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(stdout);
      });
    } else {
      exec(`cd ${directoryPath} && ${get_idf} && idf.py build`, (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(stdout);
      });
    }
  });
};

