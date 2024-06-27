import { initializeApp } from "https://www.gstatic.com/firebasejs/9.18.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.18.0/firebase-analytics.js";
import {
  getDatabase,
  ref,
  onValue,
} from "https://www.gstatic.com/firebasejs/9.18.0/firebase-database.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAOVLTyV5KM0TPxSSa-uSULFnaY6fYPHCU",
  authDomain: "saline-level-monitoring-server.firebaseapp.com",
  databaseURL:
    "https://saline-level-monitoring-server-default-rtdb.firebaseio.com",
  projectId: "saline-level-monitoring-server",
  storageBucket: "saline-level-monitoring-server.appspot.com",
  messagingSenderId: "272472581590",
  appId: "1:272472581590:web:46d587199911f80c467077",
  measurementId: "G-VM2VWVEML6",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const database = getDatabase(app);

const MAX_VALUE = 560; // Define the maximum value for 100%
const BOTTLE_WEIGHT = 30; // Define the bottle weight

// Object to store previous data values and times for each patient
let patientData = {};

// Object to store modal state for each patient
let modalShown = {};

// Queue and flag to handle modal display
let modalQueue = [];
let modalVisible = false;

// Function to fetch data from Firebase in real-time
function fetchDataFromFirebase() {
  const dataRef = ref(database, "/Monitoringdata");

  onValue(
    dataRef,
    (snapshot) => {
      const data = snapshot.val();
      console.log("Data fetched successfully:", JSON.stringify(data, null, 2));
      processSalineData(data);
      updateBlockColors(data);
    },
    (error) => {
      console.error("Error fetching data:", error);
    }
  );
}

// Function to process saline data for all patients
function processSalineData(data) {
  // Explicitly map each Monitoringdata key to a specific patient
  const patientMapping = {
    Monitoringdata1: 1,
    Monitoringdata2: 2,
    Monitoringdata3: 3,
    Monitoringdata4: 4,
    Monitoringdata5: 5,
    Monitoringdata6: 6,
  };

  Object.keys(data).forEach((key) => {
    const patientIndex = patientMapping[key];
    if (patientIndex) {
      const patientDataValue = data[key];
      console.log(
        `Processing data for patient ${patientIndex}: ${patientDataValue}`
      );
      updateUI(patientIndex, patientDataValue);
    }
  });
}

// Function to update the UI based on the fetched data
function updateUI(patientIndex, data) {
  const fillElement = document.getElementById(`fill${patientIndex}`);
  const percentageDisplayElement = document.getElementById(
    `percentage${patientIndex}`
  );
  const containerElement = document.getElementById(`container${patientIndex}`);
  const startTimeElement = document.getElementById(`start${patientIndex}`);
  const endTimeElement = document.getElementById(`end${patientIndex}`);
  const predictionTimeElement = document.getElementById(
    `predictionTime${patientIndex}`
  );
  const connectionStatusElement = document.getElementById(`status${patientIndex}`); // New status element

  if (!patientData[patientIndex]) {
    patientData[patientIndex] = {
      previousData: 0,
      startTime: null,
      endTime: null,
      consumptionRate: 0,
      lastUpdateTime: null,
    };
  }

  if (!modalShown[patientIndex]) {
    modalShown[patientIndex] = false;
  }

  let { previousData, startTime, endTime, consumptionRate, lastUpdateTime } =
    patientData[patientIndex];

  if (fillElement && percentageDisplayElement && containerElement) {
    // Subtract the bottle weight from the fetched data
    let adjustedData = data - BOTTLE_WEIGHT;

    // Calculate the fill percentage based on adjusted data
    let fillPercentage;

    // If the adjusted data is greater than 0
    if (adjustedData > 0) {
      // Check if the previous data was 0 or less than the bottle weight
      if (previousData <= BOTTLE_WEIGHT) {
        fillPercentage = 100; // Set the fill percentage to 100%
        if (!startTime || endTime) {
          startTime = new Date(); // Set the start time only once
          endTime = null; // Reset end time
          lastUpdateTime = startTime;
          console.log("Start time set:", startTime);
        }
      } else {
        fillPercentage = Math.min((adjustedData / MAX_VALUE) * 100, 100);
      }
    } else {
      fillPercentage = 0; // Set the fill percentage to 0 if the data is less than or equal to the bottle weight
      if (!endTime) {
        endTime = new Date(); // Set the end time only once
        console.log("End time set:", endTime);
      }
    }

    // Update the previous data value
    previousData = data;

    fillElement.style.width = `${fillPercentage}%`;
    percentageDisplayElement.textContent = `${fillPercentage.toFixed(2)}%`;

    console.log(`Patient ${patientIndex} fill percentage: ${fillPercentage}%`);

    if (startTime && startTimeElement) {
      startTimeElement.textContent = `Start: ${startTime.toLocaleTimeString()}`;
    }

    if (endTime && endTimeElement) {
      endTimeElement.textContent = `End: ${endTime.toLocaleTimeString()}`;
    } else if (startTime && !endTime) {
      endTimeElement.textContent = "End: N/A";
    }

    // Prediction Logic
    if (startTime && !endTime && adjustedData > 0) {
      const currentTime = new Date();
      const timeElapsed = (currentTime - lastUpdateTime) / 1000; // Time elapsed in seconds since last update
      const consumptionSinceLastUpdate = previousData - adjustedData; // Consumption since last update

      // Update consumption rate if there is a change in data
      if (consumptionSinceLastUpdate > 0) {
        consumptionRate = consumptionSinceLastUpdate / timeElapsed; // Consumption rate in units per second
        lastUpdateTime = currentTime; // Update the last update time
      }
      if (consumptionRate > 0) {
        const remainingTime = adjustedData / consumptionRate; // Remaining time in seconds
        const predictedEndTime = new Date(
          currentTime.getTime() + remainingTime * 1000
        );

        predictionTimeElement.textContent = `Prediction Time: ${predictedEndTime.toLocaleTimeString()}`;
      } else {
        predictionTimeElement.textContent = "Prediction Time: Calculating..."; // Show "Calculating..." until a valid prediction time is calculated
      }
    } else {
      predictionTimeElement.textContent = "Prediction Time: N/A";
    }

    if (adjustedData <= BOTTLE_WEIGHT) {
      stopAllFunctionalities(patientIndex);
      fillElement.style.backgroundColor = "red";
    } else if (fillPercentage <= 25) {
      fillElement.style.backgroundColor = "red";
      fillElement.classList.add("blinking");
      containerElement.classList.add("blinking");
    } else if (fillPercentage <= 50) {
      fillElement.style.backgroundColor = "yellow";
      fillElement.classList.remove("blinking");
      containerElement.classList.remove("blinking");
    } else {
      fillElement.style.backgroundColor = "#00ff00";
      fillElement.classList.remove("blinking");
      containerElement.classList.remove("blinking");
    }

    // Update connection status
    updateConnectionStatus(fillPercentage, connectionStatusElement);

    handleModalAndBlinking(
      patientIndex,
      fillPercentage,
      fillElement,
      containerElement
    );
  }

  patientData[patientIndex] = {
    previousData,
    startTime,
    endTime,
    consumptionRate,
    lastUpdateTime,
  };

  // Rearrange the containers after updating the UI
  rearrangeContainers();
}

// Function to handle modal and blinking functionality
function handleModalAndBlinking(patientIndex, fillPercentage, fillElement, containerElement) {
  console.log(`Handling modal and blinking for patient ${patientIndex} with fill percentage ${fillPercentage}%`);
  if (fillPercentage <= 15 && fillPercentage >= 1) {
    fillElement.style.backgroundColor = "red";
    fillElement.classList.add("blinking");
    containerElement.classList.add("blinking");
    if (!modalShown[patientIndex]) {
      document.getElementById("adil").classList.add("blinking");
      showModal(patientIndex);
      modalShown[patientIndex] = true;
      setTimeout(() => {
        closeModal(patientIndex);
      }, 5000);
    }
  }
  if (fillPercentage == 100) {
    modalShown[patientIndex] = false;
    document.getElementById("adil").classList.remove("blinking");
    closeModal(patientIndex);
  }
}

// Function to show the modal
function showModal(patientIndex) {
  console.log(`Showing modal for patient ${patientIndex}`);
  modalQueue.push(patientIndex);
  if (!modalVisible) {
    displayNextModal();
  }
}

// Function to display the next modal in the queue
function displayNextModal() {
  if (modalQueue.length > 0) {
    modalVisible = true;
    const patientIndex = modalQueue.shift();
    const modal = document.getElementById("customAlert");
    const modalMessage = document.getElementById("p1");

    if (modal && modalMessage) {
      modal.style.display = "block";
      modalMessage.textContent = `Patient - ${patientIndex}`;
    }
    setTimeout(() => {
      closeModal();
    }, 5000);
  }
}

// Function to close the modal
function closeModal() {
  console.log("Closing modal");
  const modal = document.getElementById("customAlert");
  if (modal) {
    modal.style.display = "none";
  }
  document.getElementById("adil").classList.remove("blinking");
  modalVisible = false;
  if (modalQueue.length > 0) {
    displayNextModal();
  }
}

// Function to stop all functionalities
function stopAllFunctionalities(patientIndex) {
  console.log(`Stopping all functionalities for patient ${patientIndex}`);
  const fillElement = document.getElementById(`fill${patientIndex}`);
  const containerElement = document.getElementById(`container${patientIndex}`);
  fillElement.classList.remove("blinking");
  containerElement.classList.remove("blinking");
}

// Function to update connection status
function updateConnectionStatus(fillPercentage, statusElement) {
  if (fillPercentage === 0) {
    statusElement.textContent = "Not Connected ❌";
  } else {
    statusElement.textContent = "Connected ✔️";
  }
}


// Function to update block colors based on the data
function updateBlockColors(data) {
  Object.keys(data).forEach((key) => {
    const patientIndex = key.replace('Monitoringdata', '');
    const firebaseData = data[key];
    const blockElement = document.getElementById(`pp${patientIndex}`);
    if (blockElement) {
      if (firebaseData === 0) {
        blockElement.style.backgroundColor = "red";
      } else {
        blockElement.style.backgroundColor ="rgb(109, 238, 109)";
      }
    }
  });
}


// Arrange containers according to data
function rearrangeContainers() {
  const containerElements = document.querySelectorAll(".container");
  const containerArray = Array.from(containerElements);

  // Extract saline levels and their corresponding container elements
  const containerData = containerArray.map((container, index) => {
    const fillElement = container.querySelector(`.fill`);
    const percentage = parseFloat(fillElement.style.width) || 0;
    return {
      element: container,
      percentage: percentage,
      index: index,
    };
  });

  // Sort containers by saline level percentage, placing 0% at the end
  containerData.sort((a, b) => {
    if (a.percentage === 0) return 1;
    if (b.percentage === 0) return -1;
    return a.percentage - b.percentage;
  });

  // Check if the order has changed
  let orderChanged = false;
  containerData.forEach((data, index) => {
    if (data.index !== index) {
      orderChanged = true;
    }
  });

  if (orderChanged) {
    // Apply a temporary class to enable transition
    containerArray.forEach((container) => {
      container.classList.add("transitioning");
    });

    // Rearrange the containers in the HTML with smooth transition
    const parent = containerArray[0].parentElement;
    containerData.forEach((data, index) => {
      // Set the transform property to smoothly transition to new position
      data.element.style.transform = `translateY(${index * 100}px)`;
    });

    // After the transition ends, reset the transform property and actual positions
    setTimeout(() => {
      containerData.forEach((data) => {
        data.element.style.transform = "";
        parent.appendChild(data.element);
        data.element.classList.remove("transitioning");
      });
    }, 500); // Duration should match the CSS transition duration
  }
}

document.addEventListener("DOMContentLoaded", (event) => {
  // Create modal HTML dynamically
  const modalHTML = `
    <div id="customAlert" class="modal">
      <div class="modal-content">
        <span id="close" class="close">&times;</span>
        <h1 id="p1">Patient - 01</h1>
        <p>Warning: Low Saline Level!</p>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", modalHTML);

  // Add event listener for closing the modal
  document.getElementById("close").addEventListener("click", () => {
    closeModal();
  });

  // Start fetching data from Firebase
  fetchDataFromFirebase();
});
