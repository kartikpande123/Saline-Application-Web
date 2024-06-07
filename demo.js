const fills = document.querySelectorAll(".fill2");
const monitors = document.querySelectorAll(".monitor2");
const meter = document.querySelector(".meter2");

const salineLevels = [0, 0, 0];

fills.forEach((fill, index) => {
  const salineLevel = salineLevels[index];
  const fillWidth = salineLevel + "%";
  fill.style.width = fillWidth;

  if (salineLevel <= 25) {
    fill.classList.add("red");
  } else if (salineLevel <= 50) {
    fill.style.backgroundColor = "yellow";
  }

  // if (salineLevel <= 10) {
  //   fill.classList.add("blinking");
  //   monitors[index].classList.add("blinking");
  //   meter[index].classList.add("blinking");
  // }
});

function simulateSalineDecrease() {
  let currentSalinity = 100;

  if (currentSalinity === 95) {
    showModal()
  }

  document.getElementById("fill1").style.width = currentSalinity + "%";

  const decreaseInterval = setInterval(() => {
    currentSalinity -= 1;

    if (currentSalinity <= 50 && currentSalinity > 25) {
      document.getElementById("fill1").style.backgroundColor = "yellow";
    } else if (currentSalinity <= 25) {
      document.getElementById("fill1").style.backgroundColor = "red";
    }

    if (currentSalinity < 0) {
      clearInterval(decreaseInterval);
    } else {
      document.getElementById("fill1").style.width = currentSalinity + "%";
    }
    if (currentSalinity === 15) {
      document.getElementById("fill1").classList.add("blinking");
      document.getElementById("container").classList.add("blinking");
      let beepAudio = document.getElementById("beep");
      beepAudio.play();


    } else if (currentSalinity === 5) {
      showModal();
      document.getElementById("adil").classList.add("blinking");
      let audio = document.querySelector('audio');
      audio.play();
    }
  }, 1000);
}



simulateSalineDecrease();

function showModal() {
  document.getElementById("customAlert").style.display = "block";
}

function closeModal() {
  document.getElementById("customAlert").style.display = "none";
  document.getElementById("adil").classList.remove("blinking");
  document.getElementById("container").classList.remove("blinking");
}



