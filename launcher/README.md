# CS2 Clutch Mode - Windows Launcher

This folder contains simple Windows batch scripts to start and stop CS2 Clutch Mode with one click.

## Files

- **`launch-cs2-clutch-mode.bat`** - Starts the app and opens the dashboard in your browser
- **`stop-cs2-clutch-mode.bat`** - Stops the running server
- **`README.md`** - This file

## Quick Start

### First Time Setup

1. Make sure you've run `npm install` in the project root
2. Double-click `launch-cs2-clutch-mode.bat`
3. The dashboard will open automatically at http://127.0.0.1:3001/ui

### Daily Usage

Just double-click `launch-cs2-clutch-mode.bat` to start the app.

### Stopping the Server

You have two options:

1. **Close the server window** - The launcher opens a separate command window titled "CS2 Clutch Mode Server". Just close that window.
2. **Use the stop script** - Double-click `stop-cs2-clutch-mode.bat` to cleanly stop the server.

## Creating a Desktop Shortcut

For even easier access, create a desktop shortcut:

1. Right-click on `launch-cs2-clutch-mode.bat`
2. Select **"Create shortcut"**
3. Drag the shortcut to your Desktop
4. (Optional) Right-click the shortcut → **Properties** → **Change Icon** to customize

You can also pin the shortcut to your taskbar for quick access.

## What the Launcher Does

1. Navigates to the project root directory
2. Checks that `node_modules` exists (reminds you to run `npm install` if not)
3. Starts the Node.js server using `npm run dev` in a separate window
4. **Smart readiness check** - Polls the server health endpoint every second (up to 15 seconds)
5. Opens http://127.0.0.1:3001/ui in your default browser once the server is ready
6. Exits automatically - the server continues running in its own window

The launcher uses a smart readiness check instead of a fixed timeout, so the dashboard opens as soon as the server is ready (usually 2-4 seconds) rather than waiting a fixed amount of time.

## Troubleshooting

### "node_modules not found" error
Run `npm install` in the project root directory first.

### Dashboard doesn't open
The server might need more time to start. Wait a few more seconds and manually open http://127.0.0.1:3001/ui in your browser.

### Port 3001 already in use
Another instance is already running. Use `stop-cs2-clutch-mode.bat` to stop it first, or close the server window manually.

### Server window closes immediately
Check the error message in the window. You may need to:
- Run `npm install`
- Check that your `.env` file is configured correctly
- Ensure Discord is running (if not using mock mode)

## Technical Notes

- These scripts are **thin wrappers** around the existing `npm run dev` command
- They do **not** modify any core application files
- They are designed to be **easily removable** when the app is packaged as a desktop app (Electron)
- The launcher uses standard Windows commands (`start`, `timeout`, `cd`)
- No PowerShell or additional dependencies required

## Removal

To remove the launcher:

1. Delete the entire `/launcher` folder
2. That's it! No other files were modified.

The core application will continue to work normally via `npm run dev`.
