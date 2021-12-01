"use strict";
//CONSTANTS
const favoriteStations = "favoriteStations";
//const url = "https://rata.digitraffic.fi/api/v1/schedules?departure_date="; //url from the assignment
const url1 = "https://rata.digitraffic.fi/api/v1/live-trains/station/"
const url2 = "?minutes_before_departure=300&minutes_after_departure=0&minutes_before_arrival=0&minutes_after_arrival=0&train_categories=Commuter";
const scheduleElement = document.getElementById("schedule");
const mapTable = document.getElementById("map-table");

//LISTENERS
document.addEventListener("DOMContentLoaded", loadFavorites);
mapTable.addEventListener("click", mapClick)

//FUNCTIONS

//fetches and creates a schedule for a given station
function requestStation(station) {
    let xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            let apiList = JSON.parse(this.responseText); //API response list
            let departures = getCommuterDepartures(apiList);
            createSchedule(departures, station);
        }
    };
    xhttp.open("GET", url1 + station + url2, true); //combine the url with the station code
    xhttp.send();
}

//checks which station was clicked on the map
function mapClick(event) {
    const item = event.target;
    if (item.innerText !== "") { //don't send a request if the station name is empty
        if (scheduleElement.children.length < 4) { //don't make a new schedule if 4 are already visible
            requestStation(item.innerText);
        }
    }
}

//loads favorites on page load
function loadFavorites() {
    const storedStations = getLocalStorageTable(favoriteStations);
    for (let i = 0; i < storedStations.length; i++) {
        requestStation(storedStations[i]);
    }
}

//checks which button was clicked on a schedule
function scheduleClick(event) {
    const item = event.target;
    const parent = item.parentElement.parentElement; //go up two levels. button -> title-line -> stationSchedule
    if (item.classList.contains("favorite-button")) {
        favoriteStation(parent);
    } else if (item.classList.contains("delete-button")) {
        deleteStation(parent);
    }
}

//creates the visible schedule 
function createSchedule(departures, station) {
    let stationDepartures = getStationDepartures( departures, station);

    //main schedule item
    let stationSchedule = document.createElement("ul");
    stationSchedule.classList.add("station-schedule");

    //title line of the schedule
    let titleLine = document.createElement("div");
    titleLine.classList.add("title-line");

    //favorite button
    let favoriteButton = document.createElement("button");
    favoriteButton.title = "Favorite station";
    favoriteButton.innerHTML = "<i class='fas fa-heart'></i>";
    favoriteButton.classList.add("favorite-button");
    if (getLocalStorageTable(favoriteStations).includes(station)) { //check if the station is favorited
        favoriteButton.classList.add("favorite");
    }
    titleLine.appendChild(favoriteButton);

    //shortcode (name) of the station
    let stationName = document.createElement("div");
    stationName.innerText = station;
    stationName.classList.add("departure-text");
    titleLine.appendChild(stationName);

    //delete button
    let deleteButton = document.createElement("button");
    deleteButton.title = "Delete station";
    deleteButton.innerHTML = "<i class='fas fa-trash'></i>";
    deleteButton.classList.add("delete-button");
    titleLine.appendChild(deleteButton);

    stationSchedule.appendChild(titleLine);

    //actual schedules
    for (let i = 0; i < stationDepartures.length; i++) {
        let departure = stationDepartures[i];
        let departureItem = document.createElement("li");
        departureItem.classList.add("departure");

        //time of departure
        let departureTime = document.createElement("div");
        departureTime.classList.add("departure-text");
        departureTime.classList.add("departure-time");
        let time = pad(departure.dateTime.getHours()) + ":" + pad(departure.dateTime.getMinutes());
        departureTime.innerText = time;
        departureItem.appendChild(departureTime);

        //track of departure
        let departureTrack = document.createElement("div");
        departureTrack.classList.add("departure-text");
        departureTrack.innerText = departure.commercialTrack;
        departureItem.appendChild(departureTrack);

        //id (letter) of the departure
        let departureID = document.createElement("div");
        departureID.classList.add("departure-text");
        departureID.classList.add("departure-id");
        departureID.innerText = departure.commuterLineID;
        departureItem.appendChild(departureID);

        //last stop of the train. Airport trains always show HKI as the last stop.
        let departureDir = document.createElement("div");
        departureDir.classList.add("departure-text");
        departureDir.innerText = departure.direction;
        departureItem.appendChild(departureDir);



        stationSchedule.appendChild(departureItem);
    }
    stationSchedule.addEventListener("click", scheduleClick); //add an eventListener for clicking the schedule
    scheduleElement.appendChild(stationSchedule);
}

//add a station to favorites. Stored in LocalStorage.
function favoriteStation(schedule) {
    let storedStations = getLocalStorageTable(favoriteStations);
    let station = schedule.children[0].children[1].innerText;
    let heart = schedule.children[0].children[0];
    heart.classList.toggle("favorite");
    if (storedStations.includes(station)) {
        storedStations.splice(storedStations.indexOf(station), 1);
    } else {
        storedStations.push(station);
    }
    saveToLocalStorage(favoriteStations, storedStations);
}

//delete a station from view.
function deleteStation(schedule) {
    schedule.classList.add("removing");
    schedule.addEventListener("transitionend", function () {
        schedule.remove();
    })
}

//mostly irrelevant now; remnant of using the original API request url. Still parses departure times and limits view to 10 trains. 
function getStationDepartures(departures, station) {
    let stationDepartures = [];
    let currentDate = new Date();
    for (let d in departures) {
        if (departures[d].stationShortCode === station) {
            let departure = departures[d];
            departure.dateTime = parseDateTime(departure);
            if (departure.dateTime > currentDate) {
                stationDepartures.push(departure);
            }
        }
    }
    stationDepartures.sort((date1, date2) => date1.dateTime - date2.dateTime);
    stationDepartures = stationDepartures.slice(0, 10);
    return stationDepartures;
}

//mostly irrelevant now; remnant of using the original API request url. Still combines train info with departure info.
function getCommuterDepartures(fullList) {
    let departures = [];
    for (let t in fullList) {
        let train = fullList[t];
        let lastStop = train.timeTableRows[train.timeTableRows.length - 1];
        for (let d in train.timeTableRows) {
            let departure = train.timeTableRows[d];
            if (departure.type === "DEPARTURE") {
                departure.commuterLineID = train.commuterLineID;
                departure.cancelled = train.cancelled;
                departure.direction = lastStop.stationShortCode;
                departureCleanup(departure);
                departures.push(departure);
            }
        }
    }
    return departures;
}

//parses time info from plaintext ISO 8601
function parseDateTime(departure) {
    let scheduledTime = departure.scheduledTime;
    let dateTime = new Date();

    //specific character indexes for years, months, days etc etc
    let years = scheduledTime.slice(0, 4);
    let months = scheduledTime.slice(5, 7) - 1;
    let days = scheduledTime.slice(8, 10);
    let hours = scheduledTime.slice(11, 13)
    let minutes = scheduledTime.slice(14, 16);
    let seconds = scheduledTime.slice(17, 19);

    dateTime.setFullYear(years, months, days);
    dateTime.setHours(hours, minutes, seconds);
    dateTime.setHours(dateTime.getHours() + 2); //adds the timezone difference.
    return dateTime;
}

//removes some unused data from departures. Not necessary for functionality.
function departureCleanup(departure) {
    delete departure.actualTime;
    //delete departure.causes;
    delete departure.commercialStop;
    delete departure.countryCode;
    delete departure.estimateSource;
    delete departure.liveEstimateTime;
    delete departure.operatorUICCode;
    delete departure.operatorShortCode;
    delete departure.stationUICCode;
    delete departure.trainReady;
    delete departure.trainStopping;
    delete departure.type;
}

//saves data to LocalStorage
function saveToLocalStorage(localStorageName, data) {
    localStorage.setItem(localStorageName, JSON.stringify(data));
}

//get a LocalStorage table
function getLocalStorageTable(localStorageName) {
    let storedList;
    //check if data already exists in storage
    if (localStorage.getItem(localStorageName) === null) {
        storedList = []; //create new if not
    } else {
        storedList = JSON.parse(localStorage.getItem(localStorageName)); //parse from existing
    }
    return storedList;
}

//adds a padding 0 to values under 10
function pad(value) {
    if (value < 10) {
        return '0' + value;
    } else {
        return value;
    }
}