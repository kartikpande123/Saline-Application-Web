const axios = require("axios");

const FIREBASE_HOST =
  "https://saline-level-monitoring-server-default-rtdb.firebaseio.com";
const FIREBASE_AUTH = "63XsfziiFUKSfiv7HccwGizwRimnjmspbDldBEFv";

const initialData = {
  patient1: null,
  patient2:{level: 500.0, connected: true } ,
  patient3: null,
  patient4: null,
};

function pushInitialData() {
  axios
    .put(
      `${FIREBASE_HOST}/salineMonitor.json?auth=${FIREBASE_AUTH}`,
      initialData
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
      .get(`${FIREBASE_HOST}/salineMonitor.json?auth=${FIREBASE_AUTH}`)
      .then((response) => {
        const data = response.data;
        if (data) {
          Object.keys(data).forEach((key) => {
            let newLevel = data[key].level - Math.random() * 50; // Decrease by a random amount up to 5 ml
            if (newLevel < 0) newLevel = 0;
            axios
              .patch(
                `${FIREBASE_HOST}/salineMonitor/${key}.json?auth=${FIREBASE_AUTH}`,
                { level: newLevel.toFixed(1) }
              )
              .then((response) => {
                console.log(`Updated level for ${key}: ${newLevel.toFixed(1)}`);
              })
              .catch((error) => {
                console.log(`Error updating level for ${key}:`, error);
              });
          });
        }
      })
      .catch((error) => {
        console.log("Error fetching data:", error);
      });
  }, 10000); // Update every 10 seconds
}

pushInitialData();
