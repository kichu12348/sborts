const socket = io();
const state = {
  scores: new Map(),
  isInitialLoad: true,
  expandedEvents: new Set(), // Track expanded cards

  getHouseCard(house, totalScore, events) {
    const card = document.createElement("div");
    card.className = `house-card house-${house}`;
    const isExpanded = this.expandedEvents.has(house);

    card.innerHTML = `
      <div class="house-header">
        <div class="house-name">${house}</div>
        <div class="total-score">${totalScore}</div>
      </div>
      <button class="expand-button">${
        isExpanded ? "Hide Events" : "View Events"
      }</button>
      <div class="event-details ${isExpanded ? "expanded" : ""}">
        ${events
          .map(
            (event) => `
          <div class="event-item">
            <span class="event-name">${event.name}</span>
            <span class="event-score">${event.score}</span>
          </div>
        `
          )
          .join("")}
      </div>
    `;

    const expandButton = card.querySelector(".expand-button");
    const eventDetails = card.querySelector(".event-details");

    // Restore expanded state
    if (isExpanded) {
      eventDetails.classList.add("expanded");
    }

    expandButton.addEventListener("click", () => {
      eventDetails.classList.toggle("expanded");
      const isExpanded = eventDetails.classList.contains("expanded");
      expandButton.textContent = isExpanded
        ? "Hide Events"
        : "View Events";

      // Track expanded state
      if (isExpanded) {
        this.expandedEvents.add(house);
      } else {
        this.expandedEvents.delete(house);
      }
    });

    return card;
  },
};

socket.on("scoreUpdateAshwa", ({ scores, totalScores }) => {
  const scoreboard = document.getElementById("scoreboard");
  const loadingScreen = document.getElementById("loading-screen");

  if (state.isInitialLoad) {
    state.isInitialLoad = false;
    loadingScreen.classList.add("fade-out");
    setTimeout(() => (loadingScreen.style.display = "none"), 500);
  }

  scores.forEach((score) => state.scores.set(score.event, score));

  // Use server-provided total scores
  const totals = {
    red: totalScores.totalScoreRed,
    blue: totalScores.totalScoreBlue,
    green: totalScores.totalScoreGreen,
    yellow: totalScores.totalScoreYellow,
  };

  scoreboard.innerHTML = "";
  
  // Sort houses by total score in descending order
  const sortedHouses = ["red", "blue", "green", "yellow"].sort((a, b) => 
    totals[b] - totals[a]
  );

  sortedHouses.forEach((house) => {
    const events = Array.from(state.scores.entries()).map(
      ([name, score]) => ({
        name,
        score: score[house],
      })
    );

    const card = state.getHouseCard(house, totals[house], events);
    scoreboard.appendChild(card);
  });
});