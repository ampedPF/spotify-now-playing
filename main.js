console.log("start of main.js");

const actions = {
  current: "current",
  previous: "previous",
};

var config = "";
var chatCommandsEnabled = false;
let messageCurrent, messagePrevious, messageError;
let client_id, client_secret, access_token, refresh_token;
let account_id, jwt_token;
var expires_at = 0;
var now = 0;

var track = {
  name: "",
  artists: [],
  album: {
    name: "",
    cover: ""
  },
  progress_ms: 0,
  duration_ms: 0,
  url: ""
};

var previous = {
  name: "",
  artists: [],
  album: {
    name: "",
    cover: ""
  },
  url: ""
};
var spotifyApi;
var updateRefreshRate;
var scrollingDelay;
var maxLength = {
  title: 0,
  artists: 0,
  album: 0,
  previous: 0
}

let el_container, el_artists, el_album, el_track, el_previous, el_cover, el_progress_text, el_progress_bar, el_duration;

function refreshInfo() {
  now = Date.now();
  if(now > expires_at) {
    refreshToken();
  } else {
    fetchInfo();
  }
}

function fetchInfo() {
  // set it in the wrapper
  //console.log("fetching info...");
  spotifyApi.setAccessToken(access_token);
  spotifyApi.getMyCurrentPlayingTrack()
  .then(function(data) {
    if (data) {
        if (data.is_playing) {
            el_container.classList.remove("animateOut");
            if (animateQueueEnabled) {
              el_container.classList.add("animateQueue");
            } else {
              el_container.classList.add("animateIn");
              el_container.style.opacity = 1;
            }
            widgetVisible = true;
            // console.log('data', data);
            let temp_artists = parseArtists(data.item.artists);
            if ( track.artists != temp_artists
              || track.album.name != data.item.album.name
              || track.name != data.item.name) {
              previous = { ...track };
              track.artists = temp_artists;
              track.album.name = data.item.album.name;
              track.album.cover = data.item.album.images[0].url;
              track.name = data.item.name;
              track.url = data.item.external_urls.spotify;
              track.duration_ms = data.item.duration_ms;
              console.log(track);
              updateInfo();
              el_container.classList.remove("animateQueue");
            }
            track.progress_ms = data.progress_ms;
            updateProgress();
        } else {
            el_container.classList.remove("animateIn");
            if (!animateQueueEnabled) {
              el_container.classList.add("animateOut");
            }
            el_container.style.opacity = 0;
            widgetVisible = false;
        }
    }
    setTimeout(refreshInfo(), updateRefreshRate);
  }, function(err) {
    console.error(err);
  });
}

function updateInfo() {
  animateText(el_track, track.name, maxLength.title);
  animateText(el_artists, track.artists, maxLength.artists);
  animateText(el_album, track.album.name, maxLength.album);
  el_cover.src = track.album.cover + "?t=" + track.name + track.artists;
  el_duration.innerText = msToTime(track.duration_ms);
  if (previous.name.length > 1 && previous.artists.length > 1) {
    animateText(el_previous, previous.name + " - " + previous.artists, maxLength.previous);
  }
}

function animateText(elem, text, maxLength) {
  elem.innerText = text;
  if (text.length > maxLength) {
    setTimeout(() => {
      elem.classList.add("scrolling");
    }, scrollingDelay);
  } else {
    elem.classList.remove("scrolling");
  }
}

function updateProgress() {
  //console.log("progress_ms:", track.progress_ms);
  el_progress_text.innerText = msToTime(track.progress_ms);
  el_progress_bar.style.width = (track.progress_ms / track.duration_ms * 100) + "%";
  //console.log("el_progress_bar.style.width", el_progress_bar.style.width);
}

// https://stackoverflow.com/questions/19700283/how-to-convert-time-in-milliseconds-to-hours-min-sec-format-in-javascript
function msToTime(duration) {
  var seconds = Math.floor((duration / 1000) % 60),
    minutes = Math.floor((duration / (1000 * 60)) % 60),
    hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

  hours = (hours < 10) ? "0" + hours : hours;
  minutes = (minutes < 10) ? "0" + minutes : minutes;
  seconds = (seconds < 10) ? "0" + seconds : seconds;

  let time = "";
  if (hours > 0) {
    time = hours + ":"
  }
  time = minutes + ":" + seconds;

  return time;
}

function refreshToken() {
  console.log("refreshing token...")
  var http = new XMLHttpRequest();
  var url = 'https://accounts.spotify.com/api/token';
  var params = 'grant_type=refresh_token&refresh_token=' + refresh_token;
  http.open('POST', url, true);
  
  //Send the proper header information along with the request
  http.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
  
  var auth_string = 'Basic ' + utf8_to_b64(client_id + ':' + client_secret);
  http.setRequestHeader('Authorization', auth_string);
  
  http.onreadystatechange = function() {//Call a function when the state changes.
    if(http.readyState == 4 && http.status == 200) {
      let res = JSON.parse(http.responseText);
      access_token = res.access_token;
      expires_at = Date.now() + res.expires_in * 1000;
      // console.log("response: ", access_token);
      fetchInfo();
    }
  }
  http.send(params);
}

async function sendTwitchMessage(which, track) {
  console.log("sendTwitchMessage");
  let message = "";
  if (track.name.length > 0 && track.artists.length > 0 && track.album.name.length > 0 && track.url.length > 0) {
    if (which == actions.current) {
      message = messageCurrent;
    } else if (which == actions.previous) {
      message = messagePrevious;
    }
    message = message.replaceAll("\[\[track\]\]", track.name)
    .replaceAll('[[album]]', track.album)
    .replaceAll('[[url]]', track.url)
    .replaceAll('[[artists]]', track.artists);
  } else {
    console.log("error: ", track);
    message = messageError;
  }
  var data = { message: message };
  console.log("message :", data);

  await fetch("https://api.streamelements.com/kappa/v2/bot/" + account_id + "/say", {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
      'Authorization': "Bearer " + jwt_token
    },
    body: JSON.stringify(data)
  })
  .then(response => response.json()) 
  .then(result => { 
    console.log(result)
  })
  .catch(err => {
    console.log(err)
  });
}

function main() {
  el_container = document.getElementById("container"); 
  el_artists = document.getElementById("artist"); 
  el_album = document.getElementById("album");
  el_track = document.getElementById("title");
  el_cover = document.getElementById("cover");
  el_progress_text = document.getElementById("duration-current");
  el_progress_bar = document.getElementById("div-bar");
  el_duration = document.getElementById("duration-total");
  el_previous = document.getElementById("previous");



  $.getScript('https://ampedpf.github.io/spotify-now-playing/utils.js', function () {
    console.log("utils.js loaded successfully.");
  }).fail(function () {
    console.log("An error has occurred while loading utils.js file.");
  }).then(function () {
    $.getScript("https://ampedpf.github.io/spotify-now-playing/spotify-web-api.js", function() {
      console.log("spotify-web-api.js loaded successfully.");
      spotifyApi = new SpotifyWebApi();
      refreshInfo();
    }).fail(function () {
      console.log("An error has occurred while loading spotify-web-api.js file.");
    });
  });
}

/* Loading from streamelements.com */
window.addEventListener('onWidgetLoad', function (obj) {
  console.log("onWidgetLoad");
  const fieldData = obj.detail.fieldData;
  client_id = fieldData.client_id;
  client_secret = fieldData.client_secret;
  access_token = fieldData.access_token;
  refresh_token = fieldData.refresh_token;
  account_id = fieldData.account_id;
  jwt_token = fieldData.jwt_token;
  messageCurrent = fieldData.chatTextCurrent;
  messagePrevious = fieldData.chatTextPrevious;
  messageError = fieldData.chatTextError;
  updateRefreshRate = fieldData.updateRefreshRate;
  maxLength.title = fieldData.maxLength_title;
  maxLength.artists = fieldData.maxLength_artists;
  maxLength.album = fieldData.maxLength_album;
  maxLength.previous = fieldData.maxLength_previous;
  scrollingDelay = fieldData.scrollingDelay;
  chatCommandsEnabled = parseInt(fieldData.chatCommandsEnabled);
  animateQueueEnabled = parseInt(fieldData.animateQueueEnabled);
  if(animateQueueEnabled) {
    let stylesheet, animateIn, animateOut, animateInDuration, animateHoldDuration, animateOutDuration;
    animateIn = fieldData.animateIn;
    animateInDuration = fieldData.animateInDuration;
    animateHoldDuration = fieldData.animateHoldDuration;
    animateOut = fieldData.animateOut;
    animateOutDuration = fieldData.animateOutDuration;
    
    stylesheet = document.styleSheets[0];
    let rule = stylesheet.cssRules[stylesheet.cssRules.length-1];
    
    rule.style.animation =  animateIn + " " + animateInDuration + "s, hold " + animateHoldDuration + "s " + animateInDuration + "s, " + animateOut + " " + animateOutDuration + "s " + (animateHoldDuration + animateInDuration) + "s";
    // console.log("animateQueue :", animateQueue);

    // stylesheet.insertRule(animateQueue, 0);
    console.log("stylesheet :", stylesheet);
  }
  // console.log("chatCommandsEnabled :", chatCommandsEnabled);
  // console.log("messagePrevious :", messagePrevious);
  main();
});

window.addEventListener('onEventReceived', function (obj) {
  let data = obj.detail.event.data;

  if (chatCommandsEnabled && obj.detail.listener == "message") {
    var badge = '';
    let message = data["text"].toLowerCase();
      var command = message.split(" ")[0];
      // var option = message.split(" ")[1];
      
      if (data["badges"][0]["type"]) {
        badge = data["badges"][0]["type"];
      }
      console.log(badge);
      // console.log('{{chatCommand}}');
      if (badge === 'moderator' || badge === 'broadcaster') {
        if (command == "{{chatCommandCurrent}}") {
          console.log(command);
          sendTwitchMessage(actions.current, track);
        } else if (command == "{{chatCommandPrevious}}") {
          console.log(command);
          sendTwitchMessage(actions.previous, previous);
        }
      }
  }
});

/* */

/* Loading from local env */
$(document).ready(function() {
  $.getJSON('./config.json', function (response) {
    // config = response;
    updateRefreshRate = response.updateRefreshRate;
    client_id = response.spotify.client_id;
    client_secret = response.spotify.client_secret;
    access_token = response.spotify.access_token;
    refresh_token = response.spotify.refresh_token;
    account_id = response.streamelements.account_id;
    jwt_token = response.streamelements.jwt_token;
  }).fail(function () {
    console.log("An error has occurred while loading config.json file.");
  }).then(main());
});
/* */