const axios = require("axios");

const FIREBASE_HOST = "https://saline-level-monitoring-server-default-rtdb.firebaseio.com";
const FIREBASE_AUTH = "63XsfziiFUKSfiv7HccwGizwRimnjmspbDldBEFv";

const initialMonitoringData = {
  Monitoringdata1: 398.36,
  Monitoringdata2: 575.42,
  Monitoringdata3: 318.52,
  Monitoringdata4: 373.15,
  Monitoringdata5: 441.40,
  Monitoringdata6: 534.28,
  Monitoringdata7: 420.28
};

function pushDemoData() {
  const currentTime = new Date();
  
  const demoData = {
    Monitoringdata: initialMonitoringData,
    START_TIME: {
      Start_time1: currentTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: true}).toUpperCase(),
      Start_time2: currentTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: true}).toUpperCase(),
      Start_time3: currentTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: true}).toUpperCase(),
      Start_time4: currentTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: true}).toUpperCase(),
      Start_time5: currentTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: true}).toUpperCase(),
      Start_time6: currentTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: true}).toUpperCase()
    },
    VEND_TIME: {
      Vend_time1: new Date(currentTime.getTime() + 3600000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: true}).toUpperCase(),
      Vend_time2: new Date(currentTime.getTime() + 4500000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: true}).toUpperCase(),
      Vend_time3: new Date(currentTime.getTime() + 3300000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: true}).toUpperCase(),
      Vend_time4: new Date(currentTime.getTime() + 3900000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: true}).toUpperCase(),
      Vend_time5: new Date(currentTime.getTime() + 4200000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: true}).toUpperCase(),
      Vend_time6: new Date(currentTime.getTime() + 4800000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: true}).toUpperCase()
    },
    PREDICTION_TIME: {
      prediction_time1: new Date(currentTime.getTime() + 7200000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: true}).toUpperCase(),
      prediction_time2: new Date(currentTime.getTime() + 9000000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: true}).toUpperCase(),
      prediction_time3: new Date(currentTime.getTime() + 6600000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: true}).toUpperCase(),
      prediction_time4: new Date(currentTime.getTime() + 7800000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: true}).toUpperCase(),
      prediction_time5: new Date(currentTime.getTime() + 8400000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: true}).toUpperCase(),
      prediction_time6: new Date(currentTime.getTime() + 9600000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: true}).toUpperCase()
    }
  };

  // Update each collection separately
  for (let collection in demoData) {
    axios.put(`${FIREBASE_HOST}/${collection}.json?auth=${FIREBASE_AUTH}`, JSON.stringify(demoData[collection]))
      .then((response) => {
        console.log(`${collection} data written successfully:`, response.data);
      })
      .catch((error) => {
        console.log(`Error writing ${collection} data:`, error);
      });
  }

  // Start the data decrease simulation after pushing the initial data
  simulateDataDecrease();
}

function simulateDataDecrease() {
  setInterval(() => {
    // Decrease Monitoringdata
    axios.get(`${FIREBASE_HOST}/Monitoringdata.json?auth=${FIREBASE_AUTH}`)
      .then((response) => {
        let currentData = response.data;
        let updates = {};
        let percentageUpdates = {};
        for (let key in currentData) {
          if (currentData.hasOwnProperty(key)) {
            let currentValue = currentData[key];
            if (typeof currentValue === "number" && !isNaN(currentValue)) {
              let newValue = currentValue - Math.random() * 50; // Decrease by a random amount up to 50 units
              if (newValue < 0) newValue = 0;
              updates[key] = Number(newValue.toFixed(2));
              
              // Update percentage based on the new Monitoringdata value
              let initialValue = initialMonitoringData[key];
              let adjustedInitialValue = initialValue - 40; // Subtract 40 grams from initial value
              let adjustedNewValue = Math.max(newValue - 40, 0); // Subtract 40 grams from new value, but not less than 0
              let newPercentage = (adjustedNewValue / adjustedInitialValue) * 100;
              if (newPercentage < 0) newPercentage = 0;
              if (newValue <= 40) newPercentage = 0; // Ensure 0% when MonitoringData is 40 or less
              percentageUpdates[key.replace("Monitoringdata", "percentage")] = Number(newPercentage.toFixed(2));
            }
          }
        }
        axios.patch(`${FIREBASE_HOST}/Monitoringdata.json?auth=${FIREBASE_AUTH}`, JSON.stringify(updates))
          .then((response) => {
            console.log("Updated Monitoringdata:", updates);
          })
          .catch((error) => {
            console.log("Error updating Monitoringdata:", error);
          });

        axios.patch(`${FIREBASE_HOST}/PERCENTAGE.json?auth=${FIREBASE_AUTH}`, JSON.stringify(percentageUpdates))
          .then((response) => {
            console.log("Updated percentages:", percentageUpdates);
          })
          .catch((error) => {
            console.log("Error updating percentages:", error);
          });
      })
      .catch((error) => {
        console.log("Error fetching Monitoringdata:", error);
      });
  }, 5000); // Update every 5 seconds
}
pushDemoData();
