// http://192.168.0.5:1400/status
//http://192.168.0.5:1400/status/topology
String.prototype.decodeHTML = function () {
    return this.replace(/&apos;/g, "'")
       .replace(/&quot;/g, '"')
       .replace(/&gt;/g, '>')
       .replace(/&lt;/g, '<')
       .replace(/&amp;/g, '&');
};

// Basic Zone sniffer based on standard IP range. Nothing fancy, just looking for 200 responses from a Sonos specific port and URI (i.e. there's a server there)
var SonosZoneSniff = {
    startTime       : false,
    totalTime       : false,
    count           : 1,
    timeoutLimit    : 100,
    foundZones      : [],
    foundBridges    : [],
    range           : '192.168.0.',
    portPath        : ':1400/status/topology',
    request         : new XMLHttpRequest(),
    callback        : false,
    start : 
        function(callback) {
            this.callback = callback;
            this.startTime = new Date().getTime();
            this.sniff();
    },
    sniff : 
        function() {
            if(this.count > 255) {
                return;   
            }
            var req = this.request, obj = this;
            req.timeout = this.timeoutLimit;
            req.open("GET", "http://" + this.range + (this.count) + this.portPath, true); // async
            req.onerror = req.ontimeout = function(e) { 
                setTimeout(function() { 
                    obj.sniff() }.bind(obj)
                , 10); // Needs timeout to loop
            }
            req.onload = function (e) {
                if(req.readyState === 4 && req.status === 200) {
                    // Found a zone.
                    // Use the topology XML to acquire the remaining zone IPs
                    obj.getZonesFromTopologyXML(req.responseText, obj.foundZones, obj.foundBridges);
                    obj.totalTime = new Date().getTime() - obj.startTime;
                    obj.callback({ target: obj, exectime: obj.totalTime });
                }
            }
            req.send()
            this.count++;
    },
    getZonesFromTopologyXML :
        function(xmlString, zonesArray, bridgesArray) {
            // Wastefull double regex but hey
            var names = xmlString.match(/>([A-Za-z0-9s ]+?)<\/ZonePlayer>/gm),
                locations = xmlString.match(/location='(.+?)'/gm);
            
            // As long as both returned arrays are the same length, let's merge the two
            if(names.length === locations.length) {             
                for(var i = 0; i < names.length; i++) {
                    var loc = {
                        name    : names[i].match(/>(.*?)</)[1],
                        ip      : locations[i].match(/http:\/\/(.*):/)[1]
                    };
                    if(loc.name.indexOf("BRIDGE") > -1) {
                        // Assume it's a bridge   
                        bridgesArray.push(loc);
                    } else {
                        // Otherwise it's a room
                        zonesArray.push(loc);
                    }
                }
            }
    },
    getQualifiedZones :
        function() {
            return(this.foundZones);        
    },
    getQualifiedBridges : 
        function() {
            return(this.foundBridges);
    }
};

// Basic application wrapper (public)
var Sobble = (function () {
    "use strict";
    // Model
    var CONFIG = {
            ZONES : [],
            PROTOCOL : "http://",
            PORT : "1400"
        },
        EVENTS = {
            PLAY        : "play",
            PAUSE       : "pause",
            NEXTTRACK   : "next",
            PLAYSTATE   : "playstate",
            NEXTZONE    : "nextzone",
            MUTE        : "mute",
            UNMUTE      : "unmute",
            ISMUTED     : "ismuted",
            TRACKINFO   : "trackinfo"
        },
        activeSonosZone = false,
        activeSonosZonePosition = 0;

    
    // Private methods
    function track(e) {
        console.log(e);   
    }

    function addZones(zoneArray) {
        CONFIG.ZONES = zoneArray;
    }
    function addZone(obj, zoneName, zoneIp) {
        CONFIG.ZONES.push(
            {
                name: zoneName,
                ip  : zoneIp
            }
        );
    }

    function getZoneByName(name) {
        var zone, i;
        for (i = 0; i < CONFIG.ZONES.length; i++) {
            zone = CONFIG.ZONES[i];
            if (zone.name === name) {
                return (zone);
            }
        }
        return (false);
    }
    
    function getZoneByPosition(position) {
        return (CONFIG.ZONES[position]);
    }
    
    function filterTrackInfoByResponse(response) {
        var info = {};
        if(response.indexOf("dc:title") > -1) {
           info.title = response.match(/<dc:title>(.*?)<\/dc:title>/m)[1];
        }
        if(response.indexOf("dc:creator") > -1) {
           info.creator = response.match(/<dc:creator>(.*?)<\/dc:creator>/m)[1];
        }
        return(info);
    }
    
    function makeSOAPDataObject(eventType, cmdType, uriType, actionType, bodyData) {
        if (!bodyData || bodyData === undefined) {
            bodyData = "<u:" + cmdType + " xmlns:u=\"urn:schemas-upnp-org:service:AVTransport:1\"><InstanceID>0</InstanceID><Speed>1</Speed></u:" + cmdType + ">";
        }
        var bodyText = "<?xml version=\"1.0\" encoding=\"utf-8\"?><s:Envelope xmlns:s=\"http://schemas.xmlsoap.org/soap/envelope/\" s:encodingStyle=\"http://schemas.xmlsoap.org/soap/encoding/\"><s:Body>" + bodyData + "</s:Body></s:Envelope>";

        return (
            {
                type : eventType,
                uri : uriType || "/MediaRenderer/AVTransport/Control",
                action : actionType || "urn:schemas-upnp-org:service:AVTransport:1#" + cmdType,
                body : bodyText
            }
        );
    }
    
    function makeRequestToSonosZone(ip, SOAPData, callback) {

        if (SOAPData === false || SOAPData === undefined) {
            console.log("Invalid SOAP data: " + JSON.stringify(SOAPData));
            return;
        }

        // Format URL for request
        var url = CONFIG.PROTOCOL + ip + ":" + CONFIG.PORT + SOAPData.uri;

        // Execute call
        try {
            var request = new XMLHttpRequest();
            request.open("POST", url, false);
            request.setRequestHeader("SOAPAction", SOAPData.action);
            request.setRequestHeader("Content-Type", "text/xml");
            request.onload = function (e) {
                if (request.readyState === 4) {
                    // 200 - HTTP OK
                    if(request.status === 200) {
                        if(callback) {
                            callback(request, SOAPData);
                        }
                    } else {
                        console.log("Request returned error code " + request.status.toString());
                    }
                }
            }
            // Send!
            request.send( SOAPData.body );
        } catch (error) {
            console.log("Error in XMLHttpRequest: " + error );
        }
    }
    
    function setActiveZone(zone) {
        activeSonosZone = zone;
    }
    
    function setNextZoneInListAsActive() {
        // If at end
        var old = getActiveZone(), i;
        for(i = 0; i < CONFIG.ZONES.length; i++) {
            if (getZoneByPosition(i).name === old.name) {
                if(i === CONFIG.ZONES.length-1) {
                    setActiveZone(getZoneByPosition(0));
                } else {
                    setActiveZone(getZoneByPosition(i+1));
                }
            }
        }
    }
    
    function getActiveZone() {
        return(activeSonosZone);
    }

    function getStateOfSonosZone(zoneObject, callback) {
        var data;
        if(callback === undefined) {
            callback = function(request, SOAPData) {
                data = request.responseText;

                document.getElementsByTagName("body")[0].innerHTML += '<div id="pebble"></div>';
                var el = document.getElementById("pebble");
                console.log(request.responseText);
                el.innerHTML = request.responseText;
        //			var parser  = new DOMParser();
        //			var response = parser.parseFromString(request.responseText, "text/xml");
        //			
        //			data.isPlaying = Sobble.getZoneCurrentTrackData(response);
        //			data.track = Sobble.getZoneCurrentTrackData(response);
            }
        }
        makeRequestToSonosZone(
            zoneObject.ip,
            getSOAPSchema(EVENTS.PLAYSTATE),
            callback
        );

        return(data);
    }


    // Creates Sonos formatting SOAP data subject to event type (public) 
    function getSOAPSchema(eventType) {
        switch (eventType) {
            case EVENTS.PLAY :
                return (makeSOAPDataObject(
                        eventType,
                        "Play"
                    )
                );

            case EVENTS.PAUSE :
                return (makeSOAPDataObject(
                        eventType,
                        "Pause"
                    )
                );

            case EVENTS.NEXTTRACK :
                return (makeSOAPDataObject(
                        eventType,
                        "Next"
                    )
                );

            case EVENTS.PLAYSTATE :
                return (makeSOAPDataObject(
                        eventType,
                        "GetTransportInfo"
                    )

                );

            case EVENTS.MUTE :
                return (makeSOAPDataObject(
                    eventType,
                    1,
                    '/MediaRenderer/RenderingControl/Control',
                    'urn:upnp-org:serviceId:RenderingControl#SetMute',
                    '<u:SetMute xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1"><InstanceID>0</InstanceID><Channel>Master</Channel><DesiredMute>1</DesiredMute></u:SetMute>'
                    )
                );

            case EVENTS.UNMUTE :
                return (makeSOAPDataObject(
                    eventType,
                    0,
                    '/MediaRenderer/RenderingControl/Control',
                    'urn:upnp-org:serviceId:RenderingControl#SetMute',
                    '<u:SetMute xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1"><InstanceID>0</InstanceID><Channel>Master</Channel><DesiredMute>0</DesiredMute></u:SetMute>'
                    )
                );
            case EVENTS.ISMUTED :
                return (makeSOAPDataObject(
                    eventType,
                    0,
                    '/MediaRenderer/RenderingControl/Control',
                    'urn:upnp-org:serviceId:RenderingControl#GetMute',
                    '<u:GetMute xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1"><InstanceID>0</InstanceID><Channel>Master</Channel></u:GetMute>'
                    )
                );
                
            case EVENTS.TRACKINFO :
                return (makeSOAPDataObject(
                    eventType,
                    "GetPositionInfo"
                    )
                );  
        }

        console.log("Invalid Sobble event: " + eventType);
        return (false);

    }
    
    // Public methods
    return {
        init : function (callback) {
            SonosZoneSniff.start(
                function(e) {
                    Sobble.onZonesReady(e);
                    if(callback) callback();
                }
            );
        },
        
        onZonesReady : function(e) {
            console.log(e.target.getQualifiedZones().length + " zones gained in " + e.exectime);
            addZones(e.target.getQualifiedZones());
            setActiveZone(getZoneByPosition(2));
        },
            
        skipTrackOnActiveSonosZone : function() {
            makeRequestToSonosZone(
                getActiveZone().ip, 
                getSOAPSchema(EVENTS.NEXTTRACK), 
                track
            );
        },
            
        togglePlayStateofActiveSonosZone : function() {
            if(Sobble.isActiveSonosZonePlaying()) {
                Sobble.pauseActiveSonosZone();   
            } else {
                Sobble.playActiveSonosZone();
            }
        },
        
        toggleMuteStateofActiveSonosZone : function() {
            if(Sobble.isActiveSonosZoneMuted()) {
                Sobble.unmuteActiveSonosZone();   
            } else {
                Sobble.muteActiveSonosZone();
            }
        },
        
        pauseActiveSonosZone : function() {
            Sobble.pauseZone(getActiveZone());
        },
        
        pauseZone : function(zone) {
            makeRequestToSonosZone(
                zone.ip, 
                getSOAPSchema(EVENTS.PAUSE), 
                track
            );
        },
        
        playActiveSonosZone : function() {
             makeRequestToSonosZone(
                getActiveZone().ip, 
                getSOAPSchema(EVENTS.PLAY), 
                track
            );
        },
        
        unmuteActiveSonosZone : function() {
             makeRequestToSonosZone(
                getActiveZone().ip, 
                getSOAPSchema(EVENTS.UNMUTE), 
                track
            );
        },
        
        muteActiveSonosZone : function() {
             makeRequestToSonosZone(
                getActiveZone().ip, 
                getSOAPSchema(EVENTS.MUTE), 
                track
            );
        },
        
        isActiveSonosZonePlaying : function() {
            var state = false;
            var func = function() {
                getStateOfSonosZone(
                        getActiveZone(),
                        function (request, SOAPData) {
                            state = (request.responseText.indexOf("PLAYING") > -1 || request.responseText.indexOf("TRANSITIONING") > -1);
                        }
                    );
                }
            func();
            return(state);
        },
        
        isActiveSonosZoneMuted : function() {
            var state = false;
            makeRequestToSonosZone(
                getActiveZone().ip, 
                getSOAPSchema(EVENTS.ISMUTED), 
                function(request, SOAPData) {
                    state = (request.responseText.indexOf("<CurrentMute>1") > -1);
                }
            );
            return(state);
        },
        
        pauseAllZones : function() {
            for(var i = 0; i<CONFIG.ZONES.length; i++) {
                Sobble.pauseZone(CONFIG.ZONES[i]);
            }
        },
        
        getActiveZoneName : function() {
            return(getActiveZone().name);  
        },
        
        setNextSonosZoneAsActive : function() {
            setNextZoneInListAsActive();
            return(getActiveZone());
        },
        
        getTrackInfoOnActiveZone : function() {
            var val;
            makeRequestToSonosZone(
                getActiveZone().ip, 
                getSOAPSchema(EVENTS.TRACKINFO), 
                function(request, SOAPData) {
                    val = filterTrackInfoByResponse(                    request.responseText.decodeHTML());
                }
            );
            return(val);
        }
    };
})();

if(simply === undefined) {
    Sobble.init();
} else {
 
    function resetScreen() {
        var sub = Sobble.isActiveSonosZonePlaying() ? "Playing" : "Paused";
        if(sub === "Playing") {
            if(Sobble.isActiveSonosZoneMuted()) {
                sub = "Muted";   
            }
        }
        var obj = {
            title: Sobble.getActiveZoneName(),
            subtitle: sub,
            body: '---\n'
        };
        var track = Sobble.getTrackInfoOnActiveZone();
        if(track && track.title) {
            obj.body = track.title + "\n" + track.creator;
        }
        simply.setText(obj, true);
    }
    
    function poll() {
        resetScreen();   
    }
    
    function setup() {
        simply.on('singleClick', function(e) {
          console.log(util2.format('single clicked $button!', e));
            switch(e.button) {
                case "up" :
                    Sobble.setNextSonosZoneAsActive();
                    break;
                case "select" :
                    Sobble.togglePlayStateofActiveSonosZone();
                    break;
                case "down" :
                    Sobble.skipTrackOnActiveSonosZone();
                    break;
            }
            resetScreen();
        });

        simply.on('longClick', function(e) {
            switch (e.button) {
                case "select" :
                    Sobble.pauseAllZones();  
                    simply.vibe();
                    break;
                case "down" :
                    Sobble.toggleMuteStateofActiveSonosZone();
                    break;
                }
            resetScreen();
            }
        );
    }

    simply.setText({
        title: 'SOBBLE',
        subtitle: 'The Little Sonos Control',
        body: 'Play, pause, skip and more from your Pebble to your Sonos. (BETA release)',
    }, true);
    
    var a;
    Sobble.init(
        function() {
            setup();
            setTimeout(resetScreen, 3000);
            a = setInterval(poll, 5000); // Update screen for changes
        }
    );
    
    simply.scrollable(false);
    simply.fullscreen(true);
    
}