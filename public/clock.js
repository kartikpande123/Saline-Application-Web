function updateTime() {
  const now = new Date();
  const timeElement = document.getElementById("time");
  const dateElement = document.getElementById("date");

  const timeString = now.toLocaleTimeString();
  const dateString = now.toDateString();

  timeElement.textContent = timeString;
  dateElement.textContent = dateString;
}

setInterval(updateTime, 1000);

updateTime();

let add = document.getElementById("add").addEventListener("click", () => {
  alert("Devlopment Underprocess");
});
