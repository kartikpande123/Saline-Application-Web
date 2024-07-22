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

const patientData = {}; // Object to store patient data
const modalShown = {}; // Object to store modal state for each patient
const modalQueue = []; // Queue for modal display
let modalVisible = false; // Flag for modal visibility

// Function to fetch data from Firebase in real-time
function fetchDataFromFirebase() {
  const dataRef = ref(database, "/");

  onValue(
    dataRef,
    (snapshot) => {
      const data = snapshot.val();
      console.log("Data fetched successfully:", JSON.stringify(data, null, 2));
      updateUI(data);
    },
    (error) => {
      console.error("Error fetching data:", error);
    }
  );
}

// Function to update the UI based on the fetched data
function updateUI(data) {
  for (let i = 1; i <= 7; i++) {
    const fillElement = document.getElementById(`fill${i}`);
    const percentageDisplayElement = document.getElementById(`percentage${i}`);
    const startTimeElement = document.getElementById(`start${i}`);
    const endTimeElement = document.getElementById(`end${i}`);
    const predictionTimeElement = document.getElementById(`predictionTime${i}`);
    const connectionStatusElement = document.getElementById(`status${i}`);

    if (fillElement && percentageDisplayElement && startTimeElement && endTimeElement && predictionTimeElement && connectionStatusElement) {
      const monitoringData = data.Monitoringdata[`Monitoringdata${i}`] || 0;
      const percentage = data.PERCENTAGE[`percentage${i}`] || 0;
      let startTime = data.START_TIME[`Start_time${i}`] || 'N/A';
      let predictionTime = data.PREDICTION_TIME[`prediction_time${i}`] || 'N/A';
      let endTime = 'N/A'; // Default end time to 'N/A'

      if (percentage === 0) {
        endTime = data.VEND_TIME[`Vend_time${i}`] || 'N/A';
      }

      if (percentage === 0) {
        predictionTime = 'N/A';
      }

      fillElement.style.width = `${percentage}%`;
      percentageDisplayElement.textContent = `${percentage.toFixed(2)}%`;
      startTimeElement.textContent = `Start: ${startTime}`;
      endTimeElement.textContent = `End: ${endTime}`;
      predictionTimeElement.textContent = `Prediction Time: ${predictionTime}`;

      // Update connection status
      if (percentage <= 0) {
        connectionStatusElement.textContent = "Not Connected ❌";
      } else {
        connectionStatusElement.textContent = "Connected ✔️";
      }

      handleModalAndBlinking(i, percentage, fillElement);

      // Update block colors
      const blockElement = document.getElementById(`pp${i}`);
      if (blockElement) {
        if (monitoringData <= 2) {
          blockElement.style.backgroundColor = "white";
        } else if (monitoringData <= 38) {
          blockElement.style.backgroundColor = "red";
        } else {
          blockElement.style.backgroundColor = "rgb(109, 238, 109)";
        }
      }
    }
  }
  rearrangeContainers();
}

// Function to handle modal and blinking functionality
function handleModalAndBlinking(patientIndex, fillPercentage, fillElement) {
  const containerElement = document.getElementById(`container${patientIndex}`);
  console.log(`Handling modal and blinking for patient ${patientIndex} with fill percentage ${fillPercentage}%`);

  if (fillPercentage <= 15 && fillPercentage > 0) {
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
  } else if (fillPercentage <= 25 && fillPercentage > 0) {
    fillElement.style.backgroundColor = "red";
    containerElement.classList.add("blinking");
    fillElement.classList.remove("blinking");
  } else if (fillPercentage <= 50) {
    fillElement.style.backgroundColor = "yellow";
    fillElement.classList.remove("blinking");
    containerElement.classList.remove("blinking");
  } else {
    fillElement.style.backgroundColor = "#00ff00";
    fillElement.classList.remove("blinking");
    containerElement.classList.remove("blinking");
    modalShown[patientIndex] = false;
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
function closeModal(patientIndex = null) {
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
  closeModal(patientIndex); // Close the modal specific to the patient
}

// Function to rearrange containers
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
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", modalHTML);

  // Add event listener for close button
  const closeButton = document.getElementById("close");
  if (closeButton) {
    closeButton.addEventListener("click", closeModal);
  }

  // Start fetching data from Firebase
  fetchDataFromFirebase();
});
