SOBBLE
=======
**The Little Sonos Control**
Version 0.1b

## INTRODUCTION
Sobble is an application built for the Pebble watch, allowing Sonos users to control their Sonos Wireless Speakers from their wrist.

### INSTALLATION
Visit ___ for instructions to install the application via your Pebble phone app.

### FEATURES
The primary features of Sobble (as of v0.1b) are:
- Change between each Sonos zone/speaker
- Skip, play, pause, mute and unmute
- Pause all Sonos zones/speakers
- 'Auto-find' Sonos speakers (connected subnet 192.168.0.*)

### BETA LIMITATIONS
- 'Auto-find' is limited to 1-255 standard IP range. It's possible that your Sonos isn't running on this range so Sobble will currently not locate this
- UI is built on the basic SimplyJS views available

### FEATURE PRIORITIES

1. Remove dependancy on SimplyJS
2. Improve and update UI 
3. Add settings to override auto-find
4. Add local storage to cache Sonos settings
5. Add volume control
6. Resolve track naming issues for streamed (radio) services
7. Improve overall error handling (including no network connection, watch-phone connectivity issues)

### SOURCE
All source code is available on GitHub @ https://github.com/owlandgiraffe/Sobble
We're currently developing on the wonderful cloudpebble.net. Feel free to check out our source there. http://small.cat/hen

The application is currently a very basic Javascript app, using SimplyJS for presentation management.

### TESTING
The index.html file is a test frame to execute calls via the browser. In order to do so you must disable allow-origin restrictions. To do this in Google Chome on Mac enter 'open -a Google\ Chrome --args --disable-web-security' in Terminal.

### PROBLEMS
Please log any issues at the link below with a clear description of the problem, including handset type, handset version, Pebble version, Pebble OS, etc.
https://github.com/owlandgiraffe/Sobble/issues

### THANKS
A number of thanks are needed for pulling references during the beta build:
- http://simplyjs.io/
- https://github.com/rahims/SoCo/
- https://github.com/soffes/sonos/

#### AUTHOR
Crafted by Owl & Giraffe <hello@owlandgiraffe.com>
- owlandgiraffe.com
- pauljamescampbell.co.uk

#### NOTICE
This application is an independant development and in no way affiliated with or sponsored by the company Sonos.