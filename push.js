const axios = require("axios");

const FIREBASE_HOST =
  "https://saline-level-monitoring-server-default-rtdb.firebaseio.com";
const FIREBASE_AUTH = "63XsfziiFUKSfiv7HccwGizwRimnjmspbDldBEFv";

// Example initial fake data values
const initialData = {
  Monitoringdata1: 420.0,
  Monitoringdata2: 590.0,
  Monitoringdata3: 350.0,
  Monitoringdata4: 420.0,
  Monitoringdata5: 480.0,
  Monitoringdata6: 550.0,
};

function pushInitialData() {
  axios
    .put(
      `${FIREBASE_HOST}/Monitoringdata.json?auth=${FIREBASE_AUTH}`,
      JSON.stringify(initialData) // Convert initial data to JSON string
    )
    .then((response) => {
      console.log("Initial data written successfully:", response.data);
      simulateSalineDecrease();
    })
    .catch((error) => {
      console.log("Error writing initial data:", error);
    });
}

function simulateSalineDecrease() {
  setInterval(() => {
    axios
      .get(`${FIREBASE_HOST}/Monitoringdata.json?auth=${FIREBASE_AUTH}`)
      .then((response) => {
        let currentData = response.data;
        let updates = {};

        for (let key in currentData) {
          if (currentData.hasOwnProperty(key)) {
            let currentLevel = currentData[key];
            if (typeof currentLevel === "number" && !isNaN(currentLevel)) {
              let newLevel = currentLevel - Math.random() * 50; // Decrease by a random amount up to 50 units
              if (newLevel < 0) newLevel = 0;
              updates[key] = newLevel;
            }
          }
        }

        axios
          .patch(
            `${FIREBASE_HOST}/Monitoringdata.json?auth=${FIREBASE_AUTH}`,
            JSON.stringify(updates) // Convert updates to JSON string
          )
          .then((response) => {
            console.log("Updated levels:", updates);
          })
          .catch((error) => {
            console.log("Error updating levels:", error);
          });
      })
      .catch((error) => {
        console.log("Error fetching data:", error);
      });
  }, 5000); // Update every 5 seconds
}

pushInitialData();
